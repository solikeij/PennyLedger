<?php

// Purpose: Handle /admin requests for users, activity logs, and settings.
// Used by public/index.php; every operation requires an administrator token.

// Editor-only declarations of route inputs supplied by public/index.php.
/** @var mysqli $conn */
/** @var string $method */
/** @var string $adminAction */
/** @var int|null $targetId */
/** @var string|null $adminSubaction */

// NEW file. Every route below starts with server-side administrator checking.
// React route guards alone cannot protect the database.

$admin = require_admin($conn);
$adminId = (int) $admin['user_id'];

// User management: list, create, edit, or change account status.
if ($adminAction === 'users') {
    if ($method === 'DELETE' && $targetId) {
        verify_account_password($conn, $adminId, get_json_input());
        $lockName = 'pennyledger-user-' . $targetId;
        $lock = mysqli_prepare($conn, 'SELECT GET_LOCK(?, 10) AS acquired');
        mysqli_stmt_bind_param($lock, 's', $lockName);
        mysqli_stmt_execute($lock);
        if ((int) mysqli_fetch_assoc(mysqli_stmt_get_result($lock))['acquired'] !== 1)
            send_error('Account is busy; retry shortly', 409);
        register_shutdown_function(function () use ($conn, $lockName) {
            $release = mysqli_prepare($conn, 'SELECT RELEASE_LOCK(?)');
            mysqli_stmt_bind_param($release, 's', $lockName);
            mysqli_stmt_execute($release);
        });
        mysqli_begin_transaction($conn);
        $GLOBALS['managed_write'] = $adminId;
        $check = mysqli_prepare($conn, "SELECT user_id FROM Users WHERE user_id = ? AND role = 'user' AND deleted_at IS NOT NULL FOR UPDATE");
        mysqli_stmt_bind_param($check, 'i', $targetId);
        mysqli_stmt_execute($check);
        if (!mysqli_fetch_assoc(mysqli_stmt_get_result($check)))
            send_error('Archive this user before permanently deleting the account', 409);
        permanently_delete_account($conn, $targetId);
        send_success(null, "Account {$targetId} permanently deleted");
    }
    if ($method === 'GET' && !$targetId) {
        // The admin table needs search, status filtering, and bounded pages.
        $search = '%' . trim($_GET['q'] ?? '') . '%';
        $status = $_GET['status'] ?? '';
        if ($status !== '')
            require_enum($status, 'status', ['active', 'inactive', 'suspended', 'deleted']);
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($_GET['per_page'] ?? 20)));
        $offset = ($page - 1) * $perPage;

        $isArchive = $status === 'deleted';
        $deletedFilter = $isArchive ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL';
        $where = "WHERE role = 'user' AND {$deletedFilter} AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)";
        $types = 'sss';
        $params = [$search, $search, $search];
        if ($status !== '' && !$isArchive) {
            $where .= ' AND status = ?';
            $types .= 's';
            $params[] = $status;
        }
        $count = mysqli_prepare($conn, "SELECT COUNT(*) AS total FROM Users {$where}");
        mysqli_stmt_bind_param($count, $types, ...$params);
        mysqli_stmt_execute($count);
        $total = (int) mysqli_fetch_assoc(mysqli_stmt_get_result($count))['total'];

        $query = mysqli_prepare($conn, "
            SELECT user_id AS id, first_name AS firstName, last_name AS lastName, email,
                   role, status, created_at AS createdAt, last_login_at AS lastLoginAt,
                   deleted_at AS deletedAt
            FROM Users {$where} ORDER BY created_at DESC LIMIT ? OFFSET ?
        ");
        $queryTypes = $types . 'ii';
        $queryParams = [...$params, $perPage, $offset];
        mysqli_stmt_bind_param($query, $queryTypes, ...$queryParams);
        mysqli_stmt_execute($query);
        $rows = mysqli_fetch_all(mysqli_stmt_get_result($query), MYSQLI_ASSOC);
        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['name'] = trim($row['firstName'] . ' ' . $row['lastName']);
        }
        send_success(['items' => $rows, 'page' => $page, 'perPage' => $perPage, 'total' => $total]);
    }

    if ($method === 'POST' && !$targetId) {
        // Administrators create verified regular users. The public signup path
        // is separate and sends an email code.
        $input = get_json_input();
        require_fields($input, ['first_name', 'last_name', 'email', 'password']);
        $firstName = require_string($input['first_name'], 'first_name', 100);
        $lastName = require_string($input['last_name'], 'last_name', 100);
        $email = filter_var(trim($input['email']), FILTER_VALIDATE_EMAIL);
        if (!$email)
            send_error('Validation failed', 422, ['email' => 'Enter a valid email address']);
        if (strlen($input['password']) < 8)
            send_error('Validation failed', 422, ['password' => 'Use at least 8 characters']);
        $hash = password_hash($input['password'], PASSWORD_DEFAULT);
        try {
            $stmt = mysqli_prepare($conn, "
                INSERT INTO Users (first_name, last_name, email, password, email_verified, role, status, created_at)
                VALUES (?, ?, ?, ?, 1, 'user', 'active', NOW())
            ");
            mysqli_stmt_bind_param($stmt, 'ssss', $firstName, $lastName, $email, $hash);
            mysqli_stmt_execute($stmt);
        } catch (mysqli_sql_exception $exception) {
            if ($exception->getCode() === 1062)
                send_error('Email is already registered', 409);
            throw $exception;
        }
        $newId = mysqli_insert_id($conn);
        send_success(['id' => $newId], 'User created', 201);
    }

    if ($method === 'PUT' && $targetId) {
        send_error('Administrator editing of user identity is disabled', 405);
        $input = get_json_input();
        require_fields($input, ['first_name', 'last_name', 'email']);
        $firstName = require_string($input['first_name'], 'first_name', 100);
        $lastName = require_string($input['last_name'], 'last_name', 100);
        $email = filter_var(trim($input['email']), FILTER_VALIDATE_EMAIL);
        if (!$email)
            send_error('Validation failed', 422, ['email' => 'Enter a valid email address']);

        if (!empty($input['password'])) {
            if (strlen($input['password']) < 8)
                send_error('Validation failed', 422, ['password' => 'Use at least 8 characters']);
            $hash = password_hash($input['password'], PASSWORD_DEFAULT);
            $stmt = mysqli_prepare($conn, "UPDATE Users SET first_name = ?, last_name = ?, email = ?, password = ? WHERE user_id = ? AND role = 'user' AND deleted_at IS NULL");
            mysqli_stmt_bind_param($stmt, 'ssssi', $firstName, $lastName, $email, $hash, $targetId);
        } else {
            $stmt = mysqli_prepare($conn, "UPDATE Users SET first_name = ?, last_name = ?, email = ? WHERE user_id = ? AND role = 'user' AND deleted_at IS NULL");
            mysqli_stmt_bind_param($stmt, 'sssi', $firstName, $lastName, $email, $targetId);
        }
        mysqli_stmt_execute($stmt);
        // A valid PUT may leave all values unchanged; confirm existence before
        // calling it a missing user.
        if (mysqli_stmt_affected_rows($stmt) === 0) {
            $exists = mysqli_prepare($conn, "SELECT user_id FROM Users WHERE user_id = ? AND role = 'user' AND deleted_at IS NULL");
            mysqli_stmt_bind_param($exists, 'i', $targetId);
            mysqli_stmt_execute($exists);
            if (!mysqli_fetch_assoc(mysqli_stmt_get_result($exists)))
                send_error('User not found', 404);
        }
        send_success(['id' => $targetId], 'User updated');
    }

    if ($method === 'PATCH' && $targetId && $adminSubaction === 'status') {
        // Changing status is separate from editing identity. Revoking tokens
        // immediately signs out any user whose access is disabled.
        $input = get_json_input();
        require_fields($input, ['status']);
        $status = require_enum($input['status'], 'status', ['active', 'inactive', 'suspended']);
        $stmt = mysqli_prepare($conn, "UPDATE Users SET status = ? WHERE user_id = ? AND role = 'user' AND deleted_at IS NULL");
        mysqli_stmt_bind_param($stmt, 'si', $status, $targetId);
        mysqli_stmt_execute($stmt);
        if (mysqli_stmt_affected_rows($stmt) === 0)
            send_error('User not found or already in that state', 404);
        if ($status !== 'active') {
            $tokens = mysqli_prepare($conn, 'DELETE FROM Tokens WHERE user_id = ?');
            mysqli_stmt_bind_param($tokens, 'i', $targetId);
            mysqli_stmt_execute($tokens);
        }
        send_success(['id' => $targetId, 'status' => $status], 'Account status updated');
    }

    if ($method === 'PATCH' && $targetId && $adminSubaction === 'delete') {
        $stmt = mysqli_prepare($conn, "UPDATE Users SET status = 'deleted', deleted_at = NOW() WHERE user_id = ? AND role = 'user' AND deleted_at IS NULL");
        mysqli_stmt_bind_param($stmt, 'i', $targetId);
        mysqli_stmt_execute($stmt);
        if (mysqli_stmt_affected_rows($stmt) === 0)
            send_error('User not found or already deleted', 404);

        $tokens = mysqli_prepare($conn, 'DELETE FROM Tokens WHERE user_id = ?');
        mysqli_stmt_bind_param($tokens, 'i', $targetId);
        mysqli_stmt_execute($tokens);
        send_success(['id' => $targetId, 'status' => 'deleted'], 'Account moved to archive');
    }

    if ($method === 'PATCH' && $targetId && $adminSubaction === 'restore') {
        $stmt = mysqli_prepare($conn, "UPDATE Users SET status = 'active', deleted_at = NULL WHERE user_id = ? AND role = 'user' AND deleted_at IS NOT NULL");
        mysqli_stmt_bind_param($stmt, 'i', $targetId);
        mysqli_stmt_execute($stmt);
        if (mysqli_stmt_affected_rows($stmt) === 0)
            send_error('Archived user not found', 404);
        send_success(['id' => $targetId, 'status' => 'active'], 'Account restored');
    }
}

// Retire the global activity endpoint, including all subpaths and methods.
if ($adminAction === 'activity-logs')
    send_error('User activity is private', 403);
if ($adminAction === 'auth-events' && $method === 'GET' && !$targetId && !$adminSubaction) {
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(200, max(1, (int) ($_GET['per_page'] ?? 50)));
    $offset = ($page - 1) * $perPage;
    $stmt = mysqli_prepare($conn, "SELECT CONCAT(u.first_name, ' ', u.last_name) AS user,
        e.event_type AS eventType, e.occurred_at AS timestamp
        FROM Auth_Events e JOIN Users u ON u.user_id = e.user_id
        WHERE e.event_type IN ('LOGIN', 'SIGNUP') ORDER BY e.occurred_at DESC, e.event_id DESC LIMIT ? OFFSET ?");
    mysqli_stmt_bind_param($stmt, 'ii', $perPage, $offset);
    mysqli_stmt_execute($stmt);
    send_success(['items' => mysqli_fetch_all(mysqli_stmt_get_result($stmt), MYSQLI_ASSOC), 'page' => $page, 'perPage' => $perPage]);
}

// Read or change application-wide settings.
if ($adminAction === 'settings') {
    // Keep registration policy on the server so all browsers see the same value.
    if ($method === 'GET') {
        $rows = mysqli_fetch_all(mysqli_query($conn, 'SELECT setting_key, setting_value FROM App_Settings'), MYSQLI_ASSOC);
        $settings = [];
        foreach ($rows as $row)
            $settings[$row['setting_key']] = $row['setting_value'];
        send_success(['registrationOpen' => ($settings['registration_open'] ?? '1') === '1']);
    }
    if ($method === 'PUT') {
        $input = get_json_input();
        require_fields($input, ['registrationOpen']);
        $value = $input['registrationOpen'] ? '1' : '0';
        $stmt = mysqli_prepare($conn, "
            INSERT INTO App_Settings (setting_key, setting_value) VALUES ('registration_open', ?)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        ");
        mysqli_stmt_bind_param($stmt, 's', $value);
        mysqli_stmt_execute($stmt);
        send_success(['registrationOpen' => $value === '1'], 'Settings updated');
    }
}

send_error('Admin resource or method not found', 404);
