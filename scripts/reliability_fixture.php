<?php
// Used only by test_account_reliability.mjs. Never deletes the application database.
if (PHP_SAPI !== 'cli') exit(1);
require __DIR__ . '/../config/db.php';
$testName = $argv[2] ?? '';
if (!preg_match('/^pennyledger_test_[a-f0-9]{16}$/D', $testName)) throw new RuntimeException('Invalid test database name');
if ($testName === $dbName) throw new RuntimeException('Test database must differ from application database');
if (($argv[1] ?? '') === 'cleanup') {
    mysqli_query($conn, "DROP DATABASE IF EXISTS `{$testName}`");
    $photo = __DIR__ . '/../public/uploads/profile/' . str_repeat(substr($testName, -16), 2) . '.png';
    if (is_file($photo)) unlink($photo);
    exit;
}
mysqli_query($conn, "CREATE DATABASE `{$testName}` CHARACTER SET utf8mb4");
$test = mysqli_connect($dbHost, $dbUser, $dbPassword, $testName, $dbPort);
mysqli_set_charset($test, 'utf8mb4');
mysqli_query($test, 'SET FOREIGN_KEY_CHECKS=0');
foreach (mysqli_query($conn, 'SHOW TABLES') as $row) {
    $table = array_values($row)[0];
    $definition = mysqli_fetch_array(mysqli_query($conn, 'SHOW CREATE TABLE `' . str_replace('`', '``', $table) . '`'))[1];
    mysqli_query($test, $definition);
}
mysqli_query($test, 'SET FOREIGN_KEY_CHECKS=1');
// Exercise the new schema in the disposable database before touching real data.
mysqli_multi_query($test, file_get_contents(__DIR__ . '/../config/migrations/11_wallet_types_private_activity.sql'));
do { if ($result = mysqli_store_result($test)) mysqli_free_result($result); } while (mysqli_more_results($test) && mysqli_next_result($test));
$password = password_hash('TestPassword123!', PASSWORD_DEFAULT);
$users = [];
foreach (['user', 'other', 'admin'] as $kind) {
    $email = $kind . '@fixture.invalid';
    $role = $kind === 'admin' ? 'admin' : 'user';
    $stmt = mysqli_prepare($test, "INSERT INTO Users (first_name, last_name, email, password, email_verified, role, status, created_at) VALUES ('Fixture', ?, ?, ?, 1, ?, 'active', NOW())");
    mysqli_stmt_bind_param($stmt, 'ssss', $kind, $email, $password, $role); mysqli_stmt_execute($stmt);
    $id = mysqli_insert_id($test);
    $token = 'fixture-' . $kind . '-' . bin2hex(random_bytes(16));
    $hash = hash('sha256', $token);
    $stmt = mysqli_prepare($test, 'INSERT INTO Tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))');
    mysqli_stmt_bind_param($stmt, 'is', $id, $hash); mysqli_stmt_execute($stmt);
    $users[$kind] = ['id' => $id, 'token' => $token];
}
mysqli_query($test, "INSERT INTO TransactionTypes (type_name, code) VALUES ('Income', 'income'), ('Expense', 'expense')");
mysqli_query($test, "INSERT INTO Goal_Statuses (status_name, code) VALUES ('Active', 'active')");
$photoName = str_repeat(substr($testName, -16), 2) . '.png';
$photoPath = '/uploads/profile/' . $photoName;
$directory = __DIR__ . '/../public/uploads/profile';
if (!is_dir($directory)) mkdir($directory, 0755, true);
file_put_contents($directory . '/' . $photoName, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4AAAAABJRU5ErkJggg=='));
$id = $users['user']['id'];
$stmt = mysqli_prepare($test, 'UPDATE Users SET photo_path = ? WHERE user_id = ?');
mysqli_stmt_bind_param($stmt, 'si', $photoPath, $id); mysqli_stmt_execute($stmt);
// Optional tables from an upgraded installation must be cleaned as well.
$exists = mysqli_query($test, "SHOW TABLES LIKE 'pending_email_changes'");
if (mysqli_num_rows($exists)) {
    mysqli_query($test, "INSERT INTO Pending_Email_Changes (user_id, email, code_hash, expires_at, sent_at) VALUES ({$id}, 'pending@fixture.invalid', REPEAT('a', 64), 9999999999, 1)");
}
echo json_encode(['users' => $users, 'photoPath' => $photoPath]);
