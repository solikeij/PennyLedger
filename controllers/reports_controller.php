<?php
    // controllers/reports_controller.php
    // Handles financial reports for the logged-in user.
    // Reports are calculated from the user's transactions instead
    // of being stored in a separate database table.

    switch ($method) {

        case 'GET':
            // ---- Financial summary report ----
            // GET /reports?token=abc123
            // The token is passed through the URL for GET requests.

            $user_id = require_auth($conn, $_GET);

            // Get optional date filters.
            $start_date = $_GET['start_date'] ?? null;
            $end_date = $_GET['end_date'] ?? null;

            // Build the query for the user's transactions.
            $sql = "
                SELECT
                    SUM(
                        CASE
                            WHEN transaction_type_id = 1
                            THEN amount
                            ELSE 0
                        END
                    ) AS total_income,

                    SUM(
                        CASE
                            WHEN transaction_type_id = 2
                            THEN amount
                            ELSE 0
                        END
                    ) AS total_expense

                FROM Transactions
                WHERE user_id = ?
            ";

            $types = "i";
            $params = [$user_id];

            // Filter by starting date if provided.
            if (!empty($start_date)) {
                $sql .= " AND transaction_date >= ?";
                $types .= "s";
                $params[] = $start_date;
            }

            // Filter by ending date if provided.
            if (!empty($end_date)) {
                $sql .= " AND transaction_date <= ?";
                $types .= "s";
                $params[] = $end_date;
            }

            $stmt = mysqli_prepare($conn, $sql);

            mysqli_stmt_bind_param(
                $stmt,
                $types,
                ...$params
            );

            mysqli_stmt_execute($stmt);

            $result = mysqli_stmt_get_result($stmt);
            $summary = mysqli_fetch_assoc($result);

            $total_income = $summary['total_income'] ?? 0;
            $total_expense = $summary['total_expense'] ?? 0;

            // Calculate the remaining balance.
            $balance = $total_income - $total_expense;

            $report = [
                'total_income' => $total_income,
                'total_expense' => $total_expense,
                'balance' => $balance
            ];

            send_success($report);

            break;


        default:
            send_error('Method not allowed', 405);
            break;
    }