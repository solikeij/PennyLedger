<?php

// Purpose: Read bearer tokens and enforce user or administrator access.
// Used by protected controllers through require_auth() and require_admin().

// REVISED from helpers/auth.php. Ownership comes from a bearer token, not a
// user_id supplied by the browser or a token embedded in the URL/body.

function bearer_token(): ?string
{
    // Apache sometimes forwards Authorization through REDIRECT_HTTP_AUTHORIZATION.
    $header = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? (function_exists('getallheaders') ? (getallheaders()['Authorization'] ?? '') : '');
    if (!preg_match('/^Bearer\s+(.+)$/i', trim($header), $matches)) {
        return null;
    }

    return trim($matches[1]);
}

// Verify the hashed session token and return the active account.
function require_auth(mysqli $conn): array
{
    $token = bearer_token();
    if (!$token) {
        send_error('Missing bearer token', 401);
    }

    // The database stores only this hash. A copied database cannot reveal the
    // raw token that a client must send in its Authorization header.
    $tokenHash = hash('sha256', $token);
    $stmt = mysqli_prepare($conn, "
        SELECT u.user_id, u.first_name, u.last_name, u.email, u.role, u.status
        FROM Tokens t
        JOIN Users u ON u.user_id = t.user_id
        WHERE t.token = ?
          AND t.expires_at > NOW()
          AND u.deleted_at IS NULL
        LIMIT 1
    ");
    mysqli_stmt_bind_param($stmt, 's', $tokenHash);
    mysqli_stmt_execute($stmt);
    $user = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));

    if (!$user || $user['status'] !== 'active') {
        send_error('Invalid or expired session', 401);
    }

    // Serialize account writes across transfers, reconciliation, and expenses.
    if (in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['POST', 'PUT', 'PATCH', 'DELETE'], true) && empty($GLOBALS['account_write_lock'])) {
        $lockName = 'pennyledger-user-' . $user['user_id'];
        $lock = mysqli_prepare($conn, 'SELECT GET_LOCK(?, 10) AS acquired');
        mysqli_stmt_bind_param($lock, 's', $lockName);
        mysqli_stmt_execute($lock);
        if ((int) mysqli_fetch_assoc(mysqli_stmt_get_result($lock))['acquired'] !== 1)
            send_error('Account is busy; retry shortly', 409);
        $GLOBALS['account_write_lock'] = $lockName;
        register_shutdown_function(function () use ($conn, $lockName) {
            $release = mysqli_prepare($conn, 'SELECT RELEASE_LOCK(?)');
            mysqli_stmt_bind_param($release, 's', $lockName);
            mysqli_stmt_execute($release);
        });
        // A queued write may have waited while another request archived the account.
        mysqli_stmt_execute($stmt);
        $user = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
        if (!$user || $user['status'] !== 'active')
            send_error('Invalid or expired session', 401);
    }
    return $user;
}

// Require a valid session with the administrator role.
function require_admin(mysqli $conn): array
{
    $user = require_auth($conn);
    if ($user['role'] !== 'admin') {
        send_error('Administrator access required', 403);
    }

    return $user;
}

// Authentication events are the only events written to an admin-readable store.
function log_activity(mysqli $conn, int $actorId, string $activityCode, string $description): void
{
    $action = match ($activityCode) {
        'login' => 'LOGIN', 'registered', 'signup' => 'SIGNUP', 'logout' => 'LOGOUT', default => null
    };
    if ($action === null)
        return;
    $private = mysqli_prepare($conn, "INSERT INTO User_Activity (user_id, action, description, related_item) VALUES (?, ?, ?, 'Account')");
    mysqli_stmt_bind_param($private, 'iss', $actorId, $action, $description);
    mysqli_stmt_execute($private);
    if (!in_array($action, ['LOGIN', 'SIGNUP'], true))
        return;
    // Only login and signup events enter the administrator authentication history.
    $stmt = mysqli_prepare($conn, 'INSERT INTO Auth_Events (user_id, event_type) VALUES (?, ?)');
    mysqli_stmt_bind_param($stmt, 'is', $actorId, $action);
    mysqli_stmt_execute($stmt);
}
