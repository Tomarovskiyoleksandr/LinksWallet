# LinksWallet

Сервис для хранения ссылок по папкам. Вход выполняется по одноразовому коду из email. Интеграции Google и Apple отключены, внешние сервисы favicon не используются.

## Локальная разработка

Нужен Node.js 20 или новее.

```bash
npm install
npm run dev
```

Откройте `http://127.0.0.1:3000`. Локальная БД работает в памяти, код подтверждения — `123456`, демо-аккаунт — `demo@example.com`. Данные сбрасываются после перезапуска.

Проверки:

```bash
npm test
npm --prefix server audit
```

## Деплой на Oracle Cloud VPS

На Ubuntu установите Node.js 20+, PostgreSQL и Nginx. Затем:

```bash
npm ci
cp server/.env.example server/.env
nano server/.env
npm --prefix server run migrate
sudo npm install -g pm2
pm2 start server/server.js --name linkswallet
pm2 save
pm2 startup
```

Заполните в `server/.env` адрес PostgreSQL, SMTP и случайный `SESSION_SECRET` длиной не менее 32 символов. Приложение слушает `127.0.0.1:3000`; наружу его следует публиковать через Nginx с HTTPS. Пример виртуального хоста находится в `deploy/nginx.conf.example`.

В Oracle Security List/NSG и UFW откройте только `22`, `80` и `443`. Порты `3000` и `5432` наружу открывать не нужно. Резервная копия PostgreSQL:

```bash
pg_dump -U linkswallet linkswallet > linkswallet-backup.sql
```
