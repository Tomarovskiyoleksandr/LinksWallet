module.exports = {
    name: "003_user_created_at",
    async up(client) {
        // Preserve unknown registration dates for existing accounts.
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ");
        await client.query("ALTER TABLE users ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP");
    }
};
