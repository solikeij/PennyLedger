# PennyLedger — React app

The original PennyLedger website converted into a React single-page app using Vite and React Router. The original green/blue design, light/dark themes, responsive layouts, typography, and three image assets are retained.

## Run locally

Install Node.js 22.12 or newer (Node 24 LTS is suitable), open a terminal in this folder, and run:

```sh
npm install
npm run dev
```

Open the local URL printed in your terminal, usually `http://127.0.0.1:5173`.

```sh
npm test         # Interaction and calculation tests
npm run build   # Production files in dist/
npm run preview # Preview the production build
npm run format  # Format source files
```

For a reproducible installation with the included lockfile, use `npm ci` instead of `npm install`.

The ZIP omits installed dependencies and generated builds; the commands above recreate them. Serve the app through Vite or a web server rather than opening `index.html` directly.

## Pages and original-file mapping

| Original file              | React replacement                                              | Route           |
| -------------------------- | -------------------------------------------------------------- | --------------- |
| `index.html`               | `src/pages/Home.jsx`                                           | `/`             |
| `login.html`               | `src/pages/Auth.jsx`                                           | `/login`        |
| `signup.html`              | `src/pages/Auth.jsx` with signup mode                          | `/signup`       |
| `dashboard.html`           | `src/pages/Dashboard.jsx`                                      | `/dashboard`    |
| `transactions.html`        | `src/pages/Transactions.jsx`                                   | `/transactions` |
| `budget.html`              | `src/pages/Budget.jsx`                                         | `/budget`       |
| `goals.html`               | `src/pages/Goals.jsx`                                          | `/goals`        |
| `reports.html`             | `src/pages/Reports.jsx`                                        | `/reports`      |
| `settings.html`            | `src/pages/Settings.jsx`                                       | `/settings`     |
| `archive.html`             | `src/pages/Archive.jsx`                                        | `/archive`      |
| `main.js` and page scripts | Shared React components, context, reducer, and utility modules | All pages       |
| `style.css`                | `src/style.css` plus `src/react.css`                           | All pages       |
| `assets/*`                 | `src/assets/*`                                                 | Bundled by Vite |

All ten legacy `.html` URLs redirect to the corresponding React routes, retaining query parameters. Folders named `config`, `controllers`, `helpers`, and `public` were excluded from the input migration as requested. No source files from those folders were used.

## Source structure

```text
src/
  main.jsx                 React entry point and BrowserRouter
  App.jsx                  Routes, legacy redirects, page titles
  components/
    Layout.jsx             Shared sidebar, top bar, navigation, search
    UI.jsx                 Icons, logo, switch, modal, form fields, progress
    Forms.jsx              Transaction, budget, goal, income forms
  pages/                   Page components listed above
  state/
    AppContext.jsx         Shared state, preferences, persistence
    data.js                Original demo budgets, goals, reports, chart series
    transactions.json      Original ten transaction records
  lib/
    format.js              Currency/date formatting, CSV, downloads, calculations
    reports.js             Report snapshots and report-specific CSV rows
  assets/                  Original hero PNG and two logo SVGs
  style.css                Original design system
  react.css                React layout adjustments, dialogs, print styles
tests/
  app.test.jsx             Pages, navigation, forms, archives, storage, exports
  setup.js                 Test environment
```

## Behavior preserved and completed

- Light/dark theme, USD/PHP/EUR display, and the three date formats.
- Mobile sidebar, active navigation, password visibility, landing animations, modals, progress bars, and notifications.
- Signup/password validation and demo login/logout.
- Transaction search, category/month/type filters, archiving, and restoration.
- Budget creation and duplicate-category validation; monthly income estimation.
- Goal creation/editing and progress calculations.
- Four report types, period selection, report logs, CSV download, and printing.
- Profile/preferences, data export, archive access, and demo deletion confirmation.

During conversion, formerly isolated DOM updates were connected through shared React state: adding a transaction now updates the dashboard, transaction list, and matching budget. Budgets and goals appear across their pages and reports. Generated reports are saved as snapshots and can actually be viewed from logs. CSV exports contain the selected report; the full JSON export contains the app's actual local data. Budget summaries are calculated from the category records rather than the original inconsistent hardcoded totals. User-entered text is rendered through React rather than inserted as HTML.

## Admin and user accounts

Use the separate sign-in portals with these dummy accounts:

| Role                 | Email                  | Password  | Sign-in route |
| -------------------- | ---------------------- | --------- | ------------- |
| Administrator        | admin@pennyledger.demo | Admin123! | /admin/login  |
| User (sample ledger) | alex@email.com         | User123!  | /login        |
| User (empty ledger)  | jamie@pennyledger.demo | User123!  | /login        |

The admin area includes an overview at /admin, user management at /admin/users, the latest 200 account events at /admin/activity, and registration controls at /admin/settings. Administrators can create users, edit names and email addresses, set a new password through Edit, and suspend or restore access with confirmation. Admin accounts cannot be modified through user management. Suspended users cannot sign in; their data is retained.

Signup creates a user account with an empty ledger. Each account has separate transactions, budgets, goals, profile, income, and report snapshots. Existing data from the original demo is imported only into Alex's account. Logout clears the current tab's session. Signed-in users are redirected away from the wrong role's routes.

## Demo data and persistence

This remains a front-end demo with no server, database, secure authentication service, real account deletion, bank connection, or implemented two-factor authentication. Admin password resets work for local accounts; the user settings password form remains a demonstration. Newly entered passwords are stored as salted SHA-256 verifiers rather than plaintext; published dummy credentials are included in the source. This is not production password storage or authorization: browser data and route checks can be altered locally. Use dummy information only. Production deployment needs server-side authentication, authorization, and account-scoped storage. Security promises in the original landing-page copy are inherited marketing text, not implemented guarantees.

Profile, transactions, budgets, goals, income estimates, and report snapshots are stored in this browser under `pennyledger_react_v1_<account-id>`. Account records and activity use `pennyledger_accounts_v1`; the current account ID uses `pennyledger_session_v1` in sessionStorage. Preferences use the original `pennyledger_theme`, `pennyledger_currency`, and `pennyledger_dateformat` keys. Existing original archive flags are imported on first launch if available on the same origin. Browser storage is origin-specific and is not shared between users, devices, ports, or deployments. If storage is unavailable, the app continues in memory.

Changing currency changes display symbols only; there is no exchange-rate conversion. Historical income/expense and category reports retain the original sample series; they are not an accounting history calculated from all transactions. Budget and goal reports use current shared-state snapshots. The H1 sample only contains March–June records because the original source has no January–February monthly series. Alex?s dashboard opening totals and growth badges retain demo values; other users start with zero opening balances; newly entered transactions adjust its balance and expense figures. Archiving hides records but does not undo their financial amounts.

The original footer links for company/support/legal destinations remain placeholders. Google Fonts requires internet access; system-font fallbacks are included.

## Hosting

Run `npm run build` and host the contents of `dist/`. Configure the host to return `index.html` for unknown application paths so direct visits and reloads of `/dashboard`, `/reports`, and legacy `.html` URLs work. This project defaults to the domain root; subdirectory hosting needs matching Vite `base` and BrowserRouter `basename` settings.

## Verification

The included tests cover admin route guards, credential checks, user creation/editing, password resets, suspension/restoration, registration controls, isolated ledgers, all ten client pages, legacy redirects, preference persistence, transaction creation and archive restoration, budget validation, safe text rendering, goal edits, report generation/restoration, signup validation, date formatting, income estimates, and CSV generation.

Build setup references: [React app setup](https://react.dev/learn/build-a-react-app-from-scratch) and [Vite guide](https://vite.dev/guide/).
