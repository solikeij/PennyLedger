<?php
// Purpose: Return read-only choices for categories, types, payments, and goal statuses.
// Used by GET /lookups/{name} to populate React form selections.

// Editor-only declarations of route inputs supplied by public/index.php.
/** @var mysqli $conn */
/** @var string $method */
/** @var string $lookup */

// REVISED from controllers/lookups_controller.php. The UI can load category,
// type, payment, and goal-status choices with IDs and human-readable names.

if ($method !== 'GET') send_error('Method not allowed', 405);

$queries = [
    // Static query choices prevent a route name from becoming SQL text.
    'transaction-types' => "SELECT transaction_type_id AS id, type_name AS name, code FROM TransactionTypes ORDER BY transaction_type_id",
    'categories' => "SELECT c.category_id AS id, c.category_name AS name, c.transaction_type_id AS transactionTypeId, tt.code AS type FROM Categories c JOIN TransactionTypes tt ON tt.transaction_type_id = c.transaction_type_id ORDER BY c.category_name",
    'payment-methods' => "SELECT payment_method_id AS id, payment_method_name AS name FROM Payment_Methods ORDER BY payment_method_name",
    'goal-statuses' => "SELECT status_id AS id, status_name AS name, code FROM Goal_Statuses ORDER BY status_id",
];

if (!isset($queries[$lookup])) send_error('Lookup not found', 404);
if ($lookup === 'categories') {
    $user = require_auth($conn);
    $userId = (int) $user['user_id'];
    // Suggest only categories this account has saved, never seeded defaults
    // or categories used exclusively by another account.
    $stmt = mysqli_prepare($conn, 'SELECT c.category_id AS id, c.category_name AS name, c.transaction_type_id AS transactionTypeId, tt.code AS type FROM Categories c JOIN TransactionTypes tt ON tt.transaction_type_id = c.transaction_type_id WHERE EXISTS (SELECT 1 FROM Transactions t WHERE t.category_id = c.category_id AND t.user_id = ?) OR EXISTS (SELECT 1 FROM Budgets b WHERE b.category_id = c.category_id AND b.user_id = ?) ORDER BY c.category_name');
    mysqli_stmt_bind_param($stmt, 'ii', $userId, $userId);
    mysqli_stmt_execute($stmt);
    $rows = mysqli_fetch_all(mysqli_stmt_get_result($stmt), MYSQLI_ASSOC);
} elseif ($lookup === 'payment-methods') {
    $user = require_auth($conn);
    $userId = (int) $user['user_id'];
    $stmt = mysqli_prepare($conn, 'SELECT w.payment_method_id AS id, w.name FROM Wallets w WHERE w.user_id = ? AND w.deleted_at IS NULL ORDER BY w.is_default DESC, w.name');
    mysqli_stmt_bind_param($stmt, 'i', $userId);
    mysqli_stmt_execute($stmt);
    $rows = mysqli_fetch_all(mysqli_stmt_get_result($stmt), MYSQLI_ASSOC);
} else {
    $rows = mysqli_fetch_all(mysqli_query($conn, $queries[$lookup]), MYSQLI_ASSOC);
}

// Convert database ID strings to numbers before returning JSON to React.
foreach ($rows as &$row) {
    $row['id'] = (int) $row['id'];
    if (isset($row['transactionTypeId'])) $row['transactionTypeId'] = (int) $row['transactionTypeId'];
}
send_success($rows);
