<?php
    // controllers/goals_controller.php
    // Handles financial goals for the logged-in user.
    // Each goal belongs to a specific user, so users can only
    // view, create, update, and delete their own goals.

    switch ($method) {

        case 'GET':
            // ---- Reading goals - must be logged in ----
            // GET requests get the token from the URL query string.
            // Example: /goals?token=abc123

            $user_id = require_auth($conn, $_GET);

            if ($id) {
                // GET /goals/5 - get one specific goal
                // Check both goal_id and user_id so users can only
                // access their own goals.

                $stmt = mysqli_prepare($conn, "
                    SELECT *
                    FROM Financial_Goals
                    WHERE goal_id = ? AND user_id = ?
                ");

                mysqli_stmt_bind_param($stmt, "ii", $id, $user_id);
                mysqli_stmt_execute($stmt);

                $result = mysqli_stmt_get_result($stmt);
                $goal = mysqli_fetch_assoc($result);

                $goal
                    ? send_success($goal)
                    : send_error('Goal not found', 404);

            } else {
                // GET /goals - get all goals belonging to the user

                $stmt = mysqli_prepare($conn, "
                    SELECT *
                    FROM Financial_Goals
                    WHERE user_id = ?
                    ORDER BY target_date ASC
                ");

                mysqli_stmt_bind_param($stmt, "i", $user_id);
                mysqli_stmt_execute($stmt);

                $result = mysqli_stmt_get_result($stmt);
                $goals = mysqli_fetch_all($result, MYSQLI_ASSOC);

                send_success($goals);
            }

            break;


        case 'POST':
            // ---- Creating a goal ----
            // The user must be logged in before creating a goal.

            $input = get_json_input();
            $user_id = require_auth($conn, $input);

            require_fields($input, [
                'goal_name',
                'target_amount',
                'target_date',
                'status_id'
            ]);

            // Target amount must be greater than zero.
            if (!is_positive_number($input['target_amount'])) {
                send_error('Target amount must be a positive number', 400);
            }

            // Make sure the status exists.
            $stmt = mysqli_prepare($conn, "
                SELECT status_id
                FROM Goal_Statuses
                WHERE status_id = ?
            ");

            mysqli_stmt_bind_param(
                $stmt,
                "i",
                $input['status_id']
            );

            mysqli_stmt_execute($stmt);

            $result = mysqli_stmt_get_result($stmt);

            if (!mysqli_fetch_assoc($result)) {
                send_error('Goal status not found', 404);
            }

            // Insert the new goal.
            $stmt = mysqli_prepare($conn, "
                INSERT INTO Financial_Goals
                (
                    user_id,
                    goal_name,
                    target_amount,
                    target_date,
                    status_id,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, NOW())
            ");

            mysqli_stmt_bind_param(
                $stmt,
                "isdsi",
                $user_id,
                $input['goal_name'],
                $input['target_amount'],
                $input['target_date'],
                $input['status_id']
            );

            mysqli_stmt_execute($stmt)
                ? send_success(
                    ['goal_id' => mysqli_insert_id($conn)],
                    'Goal created',
                    201
                )
                : send_error(mysqli_error($conn), 500);

            break;


        case 'PUT':
            // ---- Updating a goal ----
            // A goal can only be edited by the user who owns it.

            if (!$id) {
                send_error('Goal ID required', 400);
            }

            $input = get_json_input();
            $user_id = require_auth($conn, $input);

            require_fields($input, [
                'goal_name',
                'target_amount',
                'target_date',
                'status_id'
            ]);

            if (!is_positive_number($input['target_amount'])) {
                send_error('Target amount must be a positive number', 400);
            }

            // Make sure the status exists.
            $stmt = mysqli_prepare($conn, "
                SELECT status_id
                FROM Goal_Statuses
                WHERE status_id = ?
            ");

            mysqli_stmt_bind_param(
                $stmt,
                "i",
                $input['status_id']
            );

            mysqli_stmt_execute($stmt);

            $result = mysqli_stmt_get_result($stmt);

            if (!mysqli_fetch_assoc($result)) {
                send_error('Goal status not found', 404);
            }

            // Update only if the goal belongs to the logged-in user.
            $stmt = mysqli_prepare($conn, "
                UPDATE Financial_Goals
                SET
                    goal_name = ?,
                    target_amount = ?,
                    target_date = ?,
                    status_id = ?
                WHERE goal_id = ? AND user_id = ?
            ");

            mysqli_stmt_bind_param(
                $stmt,
                "sdsiii",
                $input['goal_name'],
                $input['target_amount'],
                $input['target_date'],
                $input['status_id'],
                $id,
                $user_id
            );

            mysqli_stmt_execute($stmt);

            mysqli_stmt_affected_rows($stmt) > 0
                ? send_success(null, 'Goal updated')
                : send_error(
                    'Goal not found or not yours to edit',
                    404
                );

            break;


        case 'DELETE':
            // ---- Deleting a goal ----
            // A goal can only be deleted by its owner.

            if (!$id) {
                send_error('Goal ID required', 400);
            }

            $input = get_json_input();
            $user_id = require_auth($conn, $input);

            $stmt = mysqli_prepare($conn, "
                DELETE FROM Financial_Goals
                WHERE goal_id = ? AND user_id = ?
            ");

            mysqli_stmt_bind_param(
                $stmt,
                "ii",
                $id,
                $user_id
            );

            mysqli_stmt_execute($stmt);

            mysqli_stmt_affected_rows($stmt) > 0
                ? send_success(null, 'Goal deleted')
                : send_error(
                    'Goal not found or not yours to delete',
                    404
                );

            break;


        default:
            send_error('Method not allowed', 405);
            break;
    }