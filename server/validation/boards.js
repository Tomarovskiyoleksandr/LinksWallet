const { z } = require("zod");

const boardSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1)
        .max(100)
});

module.exports = {
    boardSchema
}