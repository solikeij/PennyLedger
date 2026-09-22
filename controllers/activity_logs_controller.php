<?php
    // controllers/activity_logs_controller.php
    // Handles activity logs for the logged-in user.
    // Each activity log belongs to a specific user, so users can
    // only view their own activity history.

    switch ($method) {

        case 'GET':
            // ---- Reading activity logs - must be logged in ----
            // GET requests get the token from the URL query string.
            // Example: /activity-logs?token=abc123

            $user_id = require_auth($conn, $_GET);

            if ($id) {
                // GET /activity-logs/5 - get one specific activity log
                // Check both activity_id and user_id so users can only
                // access their own activity logs.

                $stmt = mysqli_prepare($conn, "
                    SELECT *
                    FROM Activity_Logs
                    WHERE activity_id = ? AND user_id = ?
                ");

                mysqli_stmt_bind_param($stmt, "ii", $id, $user_id);
                mysqli_stmt_execute($stmt);

                $result = mysqli_stmt_get_result($stmt);
                $activity = mysqli_fetch_assoc($result);

                $activity
                    ? send_success($activity)
                    : send_error('Activity log not found', 404);

            } else {
                // GET /activity-logs - get all activity logs
                // belonging to the logged-in user.

                $stmt = mysqli_prepare($conn, "
                    SELECT *
                    FROM Activity_Logs
                    WHERE user_id = ?
                    ORDER BY activity_date DESC
                ");

                mysqli_stmt_bind_param($stmt, "i", $user_id);
                mysqli_stmt_execute($stmt);

                $result = mysqli_stmt_get_result($stmt);
                $activities = mysqli_fetch_all($result, MYSQLI_ASSOC);

                send_success($activities);
            }

            break;


        case 'POST':
            // ---- Creating an activity log ----
            // The user must be logged in before creating a log.

            $input = get_json_input();
            $user_id = require_auth($conn, $input);

            require_fields($input, [
                'activity_type_id',
                'activity_description',
                'activity_date'
            ]);

            // Make sure the activity type exists.
            $stmt = mysqli_prepare($conn, "
                SELECT activity_type_id
                FROM Activity_Types
                WHERE activity_type_id = ?
            ");

            mysqli_stmt_bind_param(
                $stmt,
                "i",
                $input['activity_type_id']
            );

            mysqli_stmt_execute($stmt);

            $result = mysqli_stmt_get_result($stmt);

            if (!mysqli_fetch_assoc($result)) {
                send_error('Activity type not found', 404);
            }

            // Insert the activity log.
            $stmt = mysqli_prepare($conn, "
                INSERT INTO Activity_Logs
                (
                    user_id,
                    activity_type_id,
                    activity_description,
                    activity_date
                )
                VALUES (?, ?, ?, ?)
            ");

            mysqli_stmt_bind_param(
                $stmt,
                "iiss",
                $user_id,
                $input['activity_type_id'],
                $input['activity_description'],
                $input['activity_date']
            );

            mysqli_stmt_execute($stmt)
                ? send_success(
                    ['activity_id' => mysqli_insert_id($conn)],
                    'Activity log created',
                    201
                )
                : send_error(mysqli_error($conn), 500);

            break;


        case 'DELETE':
            // ---- Deleting an activity log ----
            // A user can only delete their own activity log.

            if (!$id) {
                send_error('Activity ID required', 400);
            }

            $input = get_json_input();
            $user_id = require_auth($conn, $input);

            $stmt = mysqli_prepare($conn, "
                DELETE FROM Activity_Logs
                WHERE activity_id = ? AND user_id = ?
            ");

            mysqli_stmt_bind_param(
                $stmt,
                "ii",
                $id,
                $user_id
            );

            mysqli_stmt_execute($stmt);

            mysqli_stmt_affected_rows($stmt) > 0
                ? send_success(null, 'Activity log deleted')
                : send_error(
                    'Activity log not found or not yours to delete',
                    404
                );

            break;


        default:
            send_error('Method not allowed', 405);
            break;
    }