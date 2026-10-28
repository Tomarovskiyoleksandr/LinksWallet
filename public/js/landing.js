fetch('/me', { credentials: 'same-origin' })
    .then(response => response.ok ? response.json() : null)
    .then(data => {
        if (!data?.user) return;
        document.querySelectorAll('[data-start]').forEach(link => {
            link.href = '/app';
            link.querySelector('[data-start-label]').textContent = 'Мои ссылки';
        });
        document.querySelectorAll('[data-guest]').forEach(element => { element.hidden = true; });
    })
    .catch(() => { /* The registration and login links remain available. */ });
