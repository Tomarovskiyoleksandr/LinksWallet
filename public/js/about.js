// Keep navigation useful both for guests and for an existing session.
fetch("/me", { credentials: "same-origin" })
    .then(response => response.ok ? response.json() : null)
    .then(data => {
        if (!data?.user) return;
        document.querySelectorAll("[data-account-link]").forEach(link => {
            link.textContent = "Мои ссылки";
            link.href = "/app";
        });
    })
    .catch(() => { /* The regular login link also works without this request. */ });
