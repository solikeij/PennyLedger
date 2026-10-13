# PennyLedger — React + PHP/MySQL

This project has a React frontend (`src/`) and a PHP API (`public/index.php`).
The API uses MySQL for accounts, transactions, budgets, goals, and report logs.
The app has no built-in demo accounts or mail credentials.

## Database setup: choose one path

**Fresh, disposable database:** Import `config/PersonalBudget_db.sql` **once**.
It creates the final schema directly and
inserts lookup data. Its first statement is `DROP DATABASE IF EXISTS`; importing
it again destroys existing accounts and transactions.

**Existing installation from main or LATEST-UPDATE:** Back up the database, then
run `php scripts/migrate.php` with the same `DB_*` environment as the API.
This tracks applied migrations, including `10_account_reliability.sql` and
`11_wallet_types_private_activity.sql`. Do not import the fresh-install SQL over
existing accounts. Databases predating the original integration require their
original schema upgrade first; those old migration files are not in this branch.

Soft-deleted accounts keep their email reserved because `Users.email` is
unique. Signup now returns a clear conflict instead of a database error.
For an existing installation with the integration schema, run
`config/migrations/07_account_statuses.sql` once to add Inactive and Deleted
account states and place previously deleted users in the admin archive.

## Run the PHP API

Put this folder under XAMPP's `htdocs` and start Apache and MySQL. The API
entry point for this ZIP's folder name is:

`http://localhost/PennyLedger-merged/public/index.php`

`config/db.php` reads `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and
`DB_PASSWORD` from Apache/PHP environment variables. Its defaults are
`127.0.0.1`, port `3307`, database `PersonalBudget_db`, user `root`, and an
empty password. Change those values for your MySQL installation.

The first administrator is created from a terminal, after the schema exists:

```powershell
php scripts/create_admin.php FirstName LastName admin@example.com YourOwnPassword
```

This script does not create a fixed admin email or password. Use at least eight
characters for the password.

## Configure verification email

The server sends codes through PHPMailer using SMTP. `config/mail.php` reads
`MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, and `MAIL_FROM` from
the **Apache/PHP environment**. The ZIP intentionally contains no mail secret.
For XAMPP, set those variables in Apache configuration outside `htdocs`, then
stop and start Apache. The `.env.local` file is read by Vite, not PHP.

If SMTP fails during signup, the account is still created. The verification
screen now explains the failure and offers **Resend code**. The same option is
available from the sign-in and signup pages for an existing unverified account.
The backend limits successful resend requests to one per minute. Codes expire
after ten minutes. A mail error is logged in Apache's error log without sending
SMTP details to the browser.

## Run React

Install Node.js 22.12 or newer, open a terminal in this folder, and run:

```powershell
npm ci
npm run dev
```

Open the URL printed by Vite (normally
`http://127.0.0.1:5173/PennyLedger-merged/`). `.env.local` is prefilled for the XAMPP
path above and contains only `VITE_API_BASE_URL`. If your PHP URL differs, edit
that value and restart `npm run dev`. `src/lib/api.js` deliberately has no
fallback to a different backend folder. The API's `APP_ORIGIN` must match the
React origin (normally `http://127.0.0.1:5173`).

`npm run build` creates the React build in `dist/`. PHP/MySQL must still run on
a PHP-capable server; static hosting such as GitHub Pages only hosts React.

## What is connected

### Frontend budget controls and recent activity

Frontend spending analytics appear on Dashboard, Budget, and Reports. Estimates
use average expenses from up to three completed months with recorded transactions,
plus a 10% buffer rounded up to the display currency's whole unit. Incomplete
months and future-dated transactions are excluded from this estimate; archived
records remain part of financial totals. Spending pace assumes the current daily
average continues until month end. Suggestions never save a budget automatically.
The previous month's review can be downloaded in Reports; it is calculated on
page load and is not a scheduled email or a persisted report snapshot.

Wallets contain a name and expense type (a saved expense category or Other).
Transactions retain their payment-method reference but never change wallet values.
The dashboard shows income, expenses, budgeted and remaining budget; it no longer
calculates Total Balance. Wallet creation and editing update the list immediately
after a successful response. Legacy balance data is retained only for preservation;
balance transfers and reconciliation history endpoints return 410.

The Budget page can edit and delete existing budgets using `PUT /budgets/:id`
and `DELETE /budgets/:id`. The budget form now takes a month and one overall
spending limit. For compatibility with the current category-based API it sends
`category_name: "Monthly budget"`, `budget_amount`, `budget_period: "monthly"`,
and the selected month's start/end dates. The frontend calculates progress from
all expense transactions in that month, including archived transactions. When
an overall plan exists, dashboard/report totals exclude legacy category limits
for that month to avoid double counting. The backend team should support overall
monthly plans explicitly and calculate the same totals server-side. The UI
updates only after a successful API response.

Settings → Activity Logs uses authenticated `GET /activity-logs` records.
Successful ledger/profile writes, their activity entries, and POST replay responses
are committed together. Failed or replayed writes do not add duplicate history.
The page supports search, action/date filters and pagination, newest first.
Every query and count is scoped to the authenticated regular user; administrators
receive 403. Related-item labels remain visible after the item is deleted.
`GET /admin/activity-logs` is retired with 403. Admins use `/admin/auth-events`,
which returns only user, event type (LOGIN/SIGNUP), and timestamp from `Auth_Events`.
Other events are never copied to that store. Migration 11 moves legacy authentication
events into the restricted store and other legacy audit details into private history,
then clears the old global feed.

Transaction and report lists use `page` / `per_page` and return
`{ items, total, page, perPage }`. Report lists omit snapshots; opening a report
loads `GET /report-logs/:id`. Charts use server-aggregated daily category totals
from `GET /reports?type=ledger`, including archived transactions, so paging the
history never changes financial totals. Full JSON export explicitly loads all
pages and report details.

Account settings distinguish Archive (data/email retained, admin restoration)
from Permanently Delete (password and typed confirmation, dependent records and
photo removed, email released). The admin UI retains main's create-user,
status, archive, restore, and registration controls. Photo cleanup is queued transactionally
and retried after later successful requests if the filesystem is unavailable.

Run `php scripts/migrate.php` when upgrading; migration
`11_wallet_types_private_activity.sql` adds expense types and separates private
activity from authentication events. Apply it before serving the updated application.

- Registration, verification, resend, login/logout, and role checks
- User transactions, budgets, goals, contributions, and report logs
- Profile changes, password changes, photo upload, archive, and permanent deletion
- Admin user management, authentication events, and registration setting

The backend checks account ownership for user records. React's report snapshots
and CSV files are calculated from the transactions loaded for the signed-in
user. All user-panel amounts use Philippine pesos (PHP); theme and date format
remain browser preferences. There is no working two-factor authentication service.

## Verification and limits

The merged system keeps main's login/signup layout and report snapshots
(income breakdown, expense categories, cash-flow trends, comparisons, and budget
performance), plus LATEST-UPDATE's pagination, field errors, save recovery, and
private activity logs. Admin authentication events expose only LOGIN/SIGNUP,
user, and timestamp. Wallets are payment-method labels with expense types;
balances and transfers are no longer exposed. Legacy balance data stays stored.

Expected monthly income can be edited from Dashboard or Transaction history.
Weekly pay uses 52/12 and biweekly pay 26/12; the result is rounded to cents.
This planning estimate is separate from actual income transactions. Both frontend
and API validate transaction values and income estimates. Reports read the complete
ledger rather than only the visible transaction page.

Run `npm test` for the included API contract tests and `npm run build` for the
frontend build. PHP syntax can be checked with `php -l`. These checks do not
replace testing registration, SMTP delivery, login, CRUD, and admin access with
a disposable configured MySQL database. Add verification attempt limits before
exposing the public auth endpoints to the internet.

Account reliability integration checks: `node scripts/test_account_reliability.mjs`.
The script clones the configured schema into a uniquely named temporary database,
runs a local PHP server against it, exercises API mutations and cleanup, and removes
only that test database. It requires PHP on PATH and local MySQL database-creation
permission; it never deletes real user accounts.
