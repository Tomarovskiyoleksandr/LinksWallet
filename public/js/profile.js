document.addEventListener("DOMContentLoaded", async () => {

    const usernameBlock = document.querySelector("#usernameRender");
    const username = document.querySelector("#username");
    const dropMenu = document.querySelector("#profileMenu");

    setupProfileMenu();
    setupLinksViewSwitcher();
    setupLinkActionsMenus();
    setupThemeSwitcher();

    try {
        const response = await fetch("/me");

        if (!response.ok) {
            throw new Error("Не авторизирован");
        }

        const data = await response.json();

        usernameBlock.innerHTML = data.user.username;
        username.innerHTML = data.user.username;
        setAuthMenuState(true);
        setAppAuthState(true);

        console.log("Пользователь:", data);

        // Загружаем доски
        await loadBoards();

        // Загружаем ссылки первой доски
        await loadLinks();

    } catch (error) {
        usernameBlock.textContent = "гость";
        username.textContent = "Аккаунт";
        setAuthMenuState(false);
        setAppAuthState(false);
        renderGuestPlaceholders();
        console.log("Не авторизирован");
    }
});

function setupProfileMenu() {
    const username = document.querySelector("#username");
    const dropMenu = document.querySelector("#profileMenu");

    if (!username || !dropMenu) {
        return;
    }

    username.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleProfileMenu();
    });

    dropMenu.addEventListener("click", (event) => {
        event.stopPropagation();
    });

    document.addEventListener("click", closeProfileMenu);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeProfileMenu();
        }
    });

    const logoutLink = document.querySelector("#logoutLink");

    if (logoutLink) {
        logoutLink.addEventListener("click", async (event) => {
            event.preventDefault();

            try {
                const response = await fetch("/logout", {
                    method: "POST"
                });

                if (!response.ok) {
                    throw new Error("Ошибка выхода");
                }

                window.location.href = "/login";
            } catch (error) {
                console.log(error);
            }
        });
    }
}

function toggleProfileMenu() {
    const username = document.querySelector("#username");
    const dropMenu = document.querySelector("#profileMenu");

    if (!username || !dropMenu) {
        return;
    }

    const isOpen = dropMenu.classList.toggle("active");

    username.classList.toggle("active", isOpen);
    username.setAttribute("aria-expanded", String(isOpen));
}

function closeProfileMenu() {
    const username = document.querySelector("#username");
    const dropMenu = document.querySelector("#profileMenu");

    if (!username || !dropMenu) {
        return;
    }

    dropMenu.classList.remove("active");
    username.classList.remove("active");
    username.setAttribute("aria-expanded", "false");
}

function setAuthMenuState(isAuth) {
    document.querySelectorAll("[data-auth='user']").forEach((element) => {
        element.hidden = !isAuth;
    });

    document.querySelectorAll("[data-auth='guest']").forEach((element) => {
        element.hidden = isAuth;
    });
}

function setAppAuthState(isAuth) {
    document.documentElement.dataset.auth = isAuth ? "user" : "guest";

    document.querySelectorAll("#boards input, #boards button, #addLink input, #addLink button").forEach((element) => {
        element.disabled = !isAuth;
    });
}

function setupLinksViewSwitcher() {
    const linksContainer = document.querySelector(".links__container");
    const viewButtons = document.querySelectorAll(".links-view-btn");
    const savedView = localStorage.getItem("linksView") || "list";

    if (!linksContainer || viewButtons.length === 0) {
        return;
    }

    setLinksView(savedView);

    viewButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const view = button.dataset.view || "list";

            setLinksView(view);
            localStorage.setItem("linksView", view);
        });
    });
}

function setLinksView(view) {
    const linksContainer = document.querySelector(".links__container");
    const viewButtons = document.querySelectorAll(".links-view-btn");
    const availableViews = ["list", "medium", "small"];
    const nextView = availableViews.includes(view) ? view : "list";

    if (!linksContainer) {
        return;
    }

    closeLinkActionsMenus();

    linksContainer.classList.remove(
        "links__container--list",
        "links__container--medium",
        "links__container--small"
    );
    linksContainer.classList.add(`links__container--${nextView}`);

    viewButtons.forEach((button) => {
        const isActive = button.dataset.view === nextView;

        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}

function setupLinkActionsMenus() {
    document.addEventListener("click", (event) => {
        const activeCard = event.target.closest(".link-card.actions-open");

        closeLinkActionsMenus(activeCard);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeLinkActionsMenus();
        }
    });
}

function closeLinkActionsMenus(exceptCard = null) {
    document.querySelectorAll(".link-card.actions-open").forEach((card) => {
        if (card === exceptCard) {
            return;
        }

        card.classList.remove("actions-open");

        const moreButton = card.querySelector(".link-card__more");

        if (moreButton) {
            moreButton.setAttribute("aria-expanded", "false");
        }
    });
}

function setupThemeSwitcher() {
    const themeButton = document.querySelector("#themeToggle");
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const startTheme = savedTheme || (prefersDark ? "dark" : "light");

    setTheme(startTheme);

    if (!themeButton) {
        return;
    }

    themeButton.addEventListener("click", () => {
        const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
        const nextTheme = currentTheme === "dark" ? "light" : "dark";

        setTheme(nextTheme);
        localStorage.setItem("theme", nextTheme);
    });
}

function setTheme(theme) {
    const themeButton = document.querySelector("#themeToggle");
    const isDark = theme === "dark";

    document.documentElement.dataset.theme = isDark ? "dark" : "light";

    if (themeButton) {
        themeButton.textContent = isDark ? "Темная тема" : "Светлая тема";
        themeButton.setAttribute("aria-pressed", String(isDark));
    }
}

function renderGuestPlaceholders() {
    const boardsContainer = document.querySelector("#selectBoards");
    const linksContainer = document.querySelector(".links__container");

    if (boardsContainer) {
        boardsContainer.dataset.selectedBoard = "";
        boardsContainer.innerHTML = `
            <div class="empty-state empty-state--boards">
                <div class="empty-state__icon">+</div>
                <h4>Здесь будут ваши доски</h4>
                <p>Войдите в аккаунт, чтобы создавать папки и быстро раскладывать ссылки по темам.</p>
                <a href="/login">Войти</a>
            </div>
        `;
    }

    if (linksContainer) {
        linksContainer.innerHTML = `
            <div class="empty-state empty-state--links">
                <div class="empty-state__icon">↗</div>
                <div>
                    <h4>Здесь будут ваши ссылки</h4>
                    <p>После входа вы сможете сохранять ссылки, давать им названия и открывать их из выбранной доски.</p>
                    <div class="empty-state__actions">
                        <a href="/login">Войти</a>
                        <a href="/register">Создать аккаунт</a>
                    </div>
                </div>
            </div>
        `;
    }
}


// ====================
// СОЗДАНИЕ ДОСКИ
// ====================

document.querySelector("#boards").addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.querySelector("#addBoard").value.trim();

    if (!name || name.length > 100) {
        alert("Название доски должно быть от 1 до 100 символов");
        return;
    }

    try {
        const response = await fetch("/boards", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            throw new Error("Ошибка создания доски");
        }

        const data = await response.json();

        console.log("Создана:", data);

        document.querySelector("#boards").reset();

        await loadBoards();
        await loadLinks();

    } catch (error) {
        console.log(error);
    }
});


// ====================
// ПОЛУЧЕНИЕ ДОСОК
// ====================

async function loadBoards() {
    try {
        const response = await fetch("/boards");

        if (!response.ok) {
            throw new Error("Ошибка загрузки досок");
        }

        const data = await response.json();

        const container = document.querySelector("#selectBoards");

        container.innerHTML = "";

        // Если досок вообще нет
        if (data.boards.length === 0) {
            container.dataset.selectedBoard = "";
            container.innerHTML = `
                <div class="empty-state empty-state--boards">
                    <div class="empty-state__icon">+</div>
                    <h4>Досок пока нет</h4>
                    <p>Создайте первую доску, чтобы разложить ссылки по темам.</p>
                </div>
            `;
            return;
        }

        data.boards.forEach((board, index) => {

            const boardItem = document.createElement("div");
            const button = document.createElement("button");
            const actions = document.createElement("div");
            const editButton = createIconButton("Изменить доску", "./img/Изменить.png");
            const deleteButton = createIconButton("Удалить доску", "./img/Удалить.png", "danger");

            boardItem.classList.add("board-item");
            actions.classList.add("board-item__actions");
            button.classList.add("board-item__select");

            button.type = "button";
            button.textContent = board.name;

            // Сохраняем ID доски прямо в кнопке
            button.dataset.boardId = board.id;


            // Первую доску выбираем автоматически
            if (index === 0) {
                container.dataset.selectedBoard = board.id;
                boardItem.classList.add("active");
            }


            // Нажатие на доску
            button.addEventListener("click", async () => {

                // Сохраняем выбранную доску
                container.dataset.selectedBoard = board.id;


                // Убираем active у остальных
                container.querySelectorAll(".board-item").forEach(item => {
                    item.classList.remove("active");
                });


                // Добавляем active выбранной
                boardItem.classList.add("active");


                // Получаем её ссылки
                await loadLinks();
            });

            editButton.addEventListener("click", async () => {
                const values = await openEditDialog({
                    title: "Изменить доску",
                    submitText: "Сохранить",
                    fields: [
                        {
                            name: "name",
                            label: "Название",
                            value: board.name
                        }
                    ]
                });

                if (!values) {
                    return;
                }

                await updateBoard(board.id, values.name);
            });

            deleteButton.addEventListener("click", async () => {
                const isConfirmed = await openConfirmDialog({
                    title: "Удалить доску?",
                    text: `Доска "${board.name}" и все ссылки внутри будут удалены.`,
                    submitText: "Удалить"
                });

                if (!isConfirmed) {
                    return;
                }

                await deleteBoard(board.id);
            });

            actions.append(editButton, deleteButton);
            boardItem.append(button, actions);
            container.appendChild(boardItem);
        });

        console.log("Доски:", data.boards);

    } catch (error) {
        console.log(error);
    }
}


// ====================
// ПОЛУЧЕНИЕ ССЫЛОК
// ====================

async function loadLinks() {
    try {

        const container = document.querySelector("#selectBoards");

        const linksContainer = document.querySelector(".links__container")
        linksContainer.textContent = "";

        const boardId = container.dataset.selectedBoard;


        // Если досок нет
        if (!boardId) {
            console.log("Нет выбранной доски");
            return;
        }


        const response = await fetch(`/links?boardId=${boardId}`);


        if (!response.ok) {
            throw new Error("Ошибка загрузки ссылок");
        }

        const data = await response.json();

        linksContainer.textContent = "";
        if (data.links.length === 0) {
            linksContainer.innerHTML = `
                <div class="empty-state empty-state--links">
                    <div class="empty-state__icon">↗</div>
                    <div>
                        <h4>Ссылок пока нет</h4>
                        <p>Добавьте первую ссылку через форму выше, и она появится в этой доске.</p>
                    </div>
                </div>
            `;
            return;
        }

        data.links.forEach(e => {

            const container = document.createElement("div");
            const favicon = document.createElement("img");
            const link = document.createElement("div");
            const linkH = document.createElement("h4");
            const linkAH = document.createElement("a")
            const linkA = document.createElement("a")
            const moreButton = document.createElement("button");
            const settings = document.createElement("div");
            const editButton = createIconButton("Изменить ссылку", "./img/Изменить.png");
            const deleteButton = createIconButton("Удалить ссылку", "./img/Удалить.png", "danger");

            container.classList.add("container", "link-card");
            link.classList.add("link-card__content");
            favicon.classList.add("link-card__icon");
            moreButton.classList.add("link-card__more");
            settings.classList.add("link-card__settings");

            moreButton.type = "button";
            moreButton.textContent = "⋯";
            moreButton.title = "Действия со ссылкой";
            moreButton.setAttribute("aria-label", "Действия со ссылкой");
            moreButton.setAttribute("aria-expanded", "false");

            const normalizedUrl = normalizeLinkUrl(e.url);
            const linkHost = getLinkHost(normalizedUrl);

            favicon.src = getFaviconUrl(normalizedUrl);
            favicon.alt = "";
            favicon.loading = "lazy";
            favicon.addEventListener("error", () => {
                favicon.replaceWith(createFaviconFallback(linkHost || e.title));
            });

            linkA.textContent = linkHost || e.url;
            linkAH.textContent = e.title;

            linkA.setAttribute("href", normalizedUrl);
            linkA.setAttribute("target", "_blank");
            linkA.setAttribute("rel", "noopener noreferrer");
            linkAH.setAttribute("href", normalizedUrl);
            linkAH.setAttribute("target", "_blank");
            linkAH.setAttribute("rel", "noopener noreferrer");

            editButton.addEventListener("click", async () => {
                const values = await openEditDialog({
                    title: "Изменить ссылку",
                    submitText: "Сохранить",
                    fields: [
                        {
                            name: "title",
                            label: "Заголовок",
                            value: e.title
                        },
                        {
                            name: "url",
                            label: "Ссылка",
                            value: e.url
                        }
                    ]
                });

                if (!values) {
                    return;
                }

                await updateLink(e.id, values.title, values.url);
            });

            deleteButton.addEventListener("click", async () => {
                const isConfirmed = await openConfirmDialog({
                    title: "Удалить ссылку?",
                    text: `Ссылка "${e.title}" будет удалена.`,
                    submitText: "Удалить"
                });

                if (!isConfirmed) {
                    return;
                }

                await deleteLink(e.id);
            });

            moreButton.addEventListener("click", (event) => {
                event.stopPropagation();

                const willOpen = !container.classList.contains("actions-open");

                closeLinkActionsMenus(container);
                container.classList.toggle("actions-open", willOpen);
                moreButton.setAttribute("aria-expanded", String(willOpen));
            });

            linkH.append(linkAH)
            link.append(linkH)
            link.append(linkA)
            settings.append(editButton, deleteButton)
            container.append(favicon);
            container.append(link);
            container.append(moreButton);
            container.append(settings)
            linksContainer.append(container)
        })

        console.log("Ссылки:", data);

    } catch (error) {
        console.log(error);
    }
}

function normalizeLinkUrl(url) {
    if (/^https?:\/\//i.test(url)) {
        return url;
    }

    return `https://${url}`;
}

function getLinkHost(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch (error) {
        return "";
    }
}

function getFaviconUrl(url) {
    const host = getLinkHost(url);

    if (!host) {
        return "";
    }

    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

function createFaviconFallback(text) {
    const fallback = document.createElement("div");
    const firstLetter = (text || "?").trim().charAt(0).toUpperCase();

    fallback.classList.add("link-card__icon", "link-card__icon--fallback");
    fallback.textContent = firstLetter || "?";

    return fallback;
}

function createIconButton(label, iconSrc, variant = "") {
    const button = document.createElement("button");
    const icon = document.createElement("img");

    button.type = "button";
    button.classList.add("icon-action");
    button.title = label;
    button.setAttribute("aria-label", label);

    if (variant) {
        button.classList.add(`icon-action--${variant}`);
    }

    icon.src = iconSrc;
    icon.alt = "";
    button.append(icon);

    return button;
}

async function updateBoard(boardId, name) {
    const nextName = name.trim();

    if (nextName.length < 1 || nextName.length > 100) {
        alert("Название доски должно быть от 1 до 100 символов");
        return;
    }

    try {
        const response = await fetch(`/boards/${boardId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: nextName
            })
        });

        if (!response.ok) {
            throw new Error("Ошибка изменения доски");
        }

        await loadBoards();
        await loadLinks();
    } catch (error) {
        console.log(error);
        alert("Не удалось изменить доску");
    }
}

async function deleteBoard(boardId) {
    try {
        const response = await fetch(`/boards/${boardId}`, {
            method: "DELETE"
        });

        if (!response.ok) {
            throw new Error("Ошибка удаления доски");
        }

        await loadBoards();
        await loadLinks();
    } catch (error) {
        console.log(error);
        alert("Не удалось удалить доску");
    }
}

async function updateLink(linkId, title, url) {
    const nextTitle = title.trim();
    const nextUrl = normalizeLinkUrl(url.trim());

    if (nextTitle.length < 1 || nextTitle.length > 200) {
        alert("Заголовок ссылки должен быть от 1 до 200 символов");
        return;
    }

    if (!isValidUrl(nextUrl) || nextUrl.length > 2048) {
        alert("Введите корректную ссылку длиной до 2048 символов");
        return;
    }

    try {
        const response = await fetch(`/links/${linkId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: nextTitle,
                url: nextUrl
            })
        });

        if (!response.ok) {
            throw new Error("Ошибка изменения ссылки");
        }

        await loadLinks();
    } catch (error) {
        console.log(error);
        alert("Не удалось изменить ссылку");
    }
}

async function deleteLink(linkId) {
    try {
        const response = await fetch(`/links/${linkId}`, {
            method: "DELETE"
        });

        if (!response.ok) {
            throw new Error("Ошибка удаления ссылки");
        }

        await loadLinks();
    } catch (error) {
        console.log(error);
        alert("Не удалось удалить ссылку");
    }
}

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}

function openEditDialog({ title, submitText, fields }) {
    return openActionDialog({
        title,
        submitText,
        variant: "primary",
        content: fields.map((field) => `
            <label class="action-modal__field">
                <span>${field.label}</span>
                <input type="text" name="${field.name}" value="${escapeHtml(field.value)}">
            </label>
        `).join(""),
        onSubmit: (form) => {
            const values = {};

            fields.forEach((field) => {
                values[field.name] = form.elements[field.name].value;
            });

            return values;
        }
    });
}

function openConfirmDialog({ title, text, submitText }) {
    return openActionDialog({
        title,
        submitText,
        variant: "danger",
        content: `<p class="action-modal__text">${escapeHtml(text)}</p>`,
        onSubmit: () => true
    });
}

function openActionDialog({ title, content, submitText, variant, onSubmit }) {
    return new Promise((resolve) => {
        const modal = document.createElement("div");

        modal.classList.add("action-modal");
        modal.innerHTML = `
            <div class="action-modal__panel" role="dialog" aria-modal="true">
                <form class="action-modal__form">
                    <div class="action-modal__head">
                        <h3>${escapeHtml(title)}</h3>
                        <button type="button" class="action-modal__close" aria-label="Закрыть">×</button>
                    </div>
                    <div class="action-modal__body">
                        ${content}
                    </div>
                    <div class="action-modal__actions">
                        <button type="button" class="action-modal__cancel">Отмена</button>
                        <button type="submit" class="action-modal__submit action-modal__submit--${variant}">
                            ${escapeHtml(submitText)}
                        </button>
                    </div>
                </form>
            </div>
        `;

        const close = (value) => {
            modal.remove();
            document.removeEventListener("keydown", onKeyDown);
            resolve(value);
        };

        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                close(null);
            }
        };

        modal.addEventListener("click", (event) => {
            if (event.target === modal) {
                close(null);
            }
        });

        modal.querySelector(".action-modal__close").addEventListener("click", () => close(null));
        modal.querySelector(".action-modal__cancel").addEventListener("click", () => close(null));
        modal.querySelector(".action-modal__form").addEventListener("submit", (event) => {
            event.preventDefault();
            close(onSubmit(event.currentTarget));
        });

        document.addEventListener("keydown", onKeyDown);
        document.body.append(modal);

        const firstInput = modal.querySelector("input");

        if (firstInput) {
            firstInput.focus();
            firstInput.select();
        } else {
            modal.querySelector(".action-modal__submit").focus();
        }
    });
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ====================
// ДОБАВЛЕНИЕ ССЫЛКИ
// ====================

document.querySelector("#addLink").addEventListener("submit", async (e) => {
    e.preventDefault();


    const container = document.querySelector("#selectBoards");

    const boardId = container.dataset.selectedBoard;

    const url = normalizeLinkUrl(document.querySelector("#inpunL").value.trim());
    const title = document.querySelector("#inpunH").value.trim();


    if (!boardId) {
        console.log("Сначала выбери доску");
        return;
    }


    if (!title || title.length > 200 || !isValidUrl(url) || url.length > 2048) {
        alert("Заполните заголовок и корректную ссылку");
        return;
    }


    try {

        const response = await fetch("/links", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                boardId,
                url,
                title
            })

        });


        if (!response.ok) {
            throw new Error("Ошибка добавления ссылки");
        }


        const data = await response.json();

        console.log("Ссылка добавлена:", data);


        document.querySelector("#addLink").reset();


        await loadLinks();

    } catch (error) {
        console.log(error);
        alert("Не удалось добавить ссылку");
    }
});
