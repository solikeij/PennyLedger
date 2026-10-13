<?php

// Editor-only declarations of route inputs supplied by public/index.php.
/** @var mysqli $conn */
/** @var string $method */

// GET /reports/budget-performance?month=10&year=2026; identity comes from bearer auth.
$currentUser = require_auth($conn);
if ($method !== 'GET')
    send_error('Method not allowed', 405);
$errors = [];
foreach (['month' => [1, 12], 'year' => [1900, 9998]] as $field => [$min, $max]) {
    $raw = $_GET[$field] ?? null;
    if (!is_string($raw) || !preg_match('/^[0-9]+$/D', $raw) || (int) $raw < $min || (int) $raw > $max) {
        $errors[$field] = "Enter a whole number between {$min} and {$max}";
    }
}
if ($errors)
    send_error('Choose a valid report month and year', 422, $errors);
$start = sprintf('%04d-%02d-01', (int) $_GET['year'], (int) $_GET['month']);
$end = (new DateTimeImmutable($start))->format('Y-m-t');
$userId = (int) $currentUser['user_id'];
require_once __DIR__ . '/../helpers/budget_performance.php';
// Read budgets and audit transactions from one database snapshot.
mysqli_begin_transaction($conn, MYSQLI_TRANS_START_READ_ONLY | MYSQLI_TRANS_START_WITH_CONSISTENT_SNAPSHOT);
try {
    $stmt = mysqli_prepare($conn, 'SELECT b.*, c.category_name FROM Budgets b JOIN Categories c ON c.category_id = b.category_id WHERE b.user_id = ? AND b.start_date <= ? AND b.end_date >= ? ORDER BY c.category_name, b.start_date, b.budget_id');
    mysqli_stmt_bind_param($stmt, 'iss', $userId, $end, $start);
    mysqli_stmt_execute($stmt);
    $budgets = mysqli_fetch_all(mysqli_stmt_get_result($stmt), MYSQLI_ASSOC);
    $stmt = mysqli_prepare($conn, "SELECT t.transaction_id, t.category_id, t.transaction_date, t.description, t.amount, t.archived, c.category_name, pm.payment_method_name FROM Transactions t JOIN TransactionTypes tt ON tt.transaction_type_id = t.transaction_type_id JOIN Categories c ON c.category_id = t.category_id LEFT JOIN Payment_Methods pm ON pm.payment_method_id = t.payment_method_id WHERE t.user_id = ? AND tt.code = 'expense' AND t.transaction_date BETWEEN ? AND ? ORDER BY t.transaction_date, t.transaction_id");
    mysqli_stmt_bind_param($stmt, 'iss', $userId, $start, $end);
    mysqli_stmt_execute($stmt);
    $transactions = mysqli_fetch_all(mysqli_stmt_get_result($stmt), MYSQLI_ASSOC);
    $report = build_budget_performance($budgets, $transactions, $start, $end);
    mysqli_commit($conn);
} catch (Throwable $exception) {
    mysqli_rollback($conn);
    throw $exception;
}
send_success($report);
