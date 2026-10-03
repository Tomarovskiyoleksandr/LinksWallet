module.exports = {
    name: "002_create_tables",

    async up(client) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS boards (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL
                    REFERENCES users(id)
                    ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS links (
                id SERIAL PRIMARY KEY,
                board_id INTEGER NOT NULL
                    REFERENCES boards(id)
                    ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                url TEXT NOT NULL
            );
        `);

        console.log("Tables users, boards and links created");
    }
};

