module.exports = {
    name: "005_email_verification",
    async up(client) {
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;

            CREATE TABLE IF NOT EXISTS email_auth_codes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('register', 'login')),
                code_hash TEXT NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                used_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS trusted_login_devices (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT UNIQUE NOT NULL,
                user_agent_hash TEXT NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS email_auth_codes_lookup ON email_auth_codes(user_id, purpose, created_at DESC);
            CREATE INDEX IF NOT EXISTS trusted_login_devices_lookup ON trusted_login_devices(user_id, token_hash);
        `);
    }
};
