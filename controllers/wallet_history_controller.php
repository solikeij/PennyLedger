<?php

// Editor-only declaration of the database connection supplied by public/index.php.
/** @var mysqli $conn */

require_auth($conn);
send_error('Wallet balances and transfers are no longer supported', 410);
