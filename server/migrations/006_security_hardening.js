module.exports = {
    name: "006_security_hardening",
    async up(client) {
        const users = await client.query("SELECT id, email FROM users ORDER BY id");
        const normalizedEmails = new Map();
        for (const user of users.rows) {
            const normalized = user.email.toLowerCase();
            if (normalizedEmails.has(normalized)) {
                throw new Error(`Cannot normalize duplicate email ${normalized}; conflicting user IDs: ${normalizedEmails.get(normalized)}, ${user.id}`);
            }
            normalizedEmails.set(normalized, user.id);
        }
        await client.query(`
            UPDATE users SET email = LOWER(email);
            CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_unique ON users (LOWER(email));

            CREATE TABLE IF NOT EXISTS auth_rate_limits (
                id BIGSERIAL PRIMARY KEY,
                key_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS auth_rate_limits_lookup ON auth_rate_limits(key_hash, created_at DESC);
        `);
    }
};
