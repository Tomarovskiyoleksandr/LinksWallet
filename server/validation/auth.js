const { z } = require("zod");

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
        .max(255)
        .transform(value => value.toLowerCase())
});

const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .email()
        .max(255)
        .transform(value => value.toLowerCase())
})

const emailCodeSchema = z.object({
    code: z.string().trim().min(6).max(32)
});

module.exports = {
    profileSchema: registerSchema.pick({ username: true }),
    registerSchema,
    loginSchema,
    emailCodeSchema
};
