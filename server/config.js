const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });

const production = process.env.NODE_ENV === "production";
const dbMode = process.env.DB_MODE || (production ? "postgres" : "mock");
if (!["mock", "postgres"].includes(dbMode)) throw new Error("DB_MODE must be mock or postgres");
if (production && dbMode === "mock") throw new Error("Mock database is only available locally");
if (dbMode === "postgres" && !process.env.DATABASE_URL) throw new Error("Set DATABASE_URL for PostgreSQL");
if (production && !process.env.SESSION_SECRET) throw new Error("Set SESSION_SECRET in production");
if (production && process.env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("PORT must be a valid TCP port");

module.exports = {
    production,
    mock: dbMode === "mock",
    port,
    host: process.env.HOST || "127.0.0.1",
    sessionSecret: process.env.SESSION_SECRET || "local-development-session-secret",
    databaseSsl: process.env.DATABASE_SSL === "true"
};
 
