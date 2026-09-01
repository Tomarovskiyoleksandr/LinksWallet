const { z, email } = require("zod");

const registerSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3)
        .max(30),

    email: z
        .string()
        .trim()
        .email()
        .max(255),
    password: z
        .string()
        .min(8)
        .max(128)
});

const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .email()
        .max(255),
    password: z
        .string()
        .min(8)
        .max(128)
})

module.exports = {
    registerSchema,
    loginSchema
};