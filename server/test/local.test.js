const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
process.env.DB_MODE = "mock";
process.env.NODE_ENV = "test";
process.env.PORT = "0";
const { start } = require("../server");
const pool = require("../db/db");

test("local startup retries a busy port without crashing", { timeout: 15000 }, async () => {
    const net = require("node:net");
    const { spawn } = require("node:child_process");
    const path = require("node:path");
    const blocker = net.createServer();
    blocker.listen(0, "127.0.0.1");
    await once(blocker, "listening");
    const port = blocker.address().port;
    const child = spawn(process.execPath, [path.join(__dirname, "../local.js")], {
        env: { ...process.env, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    try {
        const startedPort = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(output || "Startup timed out")), 10000);
            child.once("error", error => { clearTimeout(timer); reject(error); });
            child.once("exit", code => { clearTimeout(timer); reject(new Error(`Exited ${code}: ${output}`)); });
            child.stderr.on("data", chunk => { output += chunk; });
            child.stdout.on("data", chunk => {
                output += chunk;
                const match = output.match(/Server started on http:\/\/localhost:(\d+)/);
                if (match) { clearTimeout(timer); resolve(Number(match[1])); }
            });
        });
        assert.ok(startedPort > port);
        assert.ok(output.includes(`Port ${port} is busy`));
        const response = await fetch(`http://127.0.0.1:${startedPort}/health`);
        assert.equal(response.status, 200);
        assert.equal((await response.json()).status, "ok");
    } finally {
        const exited = once(child, "exit");
        child.kill();
        await exited;
        await new Promise(resolve => blocker.close(resolve));
    }
});

test("local pages, authentication, CRUD, ownership and cascading deletion", async () => {
    const server = await start();
    if (!server.listening) await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const cookies = new Map();
    async function request(path, method = "GET", body, status = 200) {
        const response = await fetch(base + path, {
            method,
            headers: { "Content-Type": "application/json", Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        const data = await response.json();
        assert.equal(response.status, status, JSON.stringify(data));
        const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean);
        for (const item of setCookies) {
            const [pair] = item.split(";");
            const index = pair.indexOf("=");
            cookies.set(pair.slice(0, index), pair.slice(index + 1));
        }
        return data;
    }
    try {
        for (const path of ["/", "/app", "/css/landing.css", "/js/landing.js", "/login", "/register", "/about", "/privacy", "/css/index.css", "/js/profile.js", "/css/about.css", "/js/about.js", "/img/about/link.svg", "/img/about/figma.svg", "/img/about/folder.svg", "/img/about/shield-check.svg", "/img/about/monitor-smartphone.svg", "/img/about/panels-top-left.svg", "/img/about/bookmark.svg", "/img/about/gift.svg"]) {
            const response = await fetch(base + path);
            assert.equal(response.status, 200);
            assert.ok(!response.headers.get("content-security-policy").includes("upgrade-insecure-requests"));
            await response.text();
        }
        await request("/health");
        await request("/me", "GET", undefined, 401);
        await request("/me", "PATCH", { username: "Unauthorized" }, 401);
        await request("/login-user", "POST", { email: "missing@example.com" }, 401);
        assert.equal((await request("/login-user", "POST", { email: "demo@example.com" })).requiresEmailCode, true);
        await request("/me", "GET", undefined, 401);
        await request("/login-email-code", "POST", { code: "123456" });
        assert.equal((await request("/me")).user.username, "Дизайнер");
        const originalUser = (await request("/me")).user;
        assert.ok(Number.isFinite(Date.parse(originalUser.created_at)));
        await request("/me", "PATCH", { username: " " }, 400);
        await request("/me", "PATCH", { username: "a".repeat(31) }, 400);
        const renamed = (await request("/me", "PATCH", { username: "  Новое имя  ", email: "ignored@example.com" })).user;
        assert.equal(renamed.username, "Новое имя");
        assert.equal(renamed.email, originalUser.email);
        assert.equal(renamed.created_at, originalUser.created_at);
        assert.equal((await request("/me")).user.username, "Новое имя");
        await request("/me", "PATCH", { username: "Дизайнер" });
        assert.equal((await request("/boards")).boards.length, 3);
        assert.equal((await request("/links?boardId=1")).links.length, 3);
        await request("/boards", "POST", { name: "" }, 400);
        const { board } = await request("/boards", "POST", { name: "Test" }, 201);
        await request(`/boards/${board.id}`, "PATCH", { name: "Updated" });
        const { link } = await request("/links", "POST", { boardId: board.id, title: "Test", url: "https://example.com" }, 201);
        await request(`/links/${link.id}`, "PATCH", { title: "Updated", url: "https://example.org" });
        assert.equal((await request(`/links?boardId=${board.id}`)).links[0].title, "Updated");
        await request(`/links/${link.id}`, "DELETE");
        await request("/links", "POST", { boardId: board.id, title: "Cascade", url: "https://example.com" }, 201);
        await request("/logout", "POST");
        assert.equal((await request("/register-user", "POST", { username: "Tester", email: "test@example.com" }, 201)).requiresEmailVerification, true);
        await request("/me", "GET", undefined, 401);
        await request("/verify-registration", "POST", { code: "123456" });
        assert.deepEqual((await request("/boards")).boards, []);
        await request(`/boards/${board.id}`, "DELETE", undefined, 404);
        await request("/links", "POST", { boardId: board.id, title: "Forbidden", url: "https://example.com" }, 403);
        assert.equal((await request("/login-user", "POST", { email: "demo@example.com" })).requiresEmailCode, true);
        await request("/login-email-code", "POST", { code: "123456" });
        await request(`/boards/${board.id}`, "DELETE");
        assert.equal((await pool.query("SELECT * FROM links WHERE board_id = $1", [board.id])).rows.length, 0);
        await request("/logout", "POST");
        await request("/me", "GET", undefined, 401);
    } finally {
        await new Promise(resolve => server.close(resolve));
        await pool.end();
    }
});
