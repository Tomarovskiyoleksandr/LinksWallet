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

### Проверка миграции на отдельной PostgreSQL-базе

Никогда не указывайте рабочую базу. Тест дополнительно откажется запускаться, если имя базы не заканчивается на `_test` или если в ней уже существует таблица `users`.

На тестовом VPS создайте отдельную пустую базу и отдельного пользователя PostgreSQL:

```bash
sudo -u postgres createuser --pwprompt linkswallet_migration_test
sudo -u postgres createdb --owner=linkswallet_migration_test linkswallet_migration_test
export TEST_DATABASE_URL='postgresql://linkswallet_migration_test:ТЕСТОВЫЙ_ПАРОЛЬ@127.0.0.1:5432/linkswallet_migration_test'
npm --prefix server run test:postgres-migration
unset TEST_DATABASE_URL
```

Тест применяет `001–005`, создаёт только вымышленные аккаунты с Argon2id-паролями, проверяет отказ `006` при конфликте регистра email, затем проверяет сохранность пользователей, хешей паролей, TOTP-полей, доверенных устройств, досок и ссылок после успешного обновления. После проверки тестовую базу можно удалить:

```bash
sudo -u postgres dropdb linkswallet_migration_test
sudo -u postgres dropuser linkswallet_migration_test
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
