<?php

// Purpose: Read, create, update, and delete budgets.
// Used by /budgets; records are limited to the signed-in user.

// Editor-only declarations of route inputs supplied by public/index.php.
/** @var mysqli $conn */
/** @var string $method */
/** @var int|null $id */

// REVISED from controllers/budgets_controller.php. The archive's INSERT left
// out budget_period even though the supplied SQL schema requires it.

$currentUser = require_auth($conn);
$userId = (int) $currentUser['user_id'];

// Build the shared query that adds category names and calculated spending.
function budget_select_sql(): string
{
    // Spent is calculated from transactions in this budget's date range.
    return "SELECT b.*, c.category_name,
                   COALESCE(SUM(CASE WHEN tt.code = 'expense' THEN t.amount ELSE 0 END), 0) AS spent
            FROM Budgets b
            JOIN Categories c ON c.category_id = b.category_id
            LEFT JOIN Transactions t
              ON t.user_id = b.user_id
             AND t.category_id = b.category_id
             AND t.transaction_date BETWEEN b.start_date AND b.end_date
            LEFT JOIN TransactionTypes tt ON tt.transaction_type_id = t.transaction_type_id";
}

function budget_row(array $row): array
{
    return [
        'id' => (int) $row['budget_id'],
        'categoryId' => (int) $row['category_id'],
        'category' => $row['category_name'],
        'limit' => (float) $row['budget_amount'],
        'spent' => (float) $row['spent'],
        'period' => $row['budget_period'],
        'startDate' => $row['start_date'],
        'endDate' => $row['end_date'],
    ];
}

// Read one budget or all budgets owned by this user.
if ($method === 'GET') {
    $sql = budget_select_sql() . ' WHERE b.user_id = ?';
    if ($id)
        $sql .= ' AND b.budget_id = ?';
    $sql .= ' GROUP BY b.budget_id, c.category_name ORDER BY b.start_date DESC';
    $stmt = mysqli_prepare($conn, $sql);
    if ($id)
        mysqli_stmt_bind_param($stmt, 'ii', $userId, $id);
    else mysqli_stmt_bind_param($stmt, 'i', $userId);
    mysqli_stmt_execute($stmt);
    $rows = mysqli_fetch_all(mysqli_stmt_get_result($stmt), MYSQLI_ASSOC);
    if ($id && $rows === [])
        send_error('Budget not found', 404);
    send_success($id ? budget_row($rows[0]) : array_map('budget_row', $rows));
}

// Validate the dates and category before saving a budget.
if ($method === 'POST' || $method === 'PUT') {
    if ($method === 'PUT' && !$id)
        send_error('Budget ID required', 400);
    $input = get_json_input();
    require_fields($input, ['budget_amount', 'budget_period', 'start_date', 'end_date']);
    $categoryId = (int) ($input['category_id'] ?? 0);
    $amount = require_positive_number($input['budget_amount'], 'budget_amount');
    $period = require_enum($input['budget_period'], 'budget_period', ['daily', 'weekly', 'monthly']);
    $startDate = require_date($input['start_date'], 'start_date');
    $endDate = require_date($input['end_date'], 'end_date');
    if ($startDate > $endDate)
        send_error('Validation failed', 422, ['end_date' => 'Must be on or after start_date']);

    if (isset($input['category_name'])) {
        $categoryName = require_string($input['category_name'], 'category_name', 100);
        $type = mysqli_fetch_assoc(mysqli_query($conn, "SELECT transaction_type_id FROM TransactionTypes WHERE code = 'expense' LIMIT 1"));
        if (!$type)
            send_error('Expense type is not configured', 422);
        $typeId = (int) $type['transaction_type_id'];
        $find = mysqli_prepare($conn, 'SELECT category_id FROM Categories WHERE category_name = ? AND transaction_type_id = ? LIMIT 1');
        mysqli_stmt_bind_param($find, 'si', $categoryName, $typeId);
        mysqli_stmt_execute($find);
        $existing = mysqli_fetch_assoc(mysqli_stmt_get_result($find));
        if ($existing) {
            $categoryId = (int) $existing['category_id'];
        } else {
            $insert = mysqli_prepare($conn, 'INSERT INTO Categories (category_name, transaction_type_id) VALUES (?, ?)');
            mysqli_stmt_bind_param($insert, 'si', $categoryName, $typeId);
            mysqli_stmt_execute($insert);
            $categoryId = mysqli_insert_id($conn);
        }
    }

    $category = mysqli_prepare($conn, "
        SELECT c.category_id FROM Categories c
        JOIN TransactionTypes tt ON tt.transaction_type_id = c.transaction_type_id
        WHERE c.category_id = ? AND tt.code = 'expense'
    ");
    mysqli_stmt_bind_param($category, 'i', $categoryId);
    mysqli_stmt_execute($category);
    if (!mysqli_fetch_assoc(mysqli_stmt_get_result($category))) {
        send_error('Expense category not found', 404);
    }

    // Prevent two budgets for the same category from covering the same days.
    $overlapSql = "SELECT budget_id FROM Budgets
                   WHERE user_id = ? AND category_id = ?
                     AND start_date <= ? AND end_date >= ?";
    if ($method === 'PUT')
        $overlapSql .= ' AND budget_id <> ?';
    $overlap = mysqli_prepare($conn, $overlapSql);
    if ($method === 'PUT')
        mysqli_stmt_bind_param($overlap, 'iissi', $userId, $categoryId, $endDate, $startDate, $id);
    else mysqli_stmt_bind_param($overlap, 'iiss', $userId, $categoryId, $endDate, $startDate);
    mysqli_stmt_execute($overlap);
    if (mysqli_fetch_assoc(mysqli_stmt_get_result($overlap))) {
        send_error('A budget already covers this category and date range', 409);
    }

    if ($method === 'POST') {
        $stmt = mysqli_prepare($conn, "
            INSERT INTO Budgets
                (user_id, category_id, budget_amount, budget_period, start_date, end_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        ");
        mysqli_stmt_bind_param($stmt, 'iidsss', $userId, $categoryId, $amount, $period, $startDate, $endDate);
        mysqli_stmt_execute($stmt);
        $id = mysqli_insert_id($conn);
        $status = 201;
        $message = 'Budget created';
    } else {
        $stmt = mysqli_prepare($conn, "
            UPDATE Budgets SET category_id = ?, budget_amount = ?, budget_period = ?, start_date = ?, end_date = ?
            WHERE budget_id = ? AND user_id = ?
        ");
        mysqli_stmt_bind_param($stmt, 'idsssii', $categoryId, $amount, $period, $startDate, $endDate, $id, $userId);
        mysqli_stmt_execute($stmt);
        $status = 200;
        $message = 'Budget updated';
    }

    $read = mysqli_prepare($conn, budget_select_sql() . ' WHERE b.user_id = ? AND b.budget_id = ? GROUP BY b.budget_id, c.category_name');
    mysqli_stmt_bind_param($read, 'ii', $userId, $id);
    mysqli_stmt_execute($read);
    $row = mysqli_fetch_assoc(mysqli_stmt_get_result($read));
    if (!$row)
        send_error('Budget not found', 404);
    send_success(budget_row($row), $message, $status);
}

// Delete only a budget belonging to the signed-in user.
if ($method === 'DELETE') {
    if (!$id)
        send_error('Budget ID required', 400);
    $stmt = mysqli_prepare($conn, 'DELETE FROM Budgets WHERE budget_id = ? AND user_id = ?');
    mysqli_stmt_bind_param($stmt, 'ii', $id, $userId);
    mysqli_stmt_execute($stmt);
    if (mysqli_stmt_affected_rows($stmt) === 0)
        send_error('Budget not found', 404);
    send_success(null, 'Budget deleted');
}

send_error('Method not allowed', 405);
