const express = require("express");
const path = require("path");
const argon2 = require("argon2");

const pool = require("../db/db");

const asyncHandler = require("../middleware/asyncHandler");
const requireAuth = require("../middleware/auth");
const validate = require("../middleware/validate");
const authLimiter = require("../middleware/rateLimit");

const {
    registerSchema,
    loginSchema
} = require("../validation/auth");

const { boardSchema } = require("../validation/boards");

const {
    linkSchema,
    updateLinkSchema
} = require("../validation/links");

const {
    idSchema,
    boardQuerySchema
} = require("../validation/common");

const router = express.Router();

const publicPath = path.join(__dirname, "../../public");


// ==========================================
// PAGES
// ==========================================

router.get("/", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
});

router.get("/login", (req, res) => {
    res.sendFile(path.join(publicPath, "login.html"));
});

router.get("/register", (req, res) => {
    res.sendFile(path.join(publicPath, "register.html"));
});

// ==========================================
// AUTH
// ==========================================

// REGISTER

router.post(
    "/register-user",
    authLimiter,
    validate(registerSchema),
    asyncHandler(async (req, res) => {

        const { username, email, password } = req.body;

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "Пользователь уже существует"
            });
        }

        const passwordHash = await argon2.hash(password);

        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, username, email`,
            [username, email, passwordHash]
        );

        res.status(201).json({
            message: "Пользователь создан",
            user: result.rows[0]
        });
    })
);

router.get(
    "/health",
    asyncHandler(async (req, res) => {

        await pool.query("SELECT 1");

        res.status(200).json({
            status: "ok"
        });
    })
);

// LOGIN

router.post(
    "/login-user",
    authLimiter,
    validate(loginSchema),
    asyncHandler(async (req, res) => {

        const { email, password } = req.body;

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Неверный email или пароль"
            });
        }

        const user = result.rows[0];

        const validPassword = await argon2.verify(
            user.password_hash,
            password
        );

        if (!validPassword) {
            return res.status(401).json({
                message: "Неверный email или пароль"
            });
        }

        req.session.regenerate((error) => {

            if (error) {
                return res.status(500).json({
                    message: "Ошибка сервера"
                });
            }

            req.session.userId = user.id;

            req.session.save((error) => {

                if (error) {
                    return res.status(500).json({
                        message: "Ошибка сервера"
                    });
                }

                res.json({
                    message: "Успешный вход",
                    user: {
                        id: user.id,
                        email: user.email
                    }
                });
            });
        });
    })
);

// LOGOUT

router.post("/logout", asyncHandler(async (req, res) => {

    await new Promise((resolve, reject) => {
        req.session.destroy((error) => {

            if (error) {
                reject(error);
            } else {
                resolve();
            }

        });
    });

    res.clearCookie("connect.sid");

    res.json({
        message: "Вы вышли из аккаунта"
    });
}));


// CURRENT USER

router.get(
    "/me",
    requireAuth,
    asyncHandler(async (req, res) => {

        const result = await pool.query(
            `SELECT id, email, username
             FROM users
             WHERE id = $1`,
            [req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Пользователь не найден"
            });
        }

        res.json({
            user: result.rows[0]
        });
    })
);


// ==========================================
// BOARDS
// ==========================================

// CREATE BOARD

router.post(
    "/boards",
    requireAuth,
    validate(boardSchema),
    asyncHandler(async (req, res) => {

        const { name } = req.body;

        const result = await pool.query(
            `INSERT INTO boards (user_id, name)
             VALUES ($1, $2)
             RETURNING id, name`,
            [req.session.userId, name]
        );

        res.status(201).json({
            board: result.rows[0]
        });
    })
);


// GET ALL BOARDS

router.get(
    "/boards",
    requireAuth,
    asyncHandler(async (req, res) => {

        const result = await pool.query(
            `SELECT id, name
             FROM boards
             WHERE user_id = $1
             ORDER BY id`,
            [req.session.userId]
        );

        res.json({
            boards: result.rows
        });
    })
);


// UPDATE BOARD

router.patch(
    "/boards/:id",
    requireAuth,
    validate(idSchema, "params"),
    validate(boardSchema),
    asyncHandler(async (req, res) => {

        const boardId = req.params.id;
        const { name } = req.body;

        const result = await pool.query(
            `UPDATE boards
             SET name = $1
             WHERE id = $2
             AND user_id = $3
             RETURNING id, name`,
            [name, boardId, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Доска не найдена"
            });
        }

        res.json({
            board: result.rows[0]
        });
    })
);


// DELETE BOARD

router.delete(
    "/boards/:id",
    requireAuth,
    validate(idSchema, "params"),
    asyncHandler(async (req, res) => {

        const boardId = req.params.id;

        const result = await pool.query(
            `DELETE FROM boards
             WHERE id = $1
             AND user_id = $2
             RETURNING id`,
            [boardId, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Доска не найдена"
            });
        }

        res.json({
            message: "Доска удалена"
        });
    })
);


// ==========================================
// LINKS
// ==========================================

// CREATE LINK

router.post(
    "/links",
    requireAuth,
    validate(linkSchema),
    asyncHandler(async (req, res) => {

        const { boardId, title, url } = req.body;

        const board = await pool.query(
            `SELECT id
             FROM boards
             WHERE id = $1
             AND user_id = $2`,
            [boardId, req.session.userId]
        );

        if (board.rows.length === 0) {
            return res.status(403).json({
                message: "Нет доступа к этой доске"
            });
        }

        const result = await pool.query(
            `INSERT INTO links (board_id, title, url)
             VALUES ($1, $2, $3)
             RETURNING id, title, url`,
            [boardId, title, url]
        );

        res.status(201).json({
            link: result.rows[0]
        });
    })
);


// GET LINKS

router.get(
    "/links",
    requireAuth,
    validate(boardQuerySchema, "query"),
    asyncHandler(async (req, res) => {

        const { boardId } = req.query;

        const result = await pool.query(
            `SELECT links.id, links.title, links.url
             FROM links
             JOIN boards ON links.board_id = boards.id
             WHERE links.board_id = $1
             AND boards.user_id = $2
             ORDER BY links.id`,
            [boardId, req.session.userId]
        );

        res.json({
            links: result.rows
        });
    })
);


// UPDATE LINK

router.patch(
    "/links/:id",
    requireAuth,
    validate(idSchema, "params"),
    validate(updateLinkSchema),
    asyncHandler(async (req, res) => {

        const linkId = req.params.id;
        const { title, url } = req.body;

        const result = await pool.query(
            `UPDATE links
             SET title = $1,
                 url = $2
             WHERE id = $3
             AND board_id IN (
                 SELECT id
                 FROM boards
                 WHERE user_id = $4
             )
             RETURNING id, title, url`,
            [title, url, linkId, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Ссылка не найдена"
            });
        }

        res.json({
            link: result.rows[0]
        });
    })
);


// DELETE LINK

router.delete(
    "/links/:id",
    requireAuth,
    validate(idSchema, "params"),
    asyncHandler(async (req, res) => {

        const linkId = req.params.id;

        const result = await pool.query(
            `DELETE FROM links
             WHERE id = $1
             AND board_id IN (
                 SELECT id
                 FROM boards
                 WHERE user_id = $2
             )
             RETURNING id`,
            [linkId, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Ссылка не найдена"
            });
        }

        res.json({
            message: "Ссылка удалена"
        });
    })
);

module.exports = router;
