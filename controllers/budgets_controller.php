<?php
    // controllers/budgets_controller.php
    // Handles budgets for the logged-in user.
    // Each budget belongs to a specific user and category, so authentication
    // is required for every budget request.

    switch ($method) {

        case 'GET':
            // ---- Reading budgets - must be logged in ----
            // GET requests get the token from the URL query string.
            // Example: /budgets?token=abc123

            $user_id = require_auth($conn, $_GET);

            if ($id) {
                // GET /budgets/5 - get one specific budget
                // Check both budget_id and user_id so users can only see
                // their own budgets.

                $stmt = mysqli_prepare($conn, "
                    SELECT *
                    FROM Budgets
                    WHERE budget_id = ? AND user_id = ?
                ");

                mysqli_stmt_bind_param($stmt, "ii", $id, $user_id);
                mysqli_stmt_execute($stmt);

                $result = mysqli_stmt_get_result($stmt);
                $budget = mysqli_fetch_assoc($result);

                $budget
                    ? send_success($budget)
                    : send_error('Budget not found', 404);

            } else {
                // GET /budgets - get all budgets belonging to the user

                $stmt = mysqli_prepare($conn, "
                    SELECT *
                    FROM Budgets
                    WHERE user_id = ?
                    ORDER BY start_date DESC
                ");

                mysqli_stmt_bind_param($stmt, "i", $user_id);
                mysqli_stmt_execute($stmt);

                $result = mysqli_stmt_get_result($stmt);
                $budgets = mysqli_fetch_all($result, MYSQLI_ASSOC);

                send_success($budgets);
            }

            break;


        case 'POST':
            // ---- Creating a budget ----
            // The user must be logged in before creating a budget.

            $input = get_json_input();
            $user_id = require_auth($conn, $input);

            require_fields($input, [
                'category_id',
                'budget_amount',
                'start_date',
                'end_date'
            ]);

            // Budget amount must be greater than zero.
            if (!is_positive_number($input['budget_amount'])) {
                send_error('Budget amount must be a positive number', 400);
            }

            // Make sure the category exists.
            $stmt = mysqli_prepare($conn, "
                SELECT category_id
                FROM Categories
                WHERE category_id = ?
            ");

            mysqli_stmt_bind_param(
                $stmt,
                "i",
                $input['category_id']
            );

            mysqli_stmt_execute($stmt);

            $result = mysqli_stmt_get_result($stmt);

            if (!mysqli_fetch_assoc($result)) {
                send_error('Category not found', 404);
            }

            // Make sure the date range is valid.
            if ($input['start_date'] > $input['end_date']) {
                send_error('Start date cannot be later than end date', 400);
            }

            // Insert the new budget.
            $stmt = mysqli_prepare($conn, "
                INSERT INTO Budgets
                (
                    user_id,
                    category_id,
                    budget_amount,
                    start_date,
                    end_date,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, NOW())
            ");

            mysqli_stmt_bind_param(
                $stmt,
                "iidss",
                $user_id,
                $input['category_id'],
                $input['budget_amount'],
                $input['start_date'],
                $input['end_date']
            );

            mysqli_stmt_execute($stmt)
                ? send_success(
                    ['budget_id' => mysqli_insert_id($conn)],
                    'Budget created',
                    201
                )
                : send_error(mysqli_error($conn), 500);

            break;


        case 'PUT':
            // ---- Updating a budget ----
            // A budget can only be edited by the user who owns it.

            if (!$id) {
                send_error('Budget ID required', 400);
            }

            $input = get_json_input();
            $user_id = require_auth($conn, $input);

            require_fields($input, [
                'category_id',
                'budget_amount',
                'start_date',
                'end_date'
            ]);

            if (!is_positive_number($input['budget_amount'])) {
                send_error('Budget amount must be a positive number', 400);
            }

            if ($input['start_date'] > $input['end_date']) {
                send_error('Start date cannot be later than end date', 400);
            }

            // Update only if the budget belongs to the logged-in user.
            $stmt = mysqli_prepare($conn, "
                UPDATE Budgets
                SET
                    category_id = ?,
                    budget_amount = ?,
                    start_date = ?,
                    end_date = ?
                WHERE budget_id = ? AND user_id = ?
            ");

            mysqli_stmt_bind_param(
                $stmt,
                "idssii",
                $input['category_id'],
                $input['budget_amount'],
                $input['start_date'],
                $input['end_date'],
                $id,
                $user_id
            );

            mysqli_stmt_execute($stmt);

            mysqli_stmt_affected_rows($stmt) > 0
                ? send_success(null, 'Budget updated')
                : send_error(
                    'Budget not found or not yours to edit',
                    404
                );

            break;


        case 'DELETE':
            // ---- Deleting a budget ----
            // A budget can only be deleted by its owner.

            if (!$id) {
                send_error('Budget ID required', 400);
            }

            $input = get_json_input();
            $user_id = require_auth($conn, $input);

            $stmt = mysqli_prepare($conn, "
                DELETE FROM Budgets
                WHERE budget_id = ? AND user_id = ?
            ");

            mysqli_stmt_bind_param(
                $stmt,
                "ii",
                $id,
                $user_id
            );

            mysqli_stmt_execute($stmt);

            mysqli_stmt_affected_rows($stmt) > 0
                ? send_success(null, 'Budget deleted')
                : send_error(
                    'Budget not found or not yours to delete',
                    404
                );

            break;


        default:
            send_error('Method not allowed', 405);
            break;
    }