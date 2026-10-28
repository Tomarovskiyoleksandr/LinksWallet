const rateLimit = require("express-rate-limit");
const config = require("../config");

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.mock ? 100 : 10,

    message: {
        message: "Слишком много попыток. Попробуйте позже."
    },

    standardHeaders: true,
    legacyHeaders: false
});

module.exports = authLimiter;
