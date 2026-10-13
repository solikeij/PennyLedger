<?php
// Purpose: Open the MySQL connection shared by the API controllers.
// Used by public/index.php and the CLI admin script; this file creates $conn.

// REVISED from config/db.php in the archive.
// One connection is shared by every controller. Configure these values in the
// server environment so local and deployed installations use the same code.

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$dbHost = getenv('DB_HOST') ?: '127.0.0.1';
$dbPort = (int) (getenv('DB_PORT') ?: 3307);
$dbName = getenv('DB_NAME') ?: 'PersonalBudget_db';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPassword = getenv('DB_PASSWORD') ?: '';

try {
    $conn = mysqli_connect($dbHost, $dbUser, $dbPassword, $dbName, $dbPort);
    mysqli_set_charset($conn, 'utf8mb4');
} catch (mysqli_sql_exception $exception) {
    // Keep connection details in the server log, never in the JSON response.
    error_log($exception->getMessage());
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed',
    ]);
    exit;
}
