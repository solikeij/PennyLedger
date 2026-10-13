<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../config/db.php';
mysqli_query($conn, file_get_contents(__DIR__ . '/../config/migrations/04_wallet_transfers.sql'));
echo "Wallet transfers ready. Existing wallet amounts are opening balances.\n";
