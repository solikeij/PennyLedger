<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../config/db.php';
mysqli_query($conn, 'CREATE TABLE IF NOT EXISTS Schema_Migrations (name VARCHAR(200) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
foreach (glob(__DIR__ . '/../config/migrations/*.sql') as $path) {
    $name = basename($path);
    $check = mysqli_prepare($conn, 'SELECT name FROM Schema_Migrations WHERE name = ?');
    mysqli_stmt_bind_param($check, 's', $name); mysqli_stmt_execute($check);
    if (mysqli_fetch_assoc(mysqli_stmt_get_result($check))) continue;
    mysqli_multi_query($conn, file_get_contents($path));
    do { if ($result = mysqli_store_result($conn)) mysqli_free_result($result); } while (mysqli_more_results($conn) && mysqli_next_result($conn));
    $insert = mysqli_prepare($conn, 'INSERT INTO Schema_Migrations (name) VALUES (?)');
    mysqli_stmt_bind_param($insert, 's', $name); mysqli_stmt_execute($insert);
    echo "Applied {$name}\n";
}
