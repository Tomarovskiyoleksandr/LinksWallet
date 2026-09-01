const form = document.querySelector("#loginForm");
const inputEmail = document.querySelector("#email");
const inputPassword = document.querySelector("#password");
const authMessage = document.querySelector("#authMessage");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    authMessage.textContent = "";

    const email = inputEmail.value.trim();
    const password = inputPassword.value;
    const validationError = validateLogin({ email, password });

    if (validationError) {
        authMessage.textContent = validationError;
        return;
    }

    try {
        const response = await fetch("/login-user", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            authMessage.textContent = data.message || "Не удалось войти";
            inputPassword.value = "";
            return;
        }

        window.location.href = "/";
    } catch (error) {
        authMessage.textContent = "Ошибка соединения с сервером";
        console.log("Ошибка соединения с сервером:", error);
    }
});

function validateLogin({ email, password }) {
    const emailError = validateEmail(email);

    if (emailError) {
        return emailError;
    }

    return validatePassword(password);
}

function validateEmail(email) {
    if (!email) {
        return "Введите email";
    }

    if (email.length > 255) {
        return "Email не должен быть длиннее 255 символов";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return "Введите корректный email";
    }

    return "";
}

function validatePassword(password) {
    if (password.length < 8) {
        return "Пароль должен быть не короче 8 символов";
    }

    if (password.length > 128) {
        return "Пароль не должен быть длиннее 128 символов";
    }

    return "";
}
