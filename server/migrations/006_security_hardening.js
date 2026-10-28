module.exports = {
    name: "006_security_hardening",
    async up(client) {
        await client.query(`
            UPDATE users SET email = LOWER(email);
            CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_unique ON users (LOWER(email));

            ALTER TABLE users DROP COLUMN IF EXISTS two_factor_enabled;
            ALTER TABLE users DROP COLUMN IF EXISTS totp_secret_encrypted;
            ALTER TABLE users DROP COLUMN IF EXISTS recovery_code_hashes;
            ALTER TABLE users DROP COLUMN IF EXISTS last_totp_step;
            ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
            DROP TABLE IF EXISTS trusted_login_devices;

            CREATE TABLE IF NOT EXISTS auth_rate_limits (
                id BIGSERIAL PRIMARY KEY,
                key_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS auth_rate_limits_lookup ON auth_rate_limits(key_hash, created_at DESC);
        `);
    }
};
