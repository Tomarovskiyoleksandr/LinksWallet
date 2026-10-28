module.exports = {
    name: "004_two_factor_auth",
    async up(client) {
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_encrypted TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_code_hashes TEXT NOT NULL DEFAULT '[]';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS last_totp_step BIGINT;
        `);
    }
};
