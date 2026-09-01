const { z } = require("zod");

const linkSchema = z.object({
    boardId: z.coerce.number().int().positive(),

    title: z
        .string()
        .trim()
        .min(1)
        .max(200),

    url: z
        .string()
        .trim()
        .url()
        .max(2048)
});

const updateLinkSchema = z.object({
    title: z
        .string()
        .trim()
        .min(1)
        .max(200),

    url: z
        .string()
        .trim()
        .url()
        .max(2048)
});

module.exports = {
    linkSchema,
    updateLinkSchema
};