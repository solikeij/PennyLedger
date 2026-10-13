<?php

// Editor-only declarations of route inputs supplied by public/index.php.
/** @var mysqli $conn */
/** @var string $method */
/** @var int|null $id */

$user = require_auth($conn);
$userId = (int) $user['user_id'];
// Map a database wallet record to the fields expected by React.
function wallet_row(array $row): array
{
    return ['id' => (int) $row['wallet_id'],
        'paymentMethodId' => (int) $row['payment_method_id'],
        'name' => $row['name'],
        'expenseType' => $row['expense_type'],
        'isDefault' => (bool) $row['is_default']];
}
if ($method === 'GET') {
    $stmt = mysqli_prepare($conn, 'SELECT wallet_id, payment_method_id, name, expense_type, is_default FROM Wallets WHERE user_id = ? AND deleted_at IS NULL ORDER BY is_default DESC, wallet_id');
    mysqli_stmt_bind_param($stmt, 'i', $userId);
    mysqli_stmt_execute($stmt);
    send_success(array_map('wallet_row', mysqli_fetch_all(mysqli_stmt_get_result($stmt), MYSQLI_ASSOC)));
}
if ($method === 'PUT' || $method === 'DELETE') {
    $stmt = mysqli_prepare($conn, 'SELECT wallet_id, payment_method_id, name, expense_type, is_default FROM Wallets WHERE wallet_id = ? AND user_id = ? AND deleted_at IS NULL FOR UPDATE');
    mysqli_stmt_bind_param($stmt, 'ii', $id, $userId);
    mysqli_stmt_execute($stmt);
    $wallet = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
    if (!$wallet)
        send_error('Wallet not found', 404);
}
if ($method === 'DELETE') {
    if ($wallet['is_default'])
        send_error('Physical money cannot be deleted', 403);
    verify_account_password($conn, $userId, get_json_input());
    $stmt = mysqli_prepare($conn, 'UPDATE Wallets SET deleted_at = NOW() WHERE wallet_id = ? AND user_id = ?');
    mysqli_stmt_bind_param($stmt, 'ii', $id, $userId);
    mysqli_stmt_execute($stmt);
    send_success(null, 'Wallet deleted');
}
if ($method === 'POST' || $method === 'PUT') {
    $input = get_json_input();
    require_fields($input, ['name', 'expense_type']);
    $name = require_string($input['name'], 'name', 50);
    $expenseType = require_string($input['expense_type'], 'expense_type', 100);
    if ($expenseType !== 'Other' && $expenseType !== ($wallet['expense_type'] ?? null)) {
        $check = mysqli_prepare($conn, "SELECT c.category_id FROM Categories c JOIN TransactionTypes tt ON tt.transaction_type_id = c.transaction_type_id WHERE c.category_name = ? AND tt.code = 'expense' AND (EXISTS (SELECT 1 FROM Transactions t WHERE t.category_id = c.category_id AND t.user_id = ?) OR EXISTS (SELECT 1 FROM Budgets b WHERE b.category_id = c.category_id AND b.user_id = ?)) LIMIT 1");
        mysqli_stmt_bind_param($check, 'sii', $expenseType, $userId, $userId);
        mysqli_stmt_execute($check);
        if (!mysqli_fetch_assoc(mysqli_stmt_get_result($check)))
            send_error('Validation failed', 422, ['expense_type' => 'Choose a saved expense category or Other']);
    }
    if ($method === 'PUT') {
        if ($wallet['is_default'])
            $name = 'Physical money';
        $walletId = (int) $id;
        $paymentId = (int) $wallet['payment_method_id'];
        $stmt = mysqli_prepare($conn, 'UPDATE Wallets SET name = ?, expense_type = ? WHERE wallet_id = ? AND user_id = ?');
        mysqli_stmt_bind_param($stmt, 'ssii', $name, $expenseType, $walletId, $userId);
        mysqli_stmt_execute($stmt);
        $stmt = mysqli_prepare($conn, 'UPDATE Payment_Methods SET payment_method_name = ? WHERE payment_method_id = ?');
        mysqli_stmt_bind_param($stmt, 'si', $name, $paymentId);
        mysqli_stmt_execute($stmt);
    } else {
        $stmt = mysqli_prepare($conn, 'INSERT INTO Payment_Methods (payment_method_name) VALUES (?)');
        mysqli_stmt_bind_param($stmt, 's', $name);
        mysqli_stmt_execute($stmt);
        $paymentId = mysqli_insert_id($conn);
        $stmt = mysqli_prepare($conn, "INSERT INTO Wallets (user_id, payment_method_id, name, kind, expense_type) VALUES (?, ?, ?, 'other', ?)");
        mysqli_stmt_bind_param($stmt, 'iiss', $userId, $paymentId, $name, $expenseType);
        mysqli_stmt_execute($stmt);
        $walletId = mysqli_insert_id($conn);
    }
    send_success(['id' => $walletId, 'paymentMethodId' => $paymentId, 'name' => $name, 'expenseType' => $expenseType, 'isDefault' => (bool) ($wallet['is_default'] ?? false)], $method === 'POST' ? 'Wallet added' : 'Wallet updated', $method === 'POST' ? 201 : 200);
}
send_error('Method not allowed', 405);
