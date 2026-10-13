<?php

// Purpose: Calculate financial report totals from saved transactions.
// Used by GET /reports for the signed-in user's React reports page.

// Editor-only declarations of route inputs supplied by public/index.php.
/** @var mysqli $conn */
/** @var string $method */

// REVISED from controllers/reports_controller.php. These totals come from
// stored transactions and type codes rather than demo arrays or numeric IDs.

$currentUser = require_auth($conn);
$userId = (int) $currentUser['user_id'];
if ($method !== 'GET')
    send_error('Method not allowed', 405);

$type = $_GET['type'] ?? 'summary';
// Compact daily category totals support all charts without fetching full records.
if ($type === 'ledger') {
    $stmt = mysqli_prepare($conn, "SELECT t.transaction_date AS date, c.category_id AS categoryId,
        c.category_name AS category, tt.code AS type,
        SUM(CASE WHEN tt.code = 'income' THEN t.amount ELSE -t.amount END) AS amount,
        COUNT(*) AS recordCount
        FROM Transactions t JOIN Categories c ON c.category_id = t.category_id
        JOIN TransactionTypes tt ON tt.transaction_type_id = t.transaction_type_id
        WHERE t.user_id = ? GROUP BY t.transaction_date, c.category_id, c.category_name, tt.code
        ORDER BY t.transaction_date DESC");
    mysqli_stmt_bind_param($stmt, 'i', $userId);
    mysqli_stmt_execute($stmt);
    $rows = mysqli_fetch_all(mysqli_stmt_get_result($stmt), MYSQLI_ASSOC);
    foreach ($rows as &$row) {
        $row['amount'] = (float) $row['amount'];
        $row['categoryId'] = (int) $row['categoryId'];
        $row['recordCount'] = (int) $row['recordCount'];
    }
    send_success($rows);
}
$startDate = !empty($_GET['start_date']) ? require_date($_GET['start_date'], 'start_date') : '1900-01-01';
$endDate = !empty($_GET['end_date']) ? require_date($_GET['end_date'], 'end_date') : '2999-12-31';
if ($startDate > $endDate)
    send_error('Validation failed', 422, ['end_date' => 'Must be on or after start_date']);

// Return total income and expense for the requested date range.
if ($type === 'summary') {
    $stmt = mysqli_prepare($conn, "
        SELECT
          COALESCE(SUM(CASE WHEN tt.code = 'income' THEN t.amount ELSE 0 END), 0) AS totalIncome,
          COALESCE(SUM(CASE WHEN tt.code = 'expense' THEN t.amount ELSE 0 END), 0) AS totalExpense
        FROM Transactions t
        JOIN TransactionTypes tt ON tt.transaction_type_id = t.transaction_type_id
        WHERE t.user_id = ? AND t.transaction_date BETWEEN ? AND ?
    ");
    mysqli_stmt_bind_param($stmt, 'iss', $userId, $startDate, $endDate);
    mysqli_stmt_execute($stmt);
    $row = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
    $income = (float) $row['totalIncome'];
    $expense = (float) $row['totalExpense'];
    send_success(['totalIncome' => $income, 'totalExpense' => $expense, 'balance' => $income - $expense]);
}

// Choose the detail query for monthly, category, budget, or goal reports.
if ($type === 'monthly') {
    $stmt = mysqli_prepare($conn, "
        SELECT DATE_FORMAT(t.transaction_date, '%Y-%m') AS month,
          SUM(CASE WHEN tt.code = 'income' THEN t.amount ELSE 0 END) AS income,
          SUM(CASE WHEN tt.code = 'expense' THEN t.amount ELSE 0 END) AS expense
        FROM Transactions t JOIN TransactionTypes tt ON tt.transaction_type_id = t.transaction_type_id
        WHERE t.user_id = ? AND t.transaction_date BETWEEN ? AND ?
        GROUP BY DATE_FORMAT(t.transaction_date, '%Y-%m') ORDER BY month
    ");
} elseif ($type === 'category') {
    $stmt = mysqli_prepare($conn, "
        SELECT c.category_id AS categoryId, c.category_name AS category, SUM(t.amount) AS amount
        FROM Transactions t
        JOIN Categories c ON c.category_id = t.category_id
        JOIN TransactionTypes tt ON tt.transaction_type_id = t.transaction_type_id
        WHERE t.user_id = ? AND tt.code = 'expense'
          AND t.transaction_date BETWEEN ? AND ?
        GROUP BY c.category_id, c.category_name ORDER BY amount DESC
    ");
} elseif ($type === 'budget') {
    $stmt = mysqli_prepare($conn, "
        SELECT b.budget_id AS id, c.category_name AS category, b.budget_amount AS `limit`,
          COALESCE(SUM(CASE WHEN tt.code = 'expense' THEN t.amount ELSE 0 END), 0) AS spent
        FROM Budgets b JOIN Categories c ON c.category_id = b.category_id
        LEFT JOIN Transactions t ON t.user_id = b.user_id AND t.category_id = b.category_id
          AND t.transaction_date BETWEEN b.start_date AND b.end_date
        LEFT JOIN TransactionTypes tt ON tt.transaction_type_id = t.transaction_type_id
        WHERE b.user_id = ? AND b.start_date <= ? AND b.end_date >= ?
        GROUP BY b.budget_id, c.category_name, b.budget_amount ORDER BY c.category_name
    ");
    [$startDate, $endDate] = [$endDate, $startDate];
} elseif ($type === 'goals') {
    // Goal progress is current state. Dates are accepted for a consistent
    // report URL but do not change the current saved contribution total.
    $stmt = mysqli_prepare($conn, "
        SELECT g.goal_id AS id, g.goal_name AS name, g.target_amount AS target,
          COALESCE(SUM(gc.amount), 0) AS saved, g.target_date AS date, gs.code AS status
        FROM Financial_Goals g JOIN Goal_Statuses gs ON gs.status_id = g.status_id
        LEFT JOIN Goal_Contribution gc ON gc.goal_id = g.goal_id
        WHERE g.user_id = ?
        GROUP BY g.goal_id, gs.code ORDER BY g.target_date
    ");
    mysqli_stmt_bind_param($stmt, 'i', $userId);
    mysqli_stmt_execute($stmt);
    $rows = mysqli_fetch_all(mysqli_stmt_get_result($stmt), MYSQLI_ASSOC);
    foreach ($rows as &$row) {
        $row['id'] = (int) $row['id'];
        $row['target'] = (float) $row['target'];
        $row['saved'] = (float) $row['saved'];
    }
    send_success($rows);
} else {
    send_error('Unknown report type', 400);
}

mysqli_stmt_bind_param($stmt, 'iss', $userId, $startDate, $endDate);
mysqli_stmt_execute($stmt);
$rows = mysqli_fetch_all(mysqli_stmt_get_result($stmt), MYSQLI_ASSOC);
foreach ($rows as &$row) {
    foreach (['amount', 'income', 'expense', 'limit', 'spent', 'target', 'saved'] as $numberField) {
        if (isset($row[$numberField]))
            $row[$numberField] = (float) $row[$numberField];
    }
    if (isset($row['id']))
        $row['id'] = (int) $row['id'];
    if (isset($row['categoryId']))
        $row['categoryId'] = (int) $row['categoryId'];
}
send_success($rows);
