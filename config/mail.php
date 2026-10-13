<?php
// Purpose: Read SMTP settings from the server environment.
// Used by helpers/mailer.php; keep real mail passwords out of source code.

// REVISED from config/mail.php. The archive contained a literal mail password.
// Set these variables in Apache/PHP; this file intentionally has no secret.

define('MAIL_HOST', getenv('MAIL_HOST') ?: 'smtp.gmail.com');
define('MAIL_PORT', (int) (getenv('MAIL_PORT') ?: 587));
define('MAIL_USERNAME', getenv('MAIL_USERNAME') ?: '');
define('MAIL_PASSWORD', str_replace(' ', '', getenv('MAIL_PASSWORD') ?: ''));
define('MAIL_FROM', getenv('MAIL_FROM') ?: MAIL_USERNAME);
define('MAIL_FROM_NAME', getenv('MAIL_FROM_NAME') ?: 'PennyLedger');
