require("dotenv").config();

const { Client } = require("pg");

const migrations = [
    require("./001_initial")
];

async function migrate() {

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    await client.connect();

    console.log("Database connected");

    await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    for (const migration of migrations) {

        const name = migration.name;

        const result = await client.query(
            `SELECT id FROM migrations WHERE name = $1`,
            [name]
        );

        if (result.rows.length > 0) {
            continue;
        }

        await migration.up(client);

        await client.query(
            `INSERT INTO migrations (name)
             VALUES ($1)`,
            [name]
        );

        console.log(`Migration ${name} applied`);
    }

    await client.end();

    console.log("Migrations completed");
}

migrate().catch(error => {
    console.error("Migration error:", error);
    process.exit(1);
});