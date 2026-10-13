<?php

// All account removal paths share the same dependent-record cleanup.
function verify_account_password(mysqli $conn, int $userId, array $input): void
{
    require_fields($input, ['password']);
    $stmt = mysqli_prepare($conn, 'SELECT password FROM Users WHERE user_id = ?');
    mysqli_stmt_bind_param($stmt, 'i', $userId);
    mysqli_stmt_execute($stmt);
    $row = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
    if (!$row || !is_string($input['password']) || !password_verify($input['password'], $row['password'])) {
        send_error('Incorrect password', 403, ['password' => 'Enter your current password']);
    }
}

function queue_account_photo(mysqli $conn, ?string $path): void
{
    if (!$path)
        return;
    // Only server-generated profile image filenames can enter the cleanup queue.
    if (!preg_match('~^/?uploads/profile/[a-f0-9]{32}\.(jpg|png|webp)$~D', $path))
        return;
    $stmt = mysqli_prepare($conn, 'INSERT IGNORE INTO File_Cleanup (path) VALUES (?)');
    mysqli_stmt_bind_param($stmt, 's', $path);
    mysqli_stmt_execute($stmt);
}

function cleanup_account_photos(mysqli $conn): void
{
    // The queue survives a filesystem failure and is retried on later requests.
    try {
        $rows = mysqli_query($conn, 'SELECT path FROM File_Cleanup LIMIT 20');
        $root = realpath(__DIR__ . '/../public/uploads/profile');
        foreach ($rows as $row) {
            $path = $row['path'];
            if (!preg_match('~^/?uploads/profile/[a-f0-9]{32}\.(jpg|png|webp)$~D', $path))
                continue;
            $file = $root ? $root . DIRECTORY_SEPARATOR . basename($path) : null;
            if ($file && is_file($file) && !@unlink($file))
                continue;
            $stmt = mysqli_prepare($conn, 'DELETE FROM File_Cleanup WHERE path = ?');
            mysqli_stmt_bind_param($stmt, 's', $path);
            mysqli_stmt_execute($stmt);
        }
    } catch (Throwable $failure) {
        error_log('Profile photo cleanup: ' . $failure->getMessage());
    }
}

function permanently_delete_account(mysqli $conn, int $userId): void
{
    $stmt = mysqli_prepare($conn, 'SELECT photo_path FROM Users WHERE user_id = ? FOR UPDATE');
    mysqli_stmt_bind_param($stmt, 'i', $userId);
    mysqli_stmt_execute($stmt);
    $row = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
    if (!$row)
        send_error('Account not found', 404);
    queue_account_photo($conn, $row['photo_path']);
    $payments = mysqli_prepare($conn, 'SELECT payment_method_id FROM Wallets WHERE user_id = ?');
    mysqli_stmt_bind_param($payments, 'i', $userId);
    mysqli_stmt_execute($payments);
    $paymentIds = array_column(mysqli_fetch_all(mysqli_stmt_get_result($payments), MYSQLI_ASSOC), 'payment_method_id');
    // Some upgraded installations also store pending email verification records.
    $optional = mysqli_query($conn, "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'pending_email_changes'");
    if (mysqli_num_rows($optional)) {
        $pending = mysqli_prepare($conn, 'DELETE FROM Pending_Email_Changes WHERE user_id = ?');
        mysqli_stmt_bind_param($pending, 'i', $userId);
        mysqli_stmt_execute($pending);
    }
    $queries = [
        'DELETE gc FROM Goal_Contribution gc JOIN Financial_Goals g ON g.goal_id = gc.goal_id WHERE g.user_id = ?',
        'DELETE FROM Wallet_Transfers WHERE user_id = ?',
        'DELETE FROM Wallet_Adjustments WHERE user_id = ?',
        'DELETE FROM Transactions WHERE user_id = ?',
        'DELETE FROM Wallets WHERE user_id = ?',
        'DELETE FROM Budgets WHERE user_id = ?',
        'DELETE FROM Financial_Goals WHERE user_id = ?',
        'DELETE FROM Report_Logs WHERE user_id = ?',
        'DELETE FROM Activity_Logs WHERE user_id = ?',
        'DELETE FROM Auth_Events WHERE user_id = ?',
        'DELETE FROM User_Activity WHERE user_id = ?',
        'DELETE FROM Otp_Codes WHERE user_id = ?',
        'DELETE FROM Tokens WHERE user_id = ?',
        'DELETE FROM Write_Requests WHERE user_id = ?',
        'DELETE FROM Users WHERE user_id = ?',
    ];
    foreach ($queries as $sql) {
        $stmt = mysqli_prepare($conn, $sql);
        mysqli_stmt_bind_param($stmt, 'i', $userId);
        mysqli_stmt_execute($stmt);
    }
    // Legacy payment methods may still be referenced by another account.
    foreach ($paymentIds as $paymentId) {
        $stmt = mysqli_prepare($conn, 'DELETE FROM Payment_Methods WHERE payment_method_id = ? AND NOT EXISTS (SELECT 1 FROM Transactions WHERE payment_method_id = ?) AND NOT EXISTS (SELECT 1 FROM Wallets WHERE payment_method_id = ?)');
        mysqli_stmt_bind_param($stmt, 'iii', $paymentId, $paymentId, $paymentId);
        mysqli_stmt_execute($stmt);
    }
}
