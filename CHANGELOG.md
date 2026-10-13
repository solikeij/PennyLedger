# PennyLedger changes — October 11, 2026

- Fixed the PHP database configuration syntax error and local development CORS.
  Updated the sample API URL and database-port configuration.
- Added budget editing and deletion, then changed Budget Process to one overall
  spending limit per selected month. Progress includes all monthly expenses,
  including archived transactions, without double-counting legacy category limits.
- Added dashboard Total Budgeted, clearer total descriptions, payment methods in
  transaction history, and a per-account browser Recent Activity feed.
- Added goal contribution dialogs so users can add money separately from editing
  goal details, including access from the dashboard.
- Made profile photo and currency changes wait for Save Changes, with a Discard
  Changes action. Text fields continue to save on submission.
- Expanded landing-page content, corrected Home/Features/Security navigation for
  hash routing, and replaced unsupported security and usage claims.
- Added dummy-account cards beneath login/signup introductions, responsive layouts,
  light/dark borders, and consistent full-width authentication buttons.
- Restyled verification email with green branding, embedded artwork, personalized
  greetings, date badges, a readable code, and a plain-text alternative. Added a
  local preview script that sends no email.
- Improved report archive/restore status handling, pending controls, and visible
  error feedback.
- Added spending adjustment alerts, estimates based on up to three completed
  months plus a 10% buffer, and a downloadable previous-month review. Estimates
  can prefill the budget form; the user must confirm the budget.
- Updated selected-wallet balances after successful transaction saves, followed
  by an authoritative API refresh.
- Added regression tests and backend integration notes in README.

## Local setup and integration limits

Apache's local folder mapping and SMTP credentials were configured outside the
repository. Credentials, uploaded user files, test output, and generated preview
HTML are excluded from this publication. The earlier login/signup background and
peso decoration were undone at the user's request.

Recent Activity is stored in the current browser per account. Month-end reviews
are computed when Reports is opened and downloaded manually. Durable wallet
updates, overall monthly budget support, persistent activity, and scheduled report
delivery remain backend responsibilities. The missing Write_Requests table was
identified; the backend team must apply config/migrations/06_requests.sql.

Validation: 28 automated tests, frontend production build, PHP syntax checks for
the changed mail/authentication files, and verification-email MIME preview checks.
