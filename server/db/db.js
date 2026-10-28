const config = require("../config");
const { Pool } = config.mock
    ? require("pg-mem").newDb().adapters.createPg()
    : require("pg");
const pool = new Pool(config.mock ? {} : {
    connectionString: process.env.DATABASE_URL,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
    max: Number(process.env.DB_POOL_MAX || 10),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
});

pool.ready = config.mock ? (async () => {
    await require("../migrations/002_create_tables").up(pool);
    await require("../migrations/003_user_created_at").up(pool);
    await require("../migrations/004_two_factor_auth").up(pool);
    await require("../migrations/005_email_verification").up(pool);
    await require("../migrations/006_security_hardening").up(pool);
    await pool.query("INSERT INTO users (username, email) VALUES ($1, $2)",
        ["Дизайнер", "demo@example.com"]);
    await pool.query("INSERT INTO boards (user_id, name) VALUES (1, 'Вдохновение'), (1, 'Разработка'), (1, 'Пустая доска')");
    await pool.query(`INSERT INTO links (board_id, title, url) VALUES
        (1, 'Коллекция интерфейсов', 'https://example.com/interfaces'),
        (1, 'Типографика и цвета', 'https://example.com/colors'),
        (1, 'Идеи для нового проекта — пример длинного заголовка карточки', 'https://example.com/ideas'),
        (2, 'Документация JavaScript', 'https://developer.mozilla.org/ru/')`);
})() : Promise.resolve();

module.exports = pool;
