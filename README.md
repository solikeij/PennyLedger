# PennyLedger

**Take control of your money, one penny at a time.**

PennyLedger is a personal budget and expense tracker built with React, PHP, and MySQL. It helps students, working professionals, and everyday savers organize their records and make informed spending decisions in one workspace.

## Purpose

Record what comes in, understand what goes out, and plan toward the goals that matter to you. PennyLedger brings transactions, monthly budgets, wallets, and savings goals together so your next financial decision starts with a clearer picture.

## Features

- **Track income and expenses:** Record transactions, search history, and filter by category, type, or month. Income amounts appear in green and expenses in red.
- **Plan monthly spending:** Set a monthly limit, monitor spending, and see a reminder when a new or edited expense would exceed the budget.
- **Organize wallets:** Name your cash, digital wallets, and cards, then associate transactions with their payment methods.
- **Build savings habits:** Set a savings target and date, record contributions, and follow your progress.
- **Review your progress:** Explore spending insights, generate reports, and export records for later review.
- **Manage your account:** Update profile details and photos, change passwords, and view private activity history.
- **Administer the system:** Manage users, account statuses, registration settings, and login/signup events.

Access controls include password hashing, email verification, expiring sessions, and checks that personal records belong to the signed-in user. PennyLedger records transactions manually; it does not connect to banks or move money.

## Run locally

Requires Node.js 22.12 or newer, PHP 8.2 with MySQLi, MySQL/MariaDB, and Apache (for example, XAMPP).

1. Place the project in `htdocs/PennyLedger-merged` and start Apache and MySQL.
2. For a **new database**, import `config/PersonalBudget_db.sql`. This creates the schema, default lookup data, and the demo accounts below. **The file drops the existing database; do not import it over records you want to keep.** For an existing compatible installation, back up the database and run `php scripts/migrate.php` instead.
3. Configure PHP's `DB_*` environment settings as shown in `.env.example`. Defaults are host `127.0.0.1`, port `3307`, database `PersonalBudget_db`, user `root`, and an empty password.
4. Copy the `VITE_API_BASE_URL` setting from `.env.example` to `.env.local`. Its default API URL is `http://localhost/PennyLedger-merged/public/index.php`. PHP settings must be set in the server environment; PHP does not read `.env.local`.
5. Install the PHP and React dependencies, then start React:

```powershell
composer install
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/PennyLedger-merged/`. If the project folder changes, update the API URL and Vite's `base` path. If port 5173 is occupied, stop the earlier dev server before starting another.

For signup email verification, configure the `MAIL_*` server settings listed in `.env.example`. The demo accounts are already verified and do not need a verification email.

## Demo accounts

These accounts are created when the fresh-install SQL is imported. Pulling the repository alone does not create them in an existing database.

| Role | Email | Password |
| --- | --- | --- |
| Administrator | admin@example.com | admin123 |
| User | demo.user@example.com | DemoUser123! |

Use the regular Login page for the user account and Admin Sign In for the administrator. These credentials are for local demonstrations; remove the demo accounts before using the system with real users.

## Project structure and checks

- `src/`: React pages, components, shared state, and utilities.
- `public/index.php`: PHP API router.
- `controllers/` and `helpers/`: API operations, validation, authentication, and shared logic.
- `config/`: Database schema, migrations, and server configuration.
- `tests/`: Automated checks.

Run `npm test` to check the frontend and `npm run build` to produce `dist/`. Run `php tests/budget-performance.php` to check the PHP budget calculations. A deployed application also needs a PHP-capable server and database.
