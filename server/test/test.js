const BASE_URL = "http://localhost:3000";


// ============================================================
// CONFIG
// ============================================================

const TEST_USER = {
    email: "9moki6@gmail.com",
    password: "113604511"
};


// ============================================================
// STATE
// ============================================================

let cookie = "";

let boardId = null;
let linkId = null;

let passed = 0;
let failed = 0;


// ============================================================
// HELPERS
// ============================================================

function logTest(name, status, details = "") {

    if (status) {
        passed++;

        console.log(`✅ PASS  ${name}`);

    } else {
        failed++;

        console.log(`❌ FAIL  ${name}`);

        if (details) {
            console.log("   ", details);
        }
    }
}


function assert(condition, message) {

    if (!condition) {
        throw new Error(message);
    }
}


async function request(path, options = {}, expectedStatus = null) {

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (cookie) {
        headers.Cookie = cookie;
    }

    const response = await fetch(BASE_URL + path, {
        ...options,
        headers
    });


    // --------------------------------------------------------
    // COOKIE
    // --------------------------------------------------------

    let setCookie = null;

    if (typeof response.headers.getSetCookie === "function") {

        const cookies = response.headers.getSetCookie();

        if (cookies.length > 0) {
            setCookie = cookies[0];
        }

    } else {

        setCookie = response.headers.get("set-cookie");

    }


    if (setCookie) {
        cookie = setCookie.split(";")[0];
    }


    // --------------------------------------------------------
    // RESPONSE BODY
    // --------------------------------------------------------

    const contentType = response.headers.get("content-type") || "";

    let data = null;

    if (contentType.includes("application/json")) {

        data = await response.json();

    } else {

        data = await response.text();

    }


    // --------------------------------------------------------
    // STATUS CHECK
    // --------------------------------------------------------

    if (
        expectedStatus !== null &&
        response.status !== expectedStatus
    ) {

        throw new Error(
            `Expected ${expectedStatus}, received ${response.status}. Response: ${JSON.stringify(data)}`
        );

    }


    return {
        response,
        data
    };
}


async function test(name, callback) {

    try {

        await callback();

        logTest(name, true);

    } catch (error) {

        logTest(
            name,
            false,
            error.message
        );

    }
}


// ============================================================
// 1. SERVER
// ============================================================

async function testHomePage() {

    const { response } = await request(
        "/",
        {},
        200
    );

    assert(
        response.status === 200,
        "Home page is not available"
    );
}


async function testLoginPage() {

    const { response } = await request(
        "/login",
        {},
        200
    );

    assert(
        response.status === 200,
        "Login page is not available"
    );
}


async function testRegisterPage() {

    const { response } = await request(
        "/register",
        {},
        200
    );

    assert(
        response.status === 200,
        "Register page is not available"
    );
}


// ============================================================
// 2. DATABASE
// ============================================================

async function testDatabase() {

    const { data } = await request(
        "/db-test",
        {},
        200
    );

    assert(
        data.success === true,
        "Database test returned success=false"
    );

    assert(
        data.databaseTime,
        "Database time is missing"
    );
}


// ============================================================
// 3. AUTH
// ============================================================

async function testUnauthorizedMe() {

    const oldCookie = cookie;

    cookie = "";

    const { data } = await request(
        "/me",
        {},
        401
    );

    assert(
        data.message,
        "Unauthorized response does not contain message"
    );

    cookie = oldCookie;
}


async function login() {

    const { data } = await request(
        "/login-user",
        {
            method: "POST",

            body: JSON.stringify({
                email: TEST_USER.email,
                password: TEST_USER.password
            })
        },
        200
    );

    assert(
        data.user,
        "Login response does not contain user"
    );

    assert(
        data.user.email === TEST_USER.email,
        "Wrong user returned from login"
    );

    assert(
        cookie,
        "Session cookie was not received"
    );
}


async function testMe() {

    const { data } = await request(
        "/me",
        {},
        200
    );

    assert(
        data.user,
        "/me does not return user"
    );

    assert(
        data.user.email === TEST_USER.email,
        "/me returned wrong user"
    );
}


// ============================================================
// 4. BOARDS
// ============================================================

async function testGetBoards() {

    const { data } = await request(
        "/boards",
        {},
        200
    );

    assert(
        Array.isArray(data.boards),
        "boards is not an array"
    );
}


async function testCreateBoard() {

    const { data } = await request(
        "/boards",
        {
            method: "POST",

            body: JSON.stringify({
                name: "AUTOMATED TEST BOARD"
            })
        },
        201
    );

    assert(
        data.board,
        "Created board is missing"
    );

    assert(
        data.board.id,
        "Board ID is missing"
    );

    assert(
        data.board.name === "AUTOMATED TEST BOARD",
        "Board name is incorrect"
    );

    boardId = data.board.id;
}


async function testGetCreatedBoard() {

    const { data } = await request(
        "/boards",
        {},
        200
    );

    const board = data.boards.find(
        board => board.id === boardId
    );

    assert(
        board,
        "Created board was not found"
    );
}


async function testUpdateBoard() {

    const { data } = await request(
        `/boards/${boardId}`,
        {
            method: "PATCH",

            body: JSON.stringify({
                name: "AUTOMATED TEST BOARD UPDATED"
            })
        },
        200
    );

    assert(
        data.board,
        "Updated board is missing"
    );

    assert(
        data.board.id === boardId,
        "Wrong board updated"
    );

    assert(
        data.board.name === "AUTOMATED TEST BOARD UPDATED",
        "Board name was not updated"
    );
}


// ============================================================
// 5. LINKS
// ============================================================

async function testCreateLink() {

    const { data } = await request(
        "/links",
        {
            method: "POST",

            body: JSON.stringify({
                boardId: boardId,
                title: "Automated Test Link",
                url: "https://example.com"
            })
        },
        201
    );

    assert(
        data.link,
        "Created link is missing"
    );

    assert(
        data.link.id,
        "Link ID is missing"
    );

    assert(
        data.link.title === "Automated Test Link",
        "Link title is incorrect"
    );

    assert(
        data.link.url === "https://example.com",
        "Link URL is incorrect"
    );

    linkId = data.link.id;
}


async function testGetLinks() {

    const { data } = await request(
        `/links?boardId=${boardId}`,
        {},
        200
    );

    assert(
        Array.isArray(data.links),
        "links is not an array"
    );

    const link = data.links.find(
        link => link.id === linkId
    );

    assert(
        link,
        "Created link was not found"
    );
}


async function testUpdateLink() {

    const { data } = await request(
        `/links/${linkId}`,
        {
            method: "PATCH",

            body: JSON.stringify({
                title: "Automated Test Link Updated",
                url: "https://example.org"
            })
        },
        200
    );

    assert(
        data.link,
        "Updated link is missing"
    );

    assert(
        data.link.id === linkId,
        "Wrong link updated"
    );

    assert(
        data.link.title === "Automated Test Link Updated",
        "Link title was not updated"
    );

    assert(
        data.link.url === "https://example.org",
        "Link URL was not updated"
    );
}


async function testGetUpdatedLink() {

    const { data } = await request(
        `/links?boardId=${boardId}`,
        {},
        200
    );

    const link = data.links.find(
        link => link.id === linkId
    );

    assert(
        link,
        "Updated link does not exist"
    );

    assert(
        link.title === "Automated Test Link Updated",
        "Updated title was not saved"
    );

    assert(
        link.url === "https://example.org",
        "Updated URL was not saved"
    );
}


async function testDeleteLink() {

    const { data } = await request(
        `/links/${linkId}`,
        {
            method: "DELETE"
        },
        200
    );

    assert(
        data.message === "Ссылка удалена",
        "Unexpected delete link response"
    );
}


async function testDeletedLinkIsGone() {

    const { data } = await request(
        `/links?boardId=${boardId}`,
        {},
        200
    );

    const link = data.links.find(
        link => link.id === linkId
    );

    assert(
        !link,
        "Deleted link still exists"
    );

    linkId = null;
}


// ============================================================
// 6. VALIDATION
// ============================================================

async function testInvalidBoard() {

    const { data } = await request(
        "/boards",
        {
            method: "POST",

            body: JSON.stringify({
                name: ""
            })
        },
        400
    );

    assert(
        data.message === "Некорректные данные",
        "Invalid board was not rejected"
    );
}


async function testInvalidBoardId() {

    const { data } = await request(
        "/boards/abc",
        {
            method: "DELETE"
        },
        400
    );

    assert(
        data.message === "Некорректные данные",
        "Invalid board ID was not rejected"
    );
}


async function testInvalidLink() {

    const { data } = await request(
        "/links",
        {
            method: "POST",

            body: JSON.stringify({
                boardId: boardId,
                title: "",
                url: "not-a-url"
            })
        },
        400
    );

    assert(
        data.message === "Некорректные данные",
        "Invalid link was not rejected"
    );
}


async function testInvalidLinkId() {

    const { data } = await request(
        "/links/abc",
        {
            method: "DELETE"
        },
        400
    );

    assert(
        data.message === "Некорректные данные",
        "Invalid link ID was not rejected"
    );
}


// ============================================================
// 7. SECURITY / AUTHORIZATION
// ============================================================

async function testBoardsWithoutAuth() {

    const oldCookie = cookie;

    cookie = "";

    await request(
        "/boards",
        {},
        401
    );

    cookie = oldCookie;
}


async function testLinksWithoutAuth() {

    const oldCookie = cookie;

    cookie = "";

    await request(
        `/links?boardId=${boardId}`,
        {},
        401
    );

    cookie = oldCookie;
}


async function testCreateBoardWithoutAuth() {

    const oldCookie = cookie;

    cookie = "";

    await request(
        "/boards",
        {
            method: "POST",

            body: JSON.stringify({
                name: "HACK TEST"
            })
        },
        401
    );

    cookie = oldCookie;
}


async function testCreateLinkWithoutAuth() {

    const oldCookie = cookie;

    cookie = "";

    await request(
        "/links",
        {
            method: "POST",

            body: JSON.stringify({
                boardId: boardId,
                title: "HACK",
                url: "https://example.com"
            })
        },
        401
    );

    cookie = oldCookie;
}


// ============================================================
// 8. 404
// ============================================================

async function test404() {

    const { data } = await request(
        "/this-route-does-not-exist",
        {},
        404
    );

    assert(
        data.message === "Маршрут не найден",
        "404 handler returned unexpected response"
    );
}


// ============================================================
// 9. LOGOUT
// ============================================================

async function logout() {

    const { data } = await request(
        "/logout",
        {
            method: "POST"
        },
        200
    );

    assert(
        data.message === "Вы вышли из аккаунта",
        "Unexpected logout response"
    );
}


async function testMeAfterLogout() {

    const { data } = await request(
        "/me",
        {},
        401
    );

    assert(
        data.message,
        "User is still authenticated after logout"
    );
}


// ============================================================
// 10. CLEANUP
// ============================================================

async function cleanup() {

    console.log("\n===== CLEANUP =====");

    // Если ссылка каким-то образом осталась
    if (linkId) {

        try {

            await request(
                `/links/${linkId}`,
                {
                    method: "DELETE"
                }
            );

        } catch (error) {

            console.log(
                "Cleanup link error:",
                error.message
            );

        }
    }


    // Удаляем тестовую доску
    if (boardId) {

        try {

            await request(
                `/boards/${boardId}`,
                {
                    method: "DELETE"
                }
            );

            console.log(
                "Test board cleanup completed"
            );

        } catch (error) {

            console.log(
                "Cleanup board error:",
                error.message
            );
        }
    }
}


// ============================================================
// MAIN
// ============================================================

async function main() {

    console.log("");
    console.log("==========================================");
    console.log("        SERVER INTEGRATION TEST");
    console.log("==========================================");
    console.log("");


    // --------------------------------------------------------
    // SERVER
    // --------------------------------------------------------

    await test(
        "Home page",
        testHomePage
    );

    await test(
        "Login page",
        testLoginPage
    );

    await test(
        "Register page",
        testRegisterPage
    );


    // --------------------------------------------------------
    // DATABASE
    // --------------------------------------------------------

    await test(
        "Database connection",
        testDatabase
    );


    // --------------------------------------------------------
    // AUTH WITHOUT LOGIN
    // --------------------------------------------------------

    await test(
        "Unauthorized /me",
        testUnauthorizedMe
    );


    // --------------------------------------------------------
    // LOGIN
    // --------------------------------------------------------

    await test(
        "Login",
        login
    );

    await test(
        "Current user /me",
        testMe
    );


    // --------------------------------------------------------
    // BOARDS
    // --------------------------------------------------------

    await test(
        "Get boards",
        testGetBoards
    );

    await test(
        "Create board",
        testCreateBoard
    );

    await test(
        "Get created board",
        testGetCreatedBoard
    );

    await test(
        "Update board",
        testUpdateBoard
    );


    // --------------------------------------------------------
    // LINKS
    // --------------------------------------------------------

    await test(
        "Create link",
        testCreateLink
    );

    await test(
        "Get links",
        testGetLinks
    );

    await test(
        "Update link",
        testUpdateLink
    );

    await test(
        "Get updated link",
        testGetUpdatedLink
    );

    await test(
        "Delete link",
        testDeleteLink
    );

    await test(
        "Deleted link is gone",
        testDeletedLinkIsGone
    );


    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    await test(
        "Invalid board validation",
        testInvalidBoard
    );

    await test(
        "Invalid board ID validation",
        testInvalidBoardId
    );

    await test(
        "Invalid link validation",
        testInvalidLink
    );

    await test(
        "Invalid link ID validation",
        testInvalidLinkId
    );


    // --------------------------------------------------------
    // SECURITY
    // --------------------------------------------------------

    await test(
        "Boards require authentication",
        testBoardsWithoutAuth
    );

    await test(
        "Links require authentication",
        testLinksWithoutAuth
    );

    await test(
        "Create board requires authentication",
        testCreateBoardWithoutAuth
    );

    await test(
        "Create link requires authentication",
        testCreateLinkWithoutAuth
    );


    // --------------------------------------------------------
    // 404
    // --------------------------------------------------------

    await test(
        "Unknown route returns 404",
        test404
    );


    // --------------------------------------------------------
    // CLEANUP BEFORE LOGOUT
    // --------------------------------------------------------

    await cleanup();


    // --------------------------------------------------------
    // LOGOUT
    // --------------------------------------------------------

    await test(
        "Logout",
        logout
    );

    await test(
        "Cannot access /me after logout",
        testMeAfterLogout
    );


    // --------------------------------------------------------
    // RESULT
    // --------------------------------------------------------

    console.log("");
    console.log("==========================================");
    console.log("              TEST RESULT");
    console.log("==========================================");

    console.log(`Total:  ${passed + failed}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    console.log("==========================================");


    if (failed > 0) {

        console.log("❌ SERVER TEST FAILED");

        process.exitCode = 1;

    } else {

        console.log("✅ ALL SERVER TESTS PASSED");

        process.exitCode = 0;
    }
}


main().catch(async error => {

    console.error("");
    console.error("🔥 CRITICAL TEST ERROR");
    console.error(error);

    try {
        await cleanup();
    } catch {}

    process.exitCode = 1;
});