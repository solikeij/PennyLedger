<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../config/db.php';
$columns = mysqli_query($conn, "SHOW COLUMNS FROM Wallets LIKE 'deleted_at'");
if (!mysqli_num_rows($columns)) mysqli_query($conn, 'ALTER TABLE Wallets ADD COLUMN deleted_at DATETIME NULL');
echo "Wallet deletion storage ready.\n";
