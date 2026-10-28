const config = require("./config");

const express = require("express");
const path = require("path");
const http = require("node:http");

const helmet = require("helmet");

const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);

const errorhandler = require("./middleware/errorHandler");

const pagesRouter = require("./routes/pages");
const pool = require("./db/db");

const app = express();

if (config.production) {
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
                frameAncestors: ["'none'"],
                upgradeInsecureRequests: config.production ? [] : null
            }
        }
    })
);

app.use(session({
    name: "linkswallet.sid",
    store: config.mock ? new session.MemoryStore() : new pgSession({
        pool: pool,
        tableName: "user_sessions",
	createTableIfMissing: true
    }),

    secret: config.sessionSecret,

    resave: false,
    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        secure: config.production,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}))

app.use(express.json({
    limit: "10kb"
}));

app.use((req, res, next) => {
    if (!config.production || !["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    const origin = req.get("origin");
    const expectedOrigin = `${req.protocol}://${req.get("host")}`;
    if (origin !== expectedOrigin) return res.status(403).json({ message: "Недопустимый источник запроса" });
    next();
});

// Статические файлы
app.use(express.static(path.join(__dirname, "../public"), {
    etag: true,
    maxAge: config.production ? "1h" : 0
}));

// Страницы
app.use("/", pagesRouter);

app.use((req, res) => {
    res.status(404).json({
        message: "Маршрут не найден"
    });
});

app.use(errorhandler);

let server;
async function start() {
    await pool.ready;
    let port = config.port;
    for (let attempt = 0; ; attempt++) {
        const candidate = http.createServer(app);
        try {
            await new Promise((resolve, reject) => {
                candidate.once("error", reject);
                candidate.once("listening", () => {
                    candidate.removeListener("error", reject);
                    resolve();
                });
                candidate.listen(port, config.host);
            });
        } catch (error) {
            if (config.mock && error.code === "EADDRINUSE" && attempt < 10 && port < 65535) {
                console.log(`Port ${port} is busy, trying ${port + 1}...`);
                port++;
                continue;
            }
            throw error;
        }
        server = candidate;
        console.log(`Server started on http://localhost:${server.address().port}`);
        if (config.mock) console.log("Local mock DB. Login: demo@example.com, code: 123456. Data resets on restart.");
        return server;
    }
}

let shuttingDown = false;
const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("Shutting down server...");

    if (!server) {
        await pool.end();
        return;
    }
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

if (require.main === module) start().catch(error => {
    console.error("Startup error:", error.message);
    process.exitCode = 1;
    pool.end();
});
module.exports = { app, start };
