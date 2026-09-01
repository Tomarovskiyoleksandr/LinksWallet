require("dotenv").config();

const express = require("express");
const path = require("path");

const helmet = require("helmet")

const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);

const errorhandler = require("./middleware/errorHandler")

const pagesRouter = require("./routes/pages");
const pool = require("./db/db");

const app = express();

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'self'"]
            }
        }
    })
);

const PORT = process.env.PORT || 3000;

app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: "user_sessions"
    }),

    secret: process.env.SESSION_SECRET,

    resave: false,
    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}))

app.use(express.json({
    limit: "10kb"
}));

// Статические файлы
app.use(express.static(path.join(__dirname, "../public")));

// Страницы
app.use("/", pagesRouter);

app.use((req, res) => {
    res.status(404).json({
        message: "Маршрут не найден"
    });
});

app.use(errorhandler);

const server = app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});

const shutdown = async () => {
    console.log("Shutting down server...");

    server.close(async () => {
        try {
            await pool.end();

            console.log("Database connection closed");
            process.exit(0);

        } catch (error) {
            console.error("Shutdown error:", error);
            process.exit(1);
        }
    });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
