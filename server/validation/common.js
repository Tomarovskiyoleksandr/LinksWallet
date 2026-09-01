const { z } = require("zod");

const idSchema = z.object({
    id: z.coerce.number().int().positive()
});

const boardQuerySchema = z.object({
    boardId: z.coerce.number().int().positive()
});

module.exports = {
    idSchema,
    boardQuerySchema
};