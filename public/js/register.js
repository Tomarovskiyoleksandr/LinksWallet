const form = document.querySelector('#registerForm');
const codeForm = document.querySelector('#codeForm');
const usernameInput = document.querySelector('#username');
const emailInput = document.querySelector('#email');
const authMessage = document.querySelector('#authMessage');
const codeMessage = document.querySelector('#codeMessage');
const codeValue = document.querySelector('#verificationCode');
const otpInputs = [...document.querySelectorAll('[data-otp] input')];
let submittingCode = false;

async function readJson(response) { const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Не удалось выполнить действие'); return data; }
function validate(username, email) { if (username.length < 3 || username.length > 30) return 'Имя должно содержать от 3 до 30 символов'; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Введите корректный email'; }
function clearCode() { otpInputs.forEach(input => input.value = ''); codeValue.value = ''; otpInputs[0].focus(); }
async function verifyCode() {
    if (submittingCode || codeValue.value.length !== 6) return;
    submittingCode = true; codeMessage.textContent = 'Проверяем код…';
    try { await readJson(await fetch('/verify-registration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: codeValue.value }) })); window.location.href = '/app'; }
    catch (error) { codeMessage.textContent = error.message; clearCode(); }
    finally { submittingCode = false; }
}
otpInputs.forEach((input, index) => {
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(-1); codeValue.value = otpInputs.map(item => item.value).join(''); if (input.value) otpInputs[index + 1]?.focus(); if (codeValue.value.length === 6) verifyCode(); });
    input.addEventListener('keydown', event => { if (event.key === 'Backspace' && !input.value) otpInputs[index - 1]?.focus(); });
    input.addEventListener('paste', event => { const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6); if (!digits) return; event.preventDefault(); otpInputs.forEach((item, i) => item.value = digits[i] || ''); codeValue.value = digits; otpInputs[Math.min(digits.length, 6) - 1].focus(); if (digits.length === 6) verifyCode(); });
});
codeForm.addEventListener('submit', event => { event.preventDefault(); verifyCode(); });
form.addEventListener('submit', async event => {
    event.preventDefault(); authMessage.textContent = '';
    const username = usernameInput.value.trim(); const email = emailInput.value.trim(); const error = validate(username, email);
    if (error) { authMessage.textContent = error; return; }
    try {
        await readJson(await fetch('/register-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email }) }));
        document.querySelector('#codeEmail').textContent = email;
        document.querySelector('#registerCard').hidden = true;
        document.querySelector('#codeCard').hidden = false;
        otpInputs[0].focus();
    } catch (error) { authMessage.textContent = error.message; }
});
