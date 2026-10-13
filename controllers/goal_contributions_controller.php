<?php
// Purpose: List, add, and delete savings-goal contributions.
// Used by /goal-contributions; checks that the signed-in user owns the goal.

// Editor-only declarations of route inputs supplied by public/index.php.
/** @var mysqli $conn */
/** @var string $method */
/** @var int|null $id */

// NEW file. Contribution reads and writes verify goal ownership through the
// authenticated user's ID before returning or changing any records.

$currentUser = require_auth($conn);
$userId = (int) $currentUser['user_id'];

// Read contributions only after matching the goal to this user.
if ($method === 'GET') {
    if (!isset($_GET['goal_id']) || !ctype_digit($_GET['goal_id'])) {
        send_error('goal_id is required', 400);
    }
    $goalId = (int) $_GET['goal_id'];
    $stmt = mysqli_prepare($conn, "
        SELECT gc.contribution_id AS id, gc.goal_id AS goalId,
               gc.amount, gc.contribution_date AS date, gc.description
        FROM Goal_Contribution gc
        JOIN Financial_Goals g ON g.goal_id = gc.goal_id
        WHERE gc.goal_id = ? AND g.user_id = ?
        ORDER BY gc.contribution_date DESC, gc.contribution_id DESC
    ");
    mysqli_stmt_bind_param($stmt, 'ii', $goalId, $userId);
    mysqli_stmt_execute($stmt);
    $rows = mysqli_fetch_all(mysqli_stmt_get_result($stmt), MYSQLI_ASSOC);
    foreach ($rows as &$row) {
        $row['id'] = (int) $row['id'];
        $row['goalId'] = (int) $row['goalId'];
        $row['amount'] = (float) $row['amount'];
    }
    send_success($rows);
}

// Check goal ownership and validate the amount before inserting.
if ($method === 'POST') {
    // A goal ID alone is not authority: verify that this user owns the goal.
    $input = get_json_input();
    require_fields($input, ['goal_id', 'amount', 'contribution_date', 'description']);
    $goalId = (int) $input['goal_id'];
    $amount = require_positive_number($input['amount'], 'amount');
    $date = require_date($input['contribution_date'], 'contribution_date');
    $description = require_string($input['description'], 'description', 100);

    $goal = mysqli_prepare($conn, 'SELECT goal_id FROM Financial_Goals WHERE goal_id = ? AND user_id = ?');
    mysqli_stmt_bind_param($goal, 'ii', $goalId, $userId);
    mysqli_stmt_execute($goal);
    if (!mysqli_fetch_assoc(mysqli_stmt_get_result($goal))) send_error('Goal not found', 404);

    $stmt = mysqli_prepare($conn, "
        INSERT INTO Goal_Contribution (goal_id, amount, contribution_date, description)
        VALUES (?, ?, ?, ?)
    ");
    mysqli_stmt_bind_param($stmt, 'idss', $goalId, $amount, $date, $description);
    mysqli_stmt_execute($stmt);
    send_success([
        'id' => mysqli_insert_id($conn),
        'goalId' => $goalId,
        'amount' => $amount,
        'date' => $date,
        'description' => $description,
    ], 'Contribution added', 201);
}

// Remove a contribution only when its goal belongs to this user.
if ($method === 'DELETE') {
    if (!$id) send_error('Contribution ID required', 400);
    $stmt = mysqli_prepare($conn, "
        DELETE gc FROM Goal_Contribution gc
        JOIN Financial_Goals g ON g.goal_id = gc.goal_id
        WHERE gc.contribution_id = ? AND g.user_id = ?
    ");
    mysqli_stmt_bind_param($stmt, 'ii', $id, $userId);
    mysqli_stmt_execute($stmt);
    if (mysqli_stmt_affected_rows($stmt) === 0) send_error('Contribution not found', 404);
    send_success(null, 'Contribution deleted');
}

send_error('Method not allowed', 405);
