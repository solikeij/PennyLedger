<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../config/db.php';
require __DIR__ . '/../helpers/wallets.php';
$columns = mysqli_query($conn, "SHOW COLUMNS FROM Wallets LIKE 'is_default'");
if (!mysqli_num_rows($columns)) mysqli_query($conn, 'ALTER TABLE Wallets ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0');
$users = mysqli_fetch_all(mysqli_query($conn, 'SELECT user_id FROM Users'), MYSQLI_ASSOC);
foreach ($users as $user) ensure_physical_money($conn, (int) $user['user_id']);
echo "Physical money wallets ready.\n";
