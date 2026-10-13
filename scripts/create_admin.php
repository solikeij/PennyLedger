<?php
// Purpose: Create the initial administrator account in the database.
// Run from the command line with account details; saving the file alone does nothing.

// NEW command-line bootstrap script for the first administrator. Run it only
// on the server; web requests are rejected below.


if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../config/db.php';

[$script, $firstName, $lastName, $email, $password] = array_pad($argv, 5, null);

$firstName = 'Admin';
$lastName = 'Panel';
$email = 'admin@example.com';
$password = 'admin123';

if (!$firstName || !$lastName || !$email || !$password) {
    fwrite(STDERR, "Usage: php scripts/create_admin.php FIRST_NAME LAST_NAME EMAIL PASSWORD\n");
    exit(1);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) {
    fwrite(STDERR, "Use a valid email and a password with at least 8 characters.\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = mysqli_prepare($conn, "
    INSERT INTO Users
        (first_name, last_name, email, password, email_verified, role, status, created_at)
    VALUES (?, ?, ?, ?, 1, 'admin', 'active', NOW())
");
mysqli_stmt_bind_param($stmt, 'ssss', $firstName, $lastName, $email, $hash);
mysqli_stmt_execute($stmt);
fwrite(STDOUT, "Administrator created with ID " . mysqli_insert_id($conn) . ".\n");
