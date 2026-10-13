<?php
// Purpose: Return a consistent JSON shape for API success and error responses.
// Used by controllers; these functions finish the current HTTP request.

// REVISED from helpers/response.php. Every route now sends the same JSON shape:
// success: {status, message, data}; error: {status, message, errors?}.

function send_success($data = null, ?string $message = null, int $statusCode = 200): never
{
    if (isset($GLOBALS['managed_write']) && empty($GLOBALS['account_permanently_deleted'])) {
        $description = $message ?: 'Account updated';
        $detail = is_array($data) ? ($data['name'] ?? $data['description'] ?? '') : '';
        if ($detail !== '') $description .= ': ' . $detail;
        $activity = mysqli_prepare($GLOBALS['conn'], 'INSERT INTO User_Activity (user_id, description, amount, action, related_item) VALUES (?, ?, ?, ?, ?)');
        $amount = is_array($data) ? ($data['amount'] ?? $data['limit'] ?? null) : null;
        $action = match ($GLOBALS['action'] ?? '') { 'archive' => 'ARCHIVE', 'restore' => 'RESTORE', default => match ($GLOBALS['method'] ?? '') { 'POST' => 'CREATE', 'DELETE' => 'DELETE', default => 'UPDATE' } };
        $itemId = is_array($data) ? ($data['id'] ?? $GLOBALS['id'] ?? null) : ($GLOBALS['id'] ?? null);
        $relatedItem = mb_substr(($GLOBALS['resource'] ?? 'account') . ($itemId ? ' #' . $itemId : '') . ($detail !== '' ? ': ' . $detail : ''), 0, 180);
        $description = mb_substr($description, 0, 255);
        mysqli_stmt_bind_param($activity, 'isdss', $GLOBALS['managed_write'], $description, $amount, $action, $relatedItem);
        mysqli_stmt_execute($activity);
    }
    http_response_code($statusCode);
    $json = json_encode([
        'status' => 'success',
        'message' => $message,
        'data' => $data,
    ], JSON_UNESCAPED_SLASHES);
    if (isset($GLOBALS['write_request'])) {
        [$userId, $key] = $GLOBALS['write_request'];
        $stmt = mysqli_prepare($GLOBALS['conn'], 'UPDATE Write_Requests SET status_code = ?, response_json = ? WHERE user_id = ? AND request_key = ?');
        mysqli_stmt_bind_param($stmt, 'isis', $statusCode, $json, $userId, $key); mysqli_stmt_execute($stmt);
    }
    if (isset($GLOBALS['managed_write'])) {
        mysqli_commit($GLOBALS['conn']);
        unset($GLOBALS['managed_write']);
    }
    if (function_exists('cleanup_account_photos')) cleanup_account_photos($GLOBALS['conn']);
    echo $json;
    exit;
}

function send_error(string $message, int $statusCode = 400, array $errors = []): never
{
    if (isset($GLOBALS['managed_write'])) {
        mysqli_rollback($GLOBALS['conn']);
        unset($GLOBALS['managed_write']);
    }
    if (isset($GLOBALS['write_request']) && $statusCode < 500) {
        [$userId, $key] = $GLOBALS['write_request'];
        $stmt = mysqli_prepare($GLOBALS['conn'], 'DELETE FROM Write_Requests WHERE user_id = ? AND request_key = ? AND response_json IS NULL');
        mysqli_stmt_bind_param($stmt, 'is', $userId, $key); mysqli_stmt_execute($stmt);
    }
    http_response_code($statusCode);
    $payload = [
        'status' => 'error',
        'message' => $message,
    ];

    if ($errors !== []) {
        $payload['errors'] = $errors;
    }

    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function get_json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }

    $input = json_decode($raw, true);
    if (!is_array($input)) {
        send_error('Request body must contain valid JSON', 400);
    }

    return $input;
}
