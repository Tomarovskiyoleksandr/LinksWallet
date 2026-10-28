const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Client } = require("pg");
const argon2 = require("argon2");

const migrations = [1, 2, 3, 4, 5].map(number => require(`../migrations/00${number}_${[
    "initial", "create_tables", "user_created_at", "two_factor_auth", "email_verification"
][number - 1]}`));
const migration006 = require("../migrations/006_security_hardening");

test("001-005 to 006 preserves PostgreSQL users, Argon2 passwords and data", {
    skip: process.env.TEST_DATABASE_URL ? false : "Set TEST_DATABASE_URL to a dedicated empty PostgreSQL database ending in _test",
    timeout: 120000
}, async () => {
    const url = new URL(process.env.TEST_DATABASE_URL);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    assert.match(databaseName, /_test$/i, "Refusing to run against a database whose name does not end in _test");

    const client = new Client({
        connectionString: process.env.TEST_DATABASE_URL,
        ssl: process.env.TEST_DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false
    });
    await client.connect();
    try {
        const existing = await client.query("SELECT to_regclass('public.users') AS users");
        assert.equal(existing.rows[0].users, null, "The migration test requires an empty dedicated database");

        for (const migration of migrations) await migration.up(client);

        const firstHash = await argon2.hash("migration-test-password-1", { type: argon2.argon2id });
        const secondHash = await argon2.hash("migration-test-password-2", { type: argon2.argon2id });
        const users = await client.query(`
            INSERT INTO users (username, email, password_hash, two_factor_enabled, totp_secret_encrypted, recovery_code_hashes, last_totp_step)
            VALUES
                ('Migration Alpha', 'Case@Test.invalid', $1, TRUE, 'encrypted-test-secret', '["test-recovery-hash"]', 42),
                ('Migration Beta', 'case@test.invalid', $2, FALSE, NULL, '[]', NULL)
            RETURNING id
        `, [firstHash, secondHash]);
        const firstId = users.rows[0].id;
        const secondId = users.rows[1].id;
        const board = await client.query("INSERT INTO boards (user_id, name) VALUES ($1, 'Migration board') RETURNING id", [firstId]);
        await client.query("INSERT INTO links (board_id, title, url) VALUES ($1, 'Migration link', 'https://example.invalid')", [board.rows[0].id]);
        await client.query(`
            INSERT INTO trusted_login_devices (user_id, token_hash, user_agent_hash, expires_at)
            VALUES ($1, 'test-token-hash', 'test-agent-hash', CURRENT_TIMESTAMP + INTERVAL '30 days')
        `, [firstId]);

        await assert.rejects(() => migration006.up(client), /Cannot normalize duplicate email/);
        assert.equal((await client.query("SELECT password_hash FROM users WHERE id = $1", [firstId])).rows[0].password_hash, firstHash);
        assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM trusted_login_devices")).rows[0].count, 1);

        await client.query("UPDATE users SET email = 'migration-beta@test.invalid' WHERE id = $1", [secondId]);
        await migration006.up(client);

        const preserved = await client.query("SELECT * FROM users WHERE id = $1", [firstId]);
        assert.equal(preserved.rows[0].email, "case@test.invalid");
        assert.equal(preserved.rows[0].password_hash, firstHash);
        assert.equal(await argon2.verify(preserved.rows[0].password_hash, "migration-test-password-1"), true);
        assert.equal(preserved.rows[0].two_factor_enabled, true);
        assert.equal(preserved.rows[0].totp_secret_encrypted, "encrypted-test-secret");
        assert.equal(String(preserved.rows[0].last_totp_step), "42");
        assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM trusted_login_devices")).rows[0].count, 1);
        assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM boards")).rows[0].count, 1);
        assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM links")).rows[0].count, 1);
        assert.ok((await client.query("SELECT to_regclass('public.auth_rate_limits') AS table_name")).rows[0].table_name);
    } finally {
        await client.end();
    }
});
