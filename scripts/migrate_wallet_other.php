<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/../config/db.php';
mysqli_query($conn, "ALTER TABLE Wallets MODIFY kind ENUM('bank', 'digital', 'cash', 'other') NOT NULL");
echo "Other wallet type ready.\n";
