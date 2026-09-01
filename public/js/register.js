const registerForm = document.querySelector("#registerForm");
const inputUsername = document.querySelector("#username");
const inputEmail = document.querySelector("#email");
const inputPassword = document.querySelector("#password");
const authMessage = document.querySelector("#authMessage");

registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    authMessage.textContent = "";

    const username = inputUsername.value.trim();
    const email = inputEmail.value.trim();
    const password = inputPassword.value;
    const validationError = validateRegister({ username, email, password });

    if (validationError) {
        authMessage.textContent = validationError;
        return;
    }

    try {
        const response = await fetch("/register-user", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                email,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            authMessage.textContent = data.message || "Не удалось создать аккаунт";
            inputPassword.value = "";
            return;
        }

        const loginResponse = await fetch("/login-user", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        if (!loginResponse.ok) {
            authMessage.textContent = "Аккаунт создан. Войдите, чтобы продолжить";
            inputPassword.value = "";
            return;
        }

        window.location.href = "/";
    } catch (error) {
        authMessage.textContent = "Ошибка соединения с сервером";
        console.log("Ошибка соединения с сервером:", error);
    }
});

function validateRegister({ username, email, password }) {
    const usernameError = validateUsername(username);

    if (usernameError) {
        return usernameError;
    }

    const emailError = validateEmail(email);

    if (emailError) {
        return emailError;
    }

    return validatePassword(password);
}

function validateUsername(username) {
    if (username.length < 3) {
        return "Имя пользователя должно быть не короче 3 символов";
    }

    if (username.length > 30) {
        return "Имя пользователя не должно быть длиннее 30 символов";
    }

    return "";
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
