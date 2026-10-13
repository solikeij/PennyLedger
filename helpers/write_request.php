<?php

// Keep the mutation, audit record, and replay response in one transaction.
if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)
    && in_array($resource, ['transactions', 'wallet-transfers', 'wallets', 'budgets', 'goal-contributions', 'goals', 'report-logs', 'profile'], true)) {
    $actor = require_auth($conn);
    mysqli_begin_transaction($conn);
    $GLOBALS['managed_write'] = (int) $actor['user_id'];
}
if ($method === 'POST' && in_array($resource, ['transactions', 'wallet-transfers', 'wallets', 'budgets', 'goal-contributions', 'goals', 'report-logs'], true)) {
    $key = $_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? '';
    if (!preg_match('/^[a-zA-Z0-9-]{16,80}$/', $key))
        send_error('A valid Idempotency-Key is required', 422);
    $actor = require_auth($conn);
    $actorId = (int) $actor['user_id'];
    $fingerprint = hash('sha256', $resource . file_get_contents('php://input'));
    $stmt = mysqli_prepare($conn, 'SELECT * FROM Write_Requests WHERE user_id = ? AND request_key = ?');
    mysqli_stmt_bind_param($stmt, 'is', $actorId, $key);
    mysqli_stmt_execute($stmt);
    $old = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
    if ($old) {
        if (!hash_equals($old['fingerprint'], $fingerprint))
            send_error('Request key was already used for different data', 409);
        if (!$old['response_json'])
            send_error('This request needs reconciliation before retrying; refresh your records first', 409);
        mysqli_rollback($conn);
        http_response_code((int) $old['status_code']);
        echo $old['response_json'];
        exit;
    }
    $stmt = mysqli_prepare($conn, 'INSERT INTO Write_Requests (user_id, request_key, fingerprint) VALUES (?, ?, ?)');
    mysqli_stmt_bind_param($stmt, 'iss', $actorId, $key, $fingerprint);
    mysqli_stmt_execute($stmt);
    $GLOBALS['write_request'] = [$actorId, $key];
}
