<?php
// Add wallet storage to an existing database without changing existing records.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../config/db.php';
mysqli_query($conn, file_get_contents(__DIR__ . '/../config/migrations/03_wallets.sql'));
echo "Wallet storage ready.\n";
