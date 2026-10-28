const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });

const { Client } = require("pg");

const migrations = [
    require("./001_initial"),
    require("./002_create_tables"),
    require("./003_user_created_at"),
    require("./004_two_factor_auth"),
    require("./005_email_verification"),
    require("./006_security_hardening")
];

async function migrate() {
    if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before running migrations");
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false
    });
    try {
        await client.connect();
        console.log("Database connected");
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        for (const migration of migrations) {
            const result = await client.query("SELECT id FROM migrations WHERE name = $1", [migration.name]);
            if (result.rows.length) continue;
            await client.query("BEGIN");
            try {
                await migration.up(client);
                await client.query("INSERT INTO migrations (name) VALUES ($1)", [migration.name]);
                await client.query("COMMIT");
                console.log(`Migration ${migration.name} applied`);
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            }
        }
        console.log("Migrations completed");
    } finally {
        await client.end().catch(() => {});
    }
}

migrate().catch(error => {
    console.error("Migration error:", error);
    process.exit(1);
});
