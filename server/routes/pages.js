
const express = require("express");
const path = require("path");

const pool = require("../db/db");

const asyncHandler = require("../middleware/asyncHandler");
const requireAuth = require("../middleware/auth");
const validate = require("../middleware/validate");
const authLimiter = require("../middleware/rateLimit");

const {
    registerSchema,
    profileSchema,
    loginSchema,
    emailCodeSchema
} = require("../validation/auth");
const { issueCode, consumeCode } = require("../security/emailAuth");

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
const regenerateSession = req => new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
const saveSession = req => new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));


// ==========================================
// PAGES
// ==========================================

router.get("/", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
});

router.get("/app", (req, res) => {
    res.sendFile(path.join(publicPath, "app.html"));
});

router.get("/login", (req, res) => {
    res.sendFile(path.join(publicPath, "login.html"));
});

router.get("/register", (req, res) => {
    res.sendFile(path.join(publicPath, "register.html"));
});

router.get("/about", (req, res) => {
    res.sendFile(path.join(publicPath, "about.html"));
});

router.get("/privacy", (req, res) => {
    res.sendFile(path.join(publicPath, "privacy.html"));
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

        const { username, email } = req.body;

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "Пользователь уже существует"
            });
        }

        const result = await pool.query(
            `INSERT INTO users (username, email, email_verified)
             VALUES ($1, $2, FALSE)
             RETURNING id, username, email`,
            [username, email]
        );
        await issueCode(pool, result.rows[0].id, email, "register");
        req.session.pendingRegisterUserId = result.rows[0].id;
        await saveSession(req);
        res.status(201).json({
            message: "Код подтверждения отправлен на почту",
            requiresEmailVerification: true
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

        const { email } = req.body;

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Пользователь с таким email не найден"
            });
        }

        const user = result.rows[0];

        if (!user.email_verified) {
            await issueCode(pool, user.id, user.email, "register");
            await regenerateSession(req);
            req.session.pendingRegisterUserId = user.id;
            await saveSession(req);
            return res.json({ requiresEmailVerification: true });
        }
        await issueCode(pool, user.id, user.email, "login");
        await regenerateSession(req);
        req.session.pendingLoginUserId = user.id;
        await saveSession(req);
        res.json({ requiresEmailCode: true, message: "Код входа отправлен на почту" });
    })
);

router.post("/verify-registration", authLimiter, validate(emailCodeSchema), asyncHandler(async (req, res) => {
    const userId = req.session.pendingRegisterUserId;
    if (!userId) return res.status(401).json({ message: "Сначала зарегистрируйтесь или войдите" });
    if (!(await consumeCode(pool, userId, "register", req.body.code))) return res.status(401).json({ message: "Неверный или просроченный код" });
    await pool.query("UPDATE users SET email_verified = TRUE WHERE id = $1", [userId]);
    await regenerateSession(req);
    req.session.userId = userId;
    await saveSession(req);
    res.json({ message: "Email подтверждён" });
}));

router.post("/login-email-code", authLimiter, validate(emailCodeSchema), asyncHandler(async (req, res) => {
    const userId = req.session.pendingLoginUserId;
    if (!userId) return res.status(401).json({ message: "Сначала введите email" });
    if (!(await consumeCode(pool, userId, "login", req.body.code))) return res.status(401).json({ message: "Неверный или просроченный код" });
    await regenerateSession(req);
    req.session.userId = userId;
    await saveSession(req);
    res.json({ message: "Успешный вход" });
}));

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
            `SELECT id, email, username, created_at, email_verified
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

router.patch("/me", requireAuth, validate(profileSchema), asyncHandler(async (req, res) => {
    const result = await pool.query(
        "UPDATE users SET username = $1 WHERE id = $2 RETURNING id, email, username, created_at",
        [req.body.username, req.session.userId]
    );
    if (!result.rows.length) return res.status(404).json({ message: "Пользователь не найден" });
    res.json({ user: result.rows[0] });
}));

module.exports = router;
