const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
const config = require("../config");

const CODE_TTL_MINUTES = 10;
const DEVICE_TTL_DAYS = 30;

const hash = value => crypto.createHmac("sha256", config.sessionSecret).update(String(value)).digest("hex");
const generateCode = () => config.mock ? "123456" : crypto.randomInt(0, 1000000).toString().padStart(6, "0");
const generateDeviceToken = () => crypto.randomBytes(32).toString("base64url");
const hashUserAgent = req => hash(req.get("user-agent") || "unknown");

function mailer() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    if (!host || !user || !pass) throw new Error("Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD");
    return nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 465),
        secure: process.env.SMTP_SECURE !== "false",
        auth: { user, pass }
    });
}

async function sendCode(email, code, purpose) {
    if (config.mock) return;
    const action = purpose === "register" ? "подтверждения регистрации" : "входа в аккаунт";
    await mailer().sendMail({
        from: process.env.SMTP_FROM || `LinksWallet <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Код ${action} — LinksWallet`,
        text: `Ваш код для ${action}: ${code}\n\nКод действует ${CODE_TTL_MINUTES} минут. Если это были не вы, просто проигнорируйте письмо.`,
        html: `<div style="margin:0;padding:36px 16px;background:#fbfbfd;font-family:Arial,sans-serif;color:#15182b"><div style="max-width:520px;margin:auto;padding:34px;background:#fff;border:1px solid #e9e9f1;border-radius:18px;box-shadow:0 18px 60px rgba(20,20,50,.08)"><div style="color:#7048ff;font-size:24px;font-weight:750">🔗 LinksWallet</div><h1 style="margin:32px 0 8px;font-size:27px">Код ${action}</h1><p style="margin:0;color:#888da8;line-height:1.5">Вы запросили одноразовый код.</p><div style="margin:28px 0;padding:18px;border-radius:12px;background:#f7f6fc;color:#15182b;font-size:34px;font-weight:750;letter-spacing:12px;text-align:center">${code}</div><p style="font-weight:700">Код действует ${CODE_TTL_MINUTES} минут.</p><p style="margin-bottom:0;color:#888da8;line-height:1.5">Если это были не вы, проигнорируйте письмо. Никому не сообщайте этот код.</p></div></div>`
    });
}

async function issueCode(pool, userId, email, purpose) {
    const code = generateCode();
    await pool.query("UPDATE email_auth_codes SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL", [userId, purpose]);
    await pool.query("INSERT INTO email_auth_codes (user_id, purpose, code_hash, expires_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '10 minutes')", [userId, purpose, hash(`${userId}:${purpose}:${code}`)]);
    await sendCode(email, code, purpose);
}

async function consumeCode(pool, userId, purpose, code) {
    const result = await pool.query("SELECT id, code_hash, attempts, expires_at FROM email_auth_codes WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1", [userId, purpose]);
    if (!result.rows.length) return false;
    const row = result.rows[0];
    if (row.attempts >= 5 || new Date(row.expires_at) <= new Date()) return false;
    const supplied = Buffer.from(hash(`${userId}:${purpose}:${String(code).trim()}`), "hex");
    const expected = Buffer.from(row.code_hash, "hex");
    const valid = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
    const update = await pool.query(valid
        ? "UPDATE email_auth_codes SET used_at = CURRENT_TIMESTAMP WHERE id = $1 AND used_at IS NULL AND attempts < 5 RETURNING id"
        : "UPDATE email_auth_codes SET attempts = attempts + 1 WHERE id = $1 AND used_at IS NULL AND attempts < 5 RETURNING id",
    [row.id]);
    return valid && update.rows.length === 1;
}

module.exports = { issueCode, consumeCode, generateDeviceToken, hash, hashUserAgent, DEVICE_TTL_DAYS };
