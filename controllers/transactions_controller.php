<?php

// Purpose: Create, read, update, delete, archive, and restore transactions.
// Used by /transactions; token identity limits access to the user's own data.

// Editor-only declarations of route inputs supplied by public/index.php.
/** @var mysqli $conn */
/** @var string $method */
/** @var int|null $id */
/** @var string|null $action */

// REVISED from controllers/transactions_controller.php. All reads and writes
// are scoped to the authenticated user. Joins supply names for the React UI.

$currentUser = require_auth($conn);
$userId = (int) $currentUser['user_id'];

function transaction_row(array $row): array
{
    // The database keeps positive amounts. React uses a negative number for
    // expenses, so translate that only at the API boundary.
    $amount = (float) $row['amount'];
    return [
        'id' => (int) $row['transaction_id'],
        'description' => $row['description'],
        'categoryId' => (int) $row['category_id'],
        'category' => $row['category_name'],
        'transactionTypeId' => (int) $row['transaction_type_id'],
        'type' => $row['type_code'],
        'amount' => $row['type_code'] === 'expense' ? -$amount : $amount,
        'date' => $row['transaction_date'],
        'paymentMethodId' => (int) $row['payment_method_id'],
        'paymentMethod' => $row['payment_method_name'],
        'archived' => (bool) $row['archived'],
        'createdAt' => $row['created_at'],
    ];
}

function transaction_select_sql(): string
{
    return "SELECT t.*, c.category_name, tt.code AS type_code, pm.payment_method_name
            FROM Transactions t
            JOIN Categories c ON c.category_id = t.category_id
            JOIN TransactionTypes tt ON tt.transaction_type_id = t.transaction_type_id
            JOIN Payment_Methods pm ON pm.payment_method_id = t.payment_method_id";
}

// Read transactions with lookup names, scoped to the current user.
if ($method === 'GET') {
    if ($id) {
        $sql = transaction_select_sql() . ' WHERE t.transaction_id = ? AND t.user_id = ?';
        $stmt = mysqli_prepare($conn, $sql);
        mysqli_stmt_bind_param($stmt, 'ii', $id, $userId);
        mysqli_stmt_execute($stmt);
        $row = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
        if (!$row)
            send_error('Transaction not found', 404);
        send_success(transaction_row($row));
    }

    $sql = transaction_select_sql() . ' WHERE t.user_id = ?';
    // The original file initialized $type but later bound $types, breaking
    // transaction listing. Begin with the required user_id parameter.
    $types = 'i';
    $params = [$userId];

    if (isset($_GET['category_id']) && ctype_digit($_GET['category_id'])) {
        $sql .= ' AND t.category_id = ?';
        $types .= 'i';
        $params[] = (int) $_GET['category_id'];
    }
    if (isset($_GET['type']) && in_array($_GET['type'], ['income', 'expense'], true)) {
        $sql .= ' AND tt.code = ?';
        $types .= 's';
        $params[] = $_GET['type'];
    }
    if (!empty($_GET['start_date'])) {
        $start = require_date($_GET['start_date'], 'start_date');
        $sql .= ' AND t.transaction_date >= ?';
        $types .= 's';
        $params[] = $start;
    }
    if (!empty($_GET['end_date'])) {
        $end = require_date($_GET['end_date'], 'end_date');
        $sql .= ' AND t.transaction_date <= ?';
        $types .= 's';
        $params[] = $end;
    }
    if (isset($_GET['archived'])) {
        $archived = $_GET['archived'] === 'true' ? 1 : 0;
        $sql .= ' AND t.archived = ?';
        $types .= 'i';
        $params[] = $archived;
    }
    if (!empty($_GET['q'])) {
        $query = '%' . trim($_GET['q']) . '%';
        $sql .= ' AND (t.description LIKE ? OR c.category_name LIKE ?)';
        $types .= 'ss';
        $params[] = $query;
        $params[] = $query;
    }

    if (!empty($_GET['category'])) {
        $sql .= ' AND c.category_name = ?';
        $types .= 's';
        $params[] = $_GET['category'];
    }
    $countSql = 'SELECT COUNT(*) AS total FROM (' . $sql . ') matches';
    $count = mysqli_prepare($conn, $countSql);
    mysqli_stmt_bind_param($count, $types, ...$params);
    mysqli_stmt_execute($count);
    $total = (int) mysqli_fetch_assoc(mysqli_stmt_get_result($count))['total'];
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(100, max(1, (int) ($_GET['per_page'] ?? 25)));
    $page = min($page, max(1, (int) ceil($total / $perPage)));
    $sql .= ' ORDER BY t.transaction_date DESC, t.transaction_id DESC LIMIT ? OFFSET ?';
    $types .= 'ii';
    $params[] = $perPage;
    $params[] = ($page - 1) * $perPage;
    $stmt = mysqli_prepare($conn, $sql);
    mysqli_stmt_bind_param($stmt, $types, ...$params);
    mysqli_stmt_execute($stmt);
    $rows = mysqli_fetch_all(mysqli_stmt_get_result($stmt), MYSQLI_ASSOC);
    send_success(['items' => array_map('transaction_row', $rows), 'total' => $total, 'page' => $page, 'perPage' => $perPage]);
}

// Validate fields and lookup IDs before creating or updating a transaction.
if ($method === 'POST' || $method === 'PUT') {
    if ($method === 'PUT' && !$id)
        send_error('Transaction ID required', 400);
    if ($method === 'PUT') {
        $owned = mysqli_prepare($conn, 'SELECT transaction_id FROM Transactions WHERE transaction_id = ? AND user_id = ?');
        mysqli_stmt_bind_param($owned, 'ii', $id, $userId);
        mysqli_stmt_execute($owned);
        if (!mysqli_fetch_assoc(mysqli_stmt_get_result($owned)))
            send_error('Transaction not found', 404);
    }
    $input = get_json_input();
    require_fields($input, [
        'transaction_type_id',
        'amount',
        'description',
        'transaction_date',
        'payment_method_id',
    ]);

    $categoryId = isset($input['category_id']) ? require_positive_id($input['category_id'], 'category_id') : 0;
    $typeId = require_positive_id($input['transaction_type_id'], 'transaction_type_id');
    $paymentMethodId = require_positive_id($input['payment_method_id'], 'payment_method_id');
    $owner = mysqli_prepare($conn, 'SELECT wallet_id FROM Wallets WHERE payment_method_id = ? AND user_id = ? AND deleted_at IS NULL');
    mysqli_stmt_bind_param($owner, 'ii', $paymentMethodId, $userId);
    mysqli_stmt_execute($owner);
    if (!mysqli_fetch_assoc(mysqli_stmt_get_result($owner)))
        send_error('Choose an active wallet you own', 422, ['payment_method_id' => 'Choose an active wallet you own']);
    $typeCheck = mysqli_prepare($conn, "SELECT transaction_type_id FROM TransactionTypes WHERE transaction_type_id = ? AND code IN ('income', 'expense')");
    mysqli_stmt_bind_param($typeCheck, 'i', $typeId);
    mysqli_stmt_execute($typeCheck);
    if (!mysqli_fetch_assoc(mysqli_stmt_get_result($typeCheck)))
        send_error('Choose income or expense', 422, ['transaction_type_id' => 'Choose income or expense']);
    $amount = require_positive_number($input['amount'], 'amount');
    if (!is_finite($amount) || $amount <= 0 || $amount > 99999999.99)
        send_error('Enter an amount between 0.01 and 99,999,999.99', 422, ['amount' => 'Invalid transaction amount']);
    $description = require_string($input['description'], 'description', 150);
    $transactionDate = require_date($input['transaction_date'], 'transaction_date');

    if (isset($input['category_name'])) {
        $categoryName = require_category_name($input['category_name']);
        $valid = mysqli_prepare($conn, 'SELECT transaction_type_id FROM TransactionTypes WHERE transaction_type_id = ? AND EXISTS (SELECT 1 FROM Payment_Methods WHERE payment_method_id = ?)');
        mysqli_stmt_bind_param($valid, 'ii', $typeId, $paymentMethodId);
        mysqli_stmt_execute($valid);
        if (!mysqli_fetch_assoc(mysqli_stmt_get_result($valid)))
            send_error('Type or payment method is invalid', 422);
        $category = mysqli_prepare($conn, 'SELECT category_id FROM Categories WHERE category_name = ? AND transaction_type_id = ? LIMIT 1');
        mysqli_stmt_bind_param($category, 'si', $categoryName, $typeId);
        mysqli_stmt_execute($category);
        $existing = mysqli_fetch_assoc(mysqli_stmt_get_result($category));
        if ($existing) {
            $categoryId = (int) $existing['category_id'];
        } else {
            $category = mysqli_prepare($conn, 'INSERT INTO Categories (category_name, transaction_type_id) VALUES (?, ?)');
            mysqli_stmt_bind_param($category, 'si', $categoryName, $typeId);
            mysqli_stmt_execute($category);
            $categoryId = mysqli_insert_id($conn);
        }
    }

    // Confirm the category belongs to the selected transaction type and the
    // payment method exists before inserting a financial record.
    $lookup = mysqli_prepare($conn, "
        SELECT c.category_id
        FROM Categories c
        JOIN Payment_Methods pm ON pm.payment_method_id = ?
        WHERE c.category_id = ? AND c.transaction_type_id = ?
    ");
    mysqli_stmt_bind_param($lookup, 'iii', $paymentMethodId, $categoryId, $typeId);
    mysqli_stmt_execute($lookup);
    if (!mysqli_fetch_assoc(mysqli_stmt_get_result($lookup))) {
        send_error('Category, type, or payment method is invalid', 422);
    }

    if ($method === 'POST') {
        $stmt = mysqli_prepare($conn, "
            INSERT INTO Transactions
                (user_id, category_id, transaction_type_id, amount, description,
                 transaction_date, payment_method_id, archived, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())
        ");
        mysqli_stmt_bind_param(
            $stmt,
            'iiidssi',
            $userId,
            $categoryId,
            $typeId,
            $amount,
            $description,
            $transactionDate,
            $paymentMethodId
        );
        mysqli_stmt_execute($stmt);
        $id = mysqli_insert_id($conn);
        $status = 201;
        $message = 'Transaction created';
    } else {
        $stmt = mysqli_prepare($conn, "
            UPDATE Transactions SET category_id = ?, transaction_type_id = ?, amount = ?,
                description = ?, transaction_date = ?, payment_method_id = ?
            WHERE transaction_id = ? AND user_id = ?
        ");
        mysqli_stmt_bind_param(
            $stmt,
            'iidssiii',
            $categoryId,
            $typeId,
            $amount,
            $description,
            $transactionDate,
            $paymentMethodId,
            $id,
            $userId
        );
        mysqli_stmt_execute($stmt);
        // MySQL also returns zero when a valid PUT leaves values unchanged.
        if (mysqli_stmt_affected_rows($stmt) === 0) {
            $exists = mysqli_prepare($conn, 'SELECT transaction_id FROM Transactions WHERE transaction_id = ? AND user_id = ?');
            mysqli_stmt_bind_param($exists, 'ii', $id, $userId);
            mysqli_stmt_execute($exists);
            if (!mysqli_fetch_assoc(mysqli_stmt_get_result($exists)))
                send_error('Transaction not found', 404);
        }
        $status = 200;
        $message = 'Transaction updated';
    }

    $read = mysqli_prepare($conn, transaction_select_sql() . ' WHERE t.transaction_id = ? AND t.user_id = ?');
    mysqli_stmt_bind_param($read, 'ii', $id, $userId);
    mysqli_stmt_execute($read);
    send_success(transaction_row(mysqli_fetch_assoc(mysqli_stmt_get_result($read))), $message, $status);
}

// Change archive state without removing the transaction.
if ($method === 'PATCH' && $id && in_array($action, ['archive', 'restore'], true)) {
    // Archiving preserves the record and allows restoration.
    $archived = $action === 'archive' ? 1 : 0;
    $stmt = mysqli_prepare($conn, "
        UPDATE Transactions SET archived = ?, archived_at = IF(? = 1, NOW(), NULL)
        WHERE transaction_id = ? AND user_id = ?
    ");
    mysqli_stmt_bind_param($stmt, 'iiii', $archived, $archived, $id, $userId);
    mysqli_stmt_execute($stmt);
    if (mysqli_stmt_affected_rows($stmt) === 0)
        send_error('Transaction not found or already in that state', 404);
    send_success(['id' => $id, 'archived' => (bool) $archived], ucfirst($action) . 'd transaction');
}

// Permanently delete only the current user's transaction.
if ($method === 'DELETE') {
    if (!$id)
        send_error('Transaction ID required', 400);
    $stmt = mysqli_prepare($conn, 'DELETE FROM Transactions WHERE transaction_id = ? AND user_id = ?');
    mysqli_stmt_bind_param($stmt, 'ii', $id, $userId);
    mysqli_stmt_execute($stmt);
    if (mysqli_stmt_affected_rows($stmt) === 0)
        send_error('Transaction not found', 404);
    send_success(null, 'Transaction permanently deleted');
}

send_error('Method not allowed', 405);
