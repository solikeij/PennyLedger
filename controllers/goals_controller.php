<?php

// Purpose: Read and manage the signed-in user's savings goals.
// Used by /goals; saved totals come from contribution records.

// Editor-only declarations of route inputs supplied by public/index.php.
/** @var mysqli $conn */
/** @var string $method */
/** @var int|null $id */

// REVISED from controllers/goals_controller.php. Saved money is calculated
// from persisted contributions instead of a client-only number.

$currentUser = require_auth($conn);
$userId = (int) $currentUser['user_id'];

// Use this query for goal details and the total of saved contributions.
function goal_select_sql(): string
{
    return "SELECT g.*, gs.code AS status_code,
                   COALESCE(SUM(gc.amount), 0) AS saved
            FROM Financial_Goals g
            JOIN Goal_Statuses gs ON gs.status_id = g.status_id
            LEFT JOIN Goal_Contribution gc ON gc.goal_id = g.goal_id";
}

// Map a database goal and contribution total to React fields.
function goal_row(array $row): array
{
    return [
        'id' => (int) $row['goal_id'],
        'name' => $row['goal_name'],
        'target' => (float) $row['target_amount'],
        'saved' => (float) $row['saved'],
        'date' => $row['target_date'],
        'statusId' => (int) $row['status_id'],
        'status' => $row['status_code'],
    ];
}

// Read one goal or the full goal list for this user.
if ($method === 'GET') {
    $sql = goal_select_sql() . ' WHERE g.user_id = ?';
    if ($id)
        $sql .= ' AND g.goal_id = ?';
    $sql .= ' GROUP BY g.goal_id, gs.code ORDER BY g.target_date ASC';
    $stmt = mysqli_prepare($conn, $sql);
    if ($id)
        mysqli_stmt_bind_param($stmt, 'ii', $userId, $id);
    else mysqli_stmt_bind_param($stmt, 'i', $userId);
    mysqli_stmt_execute($stmt);
    $rows = mysqli_fetch_all(mysqli_stmt_get_result($stmt), MYSQLI_ASSOC);
    if ($id && $rows === [])
        send_error('Goal not found', 404);
    send_success($id ? goal_row($rows[0]) : array_map('goal_row', $rows));
}

// Validate the goal fields before creating or updating a record.
if ($method === 'POST' || $method === 'PUT') {
    if ($method === 'PUT' && !$id)
        send_error('Goal ID required', 400);
    $input = get_json_input();
    require_fields($input, ['goal_name', 'target_amount', 'target_date', 'status_id']);
    $name = require_string($input['goal_name'], 'goal_name', 100);
    $target = require_positive_number($input['target_amount'], 'target_amount');
    $date = require_date($input['target_date'], 'target_date');
    $statusId = (int) $input['status_id'];

    $statusLookup = mysqli_prepare($conn, 'SELECT status_id FROM Goal_Statuses WHERE status_id = ?');
    mysqli_stmt_bind_param($statusLookup, 'i', $statusId);
    mysqli_stmt_execute($statusLookup);
    if (!mysqli_fetch_assoc(mysqli_stmt_get_result($statusLookup)))
        send_error('Goal status not found', 404);

    if ($method === 'POST') {
        $stmt = mysqli_prepare($conn, "
            INSERT INTO Financial_Goals (user_id, goal_name, target_amount, target_date, status_id, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        ");
        mysqli_stmt_bind_param($stmt, 'isdsi', $userId, $name, $target, $date, $statusId);
        mysqli_stmt_execute($stmt);
        $id = mysqli_insert_id($conn);
        $httpStatus = 201;
        $message = 'Goal created';
    } else {
        $stmt = mysqli_prepare($conn, "
            UPDATE Financial_Goals SET goal_name = ?, target_amount = ?, target_date = ?, status_id = ?
            WHERE goal_id = ? AND user_id = ?
        ");
        mysqli_stmt_bind_param($stmt, 'sdsiii', $name, $target, $date, $statusId, $id, $userId);
        mysqli_stmt_execute($stmt);
        $httpStatus = 200;
        $message = 'Goal updated';
    }

    $read = mysqli_prepare($conn, goal_select_sql() . ' WHERE g.user_id = ? AND g.goal_id = ? GROUP BY g.goal_id, gs.code');
    mysqli_stmt_bind_param($read, 'ii', $userId, $id);
    mysqli_stmt_execute($read);
    $row = mysqli_fetch_assoc(mysqli_stmt_get_result($read));
    if (!$row)
        send_error('Goal not found', 404);
    send_success(goal_row($row), $message, $httpStatus);
}

// Delete only a goal owned by the signed-in user.
if ($method === 'DELETE') {
    if (!$id)
        send_error('Goal ID required', 400);
    // Contributions have a foreign key to the goal. Delete both inside one
    // transaction so the goal and its saved total cannot become inconsistent.
    if (!isset($GLOBALS['managed_write']))
        mysqli_begin_transaction($conn);
    try {
        $contributions = mysqli_prepare($conn, "
            DELETE gc FROM Goal_Contribution gc
            JOIN Financial_Goals g ON g.goal_id = gc.goal_id
            WHERE g.goal_id = ? AND g.user_id = ?
        ");
        mysqli_stmt_bind_param($contributions, 'ii', $id, $userId);
        mysqli_stmt_execute($contributions);

        $stmt = mysqli_prepare($conn, 'DELETE FROM Financial_Goals WHERE goal_id = ? AND user_id = ?');
        mysqli_stmt_bind_param($stmt, 'ii', $id, $userId);
        mysqli_stmt_execute($stmt);
        if (mysqli_stmt_affected_rows($stmt) === 0) {
            mysqli_rollback($conn);
            send_error('Goal not found', 404);
        }
        if (!isset($GLOBALS['managed_write']))
            mysqli_commit($conn);
    } catch (Throwable $exception) {
        mysqli_rollback($conn);
        throw $exception;
    }
    send_success(null, 'Goal deleted');
}

send_error('Method not allowed', 405);
