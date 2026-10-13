<?php
// Purpose: Handle registration, email codes, login, and logout.
// Used by /auth routes; verification codes are sent through the mailer helper.

// Editor-only declarations of route inputs supplied by public/index.php.
/** @var mysqli $conn */
/** @var string $method */
/** @var string $authAction */

// REVISED from controllers/auth_controller.php. Registration sends a code;
// login verifies the password and email, then issues a seven-day session token.

require_once __DIR__ . '/../helpers/mailer.php';
require_once __DIR__ . '/../helpers/verification_email.php';

// Create a code only when there is an account to verify. If SMTP fails, remove
// this unsent code so the user can retry immediately through resend-otp.
function send_verification_code(mysqli $conn, int $userId, string $email): bool
{
    $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $expiresAt = date('Y-m-d H:i:s', time() + 600);
    $purpose = 'email_verification';
    $stmt = mysqli_prepare($conn, '
        INSERT INTO Otp_Codes (user_id, code, purpose, expires_at, used)
        VALUES (?, ?, ?, ?, 0)
    ');
    mysqli_stmt_bind_param($stmt, 'isss', $userId, $otp, $purpose, $expiresAt);
    mysqli_stmt_execute($stmt);
    $otpId = mysqli_insert_id($conn);

    $recipient = mysqli_prepare($conn, 'SELECT first_name, last_name FROM Users WHERE user_id = ?');
    mysqli_stmt_bind_param($recipient, 'i', $userId);
    mysqli_stmt_execute($recipient);
    $recipientRow = mysqli_fetch_assoc(mysqli_stmt_get_result($recipient));
    $recipientName = trim(($recipientRow['first_name'] ?? '') . ' ' . ($recipientRow['last_name'] ?? ''));

    $sent = send_email(
        $email,
        'PennyLedger email verification code',
        verification_email_html($otp, $recipientName),
        verification_email_text($otp, $recipientName)
    );
    if (!$sent) {
        $delete = mysqli_prepare($conn, 'DELETE FROM Otp_Codes WHERE otp_id = ?');
        mysqli_stmt_bind_param($delete, 'i', $otpId);
        mysqli_stmt_execute($delete);
        return false;
    }

    // The newest delivered code supersedes earlier unverified codes.
    $older = mysqli_prepare($conn, "UPDATE Otp_Codes SET used = 1 WHERE user_id = ? AND purpose = 'email_verification' AND otp_id <> ? AND used = 0");
    mysqli_stmt_bind_param($older, 'ii', $userId, $otpId);
    mysqli_stmt_execute($older);
    return true;
}

// The second URL segment selects one account operation.
switch ($authAction) {
    case 'registration-status':
        if ($method !== 'GET') send_error('Method not allowed', 405);
        $registration = mysqli_query($conn, "SELECT setting_value FROM App_Settings WHERE setting_key = 'registration_open'");
        $registrationRow = mysqli_fetch_assoc($registration);
        send_success(['registrationOpen' => ($registrationRow['setting_value'] ?? '1') === '1']);

    // Registration stores an unverified account, then attempts to email a code.
    case 'register':
        // Public registration obeys the server-wide admin setting.
        if ($method !== 'POST') send_error('Method not allowed', 405);
        $registration = mysqli_query($conn, "SELECT setting_value FROM App_Settings WHERE setting_key = 'registration_open'");
        $registrationRow = mysqli_fetch_assoc($registration);
        if ($registrationRow && $registrationRow['setting_value'] !== '1') {
            send_error('Registration is currently closed', 403);
        }
        $input = get_json_input();
        require_fields($input, ['first_name', 'last_name', 'email', 'password']);

        $firstName = require_string($input['first_name'], 'first_name', 100);
        $lastName = require_string($input['last_name'], 'last_name', 100);
        $email = filter_var(trim($input['email']), FILTER_VALIDATE_EMAIL);
        if (!$email) send_error('Validation failed', 422, ['email' => 'Enter a valid email address']);
        if (strlen($input['password']) < 8) {
            send_error('Validation failed', 422, ['password' => 'Use at least 8 characters']);
        }

        // Emails stay reserved after soft deletion because Users.email is
        // UNIQUE. Check all rows so this case returns 409 instead of SQL 500.
        $check = mysqli_prepare($conn, 'SELECT user_id FROM Users WHERE email = ?');
        mysqli_stmt_bind_param($check, 's', $email);
        mysqli_stmt_execute($check);
        if (mysqli_fetch_assoc(mysqli_stmt_get_result($check))) {
            send_error('Email is already registered', 409);
        }

        // Store a password verifier, never the password itself.
        $passwordHash = password_hash($input['password'], PASSWORD_DEFAULT);
        mysqli_begin_transaction($conn);
        try {
            $stmt = mysqli_prepare($conn, "
                INSERT INTO Users (first_name, last_name, email, password, email_verified, role, status, created_at)
                VALUES (?, ?, ?, ?, 0, 'user', 'active', NOW())
            ");
            mysqli_stmt_bind_param($stmt, 'ssss', $firstName, $lastName, $email, $passwordHash);
            mysqli_stmt_execute($stmt);
            $userId = mysqli_insert_id($conn);

            log_activity($conn, $userId, 'registered', 'Created an account');
            mysqli_commit($conn);
        } catch (Throwable $exception) {
            mysqli_rollback($conn);
            throw $exception;
        }

        // Account creation succeeded even if SMTP is unavailable. React keeps
        // the user on verification and offers a resend path for this account.
        $sent = send_verification_code($conn, $userId, $email);
        send_success(['userId' => $userId, 'emailSent' => $sent],
            $sent ? 'Verification code sent' : 'Account created; verification email unavailable', 201);

    // A user with an unverified account can request another code.
    case 'resend-otp':
        if ($method !== 'POST') send_error('Method not allowed', 405);
        $input = get_json_input();
        require_fields($input, ['email']);
        $email = filter_var(trim($input['email']), FILTER_VALIDATE_EMAIL);
        if (!$email) send_error('Validation failed', 422, ['email' => 'Enter a valid email address']);

        $account = mysqli_prepare($conn, 'SELECT user_id, email_verified, status FROM Users WHERE email = ? AND deleted_at IS NULL LIMIT 1');
        mysqli_stmt_bind_param($account, 's', $email);
        mysqli_stmt_execute($account);
        $user = mysqli_fetch_assoc(mysqli_stmt_get_result($account));
        
        if (!$user) send_error('Account not found', 404);
        if ((bool) $user['email_verified']) send_error('This email is already verified; please sign in', 409);
        if ($user['status'] !== 'active') send_error('This account is ' . $user['status'], 403);

        $userId = (int) $user['user_id'];
        $recent = mysqli_prepare($conn, "SELECT expires_at FROM Otp_Codes WHERE user_id = ? AND purpose = 'email_verification' AND used = 0 ORDER BY otp_id DESC LIMIT 1");
        mysqli_stmt_bind_param($recent, 'i', $userId);
        mysqli_stmt_execute($recent);
        
        $lastCode = mysqli_fetch_assoc(mysqli_stmt_get_result($recent));
        // A successfully sent code lasts 10 minutes; allow one resend per minute.
        if ($lastCode && strtotime($lastCode['expires_at']) > time() + 540) {
            send_error('Wait one minute before requesting another code', 429);
        }
        if (!send_verification_code($conn, $userId, $email)) {
            send_error('Verification email is unavailable; try again later', 503);
        }
        send_success(null, 'New verification code sent');

    // A valid, unused code marks the account email as verified.
    case 'verify-otp':
        // Only the newest unused verification code is accepted.
        if ($method !== 'POST') send_error('Method not allowed', 405);
        $input = get_json_input();
        require_fields($input, ['email', 'otp']);

        $stmt = mysqli_prepare($conn, "
            SELECT o.otp_id, o.code, o.expires_at, u.user_id
            FROM Users u
            JOIN Otp_Codes o ON o.user_id = u.user_id
            WHERE u.email = ? AND o.purpose = 'email_verification' AND o.used = 0
            ORDER BY o.otp_id DESC LIMIT 1
        ");
        mysqli_stmt_bind_param($stmt, 's', $input['email']);
        mysqli_stmt_execute($stmt);
        $record = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));

        if (!$record || !hash_equals($record['code'], (string) $input['otp'])) {
            send_error('Invalid verification code', 400);
        }
        if (strtotime($record['expires_at']) < time()) send_error('Verification code has expired', 400);

        mysqli_begin_transaction($conn);
        
        $otpId = (int) $record['otp_id'];
        $userId = (int) $record['user_id'];
        $markOtp = mysqli_prepare($conn, 'UPDATE Otp_Codes SET used = 1 WHERE otp_id = ?');
        
        mysqli_stmt_bind_param($markOtp, 'i', $otpId);
        mysqli_stmt_execute($markOtp);
        
        $markUser = mysqli_prepare($conn, 'UPDATE Users SET email_verified = 1 WHERE user_id = ?');
        
        mysqli_stmt_bind_param($markUser, 'i', $userId);
        mysqli_stmt_execute($markUser);
        mysqli_commit($conn);
        send_success(null, 'Email verified');

    // Only a verified account with the correct password gets a session token.
    case 'login':
        // The response includes the role React needs, but the server remains
        // responsible for checking admin permissions on later requests.
        if ($method !== 'POST') send_error('Method not allowed', 405);
        $input = get_json_input();
        require_fields($input, ['email', 'password']);

        $stmt = mysqli_prepare($conn, 'SELECT * FROM Users WHERE email = ? AND deleted_at IS NULL LIMIT 1');
        mysqli_stmt_bind_param($stmt, 's', $input['email']);
        mysqli_stmt_execute($stmt);
        $user = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
        if (!$user || !password_verify($input['password'], $user['password'])) {
            send_error('Invalid email or password', 401);
        }
        if (!(bool) $user['email_verified']) send_error('Verify your email before signing in', 403);
        if ($user['status'] !== 'active') send_error('This account is ' . $user['status'], 403);

        // Return the raw token once, but save only its hash in Tokens.
        $rawToken = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $rawToken);
        $expiresAt = date('Y-m-d H:i:s', time() + 60 * 60 * 24 * 7);
        $userId = (int) $user['user_id'];
        $tokenStmt = mysqli_prepare($conn, 'INSERT INTO Tokens (user_id, token, expires_at) VALUES (?, ?, ?)');
        
        mysqli_stmt_bind_param($tokenStmt, 'iss', $userId, $tokenHash, $expiresAt);
        mysqli_stmt_execute($tokenStmt);
        mysqli_query($conn, "UPDATE Users SET last_login_at = NOW() WHERE user_id = {$userId}");
        
        log_activity($conn, $userId, 'login', 'Signed in');

        send_success([
            'token' => $rawToken,
            'expiresAt' => $expiresAt,
            'user' => [
                'id' => $userId,
                'firstName' => $user['first_name'],
                'lastName' => $user['last_name'],
                'name' => trim($user['first_name'] . ' ' . $user['last_name']),
                'email' => $user['email'],
                'role' => $user['role'],
                'status' => $user['status'],
            ],
        ], 'Login successful');

    case 'logout':
        // Removing the token hash makes the current session unusable.
        if ($method !== 'POST') send_error('Method not allowed', 405);
        
        $user = require_auth($conn);
        $tokenHash = hash('sha256', bearer_token());
        $stmt = mysqli_prepare($conn, 'DELETE FROM Tokens WHERE token = ?');
        
        mysqli_stmt_bind_param($stmt, 's', $tokenHash);
        mysqli_stmt_execute($stmt);
        
        log_activity($conn, (int) $user['user_id'], 'logout', 'Signed out');
        send_success(null, 'Logged out');

    default:
        send_error('Authentication action not found', 404);
}
