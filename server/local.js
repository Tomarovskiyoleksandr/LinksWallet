// Local UI development must not inherit deployment settings from .env.
process.env.NODE_ENV = "development";
process.env.DB_MODE = "mock";
require("./server").start().catch(error => {
    console.error("Local startup error:", error.message);
    process.exitCode = 1;
    require("./db/db").end();
});
