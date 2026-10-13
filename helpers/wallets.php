<?php

function ensure_physical_money(mysqli $conn, int $userId): void
{
    if (!isset($GLOBALS['managed_write']))
        mysqli_begin_transaction($conn);
    try {
        $lock = mysqli_prepare($conn, 'SELECT user_id FROM Users WHERE user_id = ? FOR UPDATE');
        mysqli_stmt_bind_param($lock, 'i', $userId);
        mysqli_stmt_execute($lock);
        mysqli_stmt_store_result($lock);
        $find = mysqli_prepare($conn, 'SELECT wallet_id FROM Wallets WHERE user_id = ? AND is_default = 1');
        mysqli_stmt_bind_param($find, 'i', $userId);
        mysqli_stmt_execute($find);
        if (!mysqli_fetch_assoc(mysqli_stmt_get_result($find))) {
            mysqli_query($conn, "INSERT INTO Payment_Methods (payment_method_name) VALUES ('Physical money')");
            $paymentId = mysqli_insert_id($conn);
            $insert = mysqli_prepare($conn, "INSERT INTO Wallets (user_id, payment_method_id, name, kind, is_default) VALUES (?, ?, 'Physical money', 'cash', 1)");
            mysqli_stmt_bind_param($insert, 'ii', $userId, $paymentId);
            mysqli_stmt_execute($insert);
        }
        if (!isset($GLOBALS['managed_write']))
            mysqli_commit($conn);
    } catch (Throwable $error) {
        mysqli_rollback($conn);
        throw $error;
    }
}
