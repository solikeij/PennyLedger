<?php
// Purpose (legacy): Create and manage payment-method labels.
// Status: Not routed by public/index.php; React reads /lookups/payment-methods.

// Editor-only declarations of route inputs; this legacy controller is not routed.
/** @var mysqli $conn */
/** @var string $method */
/** @var int|null $id */

// controllers/payment_methods_controller.php
// Handles everything about "payment methods" (Cash, GCash, Bank Transfer, etc).
// This is just a label/category users pick when logging a transaction -
// NOT a real connection to GCash or any payment provider.
// Exact same pattern as categories_controller.php.
// If routed later, this file expects $conn, $method, and $id from the router.

// Legacy flow: dispatch payment-method CRUD by HTTP method.
switch ($method) {
    // Decide what to do based on which HTTP method was used.

    case 'GET':
        // ---- Reading data - open to everyone, no login required ----

        if ($id) {
            // An ID was given in the URL (e.g. /payment-methods/2),
            // so fetch just that one payment method.

            $stmt = mysqli_prepare($conn, "SELECT * FROM Payment_Methods WHERE payment_method_id = ?");
            // Template query with a placeholder (?) instead of putting
            // $id directly into the SQL text - protects against SQL injection.

            mysqli_stmt_bind_param($stmt, "i", $id);
            // Fills in the "?" with $id. "i" means it's an integer.

            mysqli_stmt_execute($stmt);
            // Actually runs the query against the database.

            $result = mysqli_stmt_get_result($stmt);
            // Grabs the result set (rows) that came back.

            $method_row = mysqli_fetch_assoc($result);
            // Pulls ONE row out as an associative array, e.g.
            // ['payment_method_id' => 2, 'payment_method_name' => 'GCash'].
            // Note: named $method_row (not $method) so it doesn't clash
            // with the outer $method variable (GET/POST/etc) from index.php.

            $method_row
                ? send_success($method_row)                    // found it - send it back
                : send_error('Payment method not found', 404); // not found - say so

        } else {
            // No ID given (just /payment-methods) - return ALL of them.

            $result = mysqli_query($conn, "SELECT * FROM Payment_Methods");
            // Simple query - no user-supplied value going into the SQL,
            // so nothing to protect against here.

            $methods = mysqli_fetch_all($result, MYSQLI_ASSOC);
            // Grabs ALL rows at once as an array of associative arrays.

            send_success($methods);
        }
        break;

    case 'POST':
        // ---- Creating a new payment method - must be logged in ----

        $input = get_json_input();
        // Reads the JSON body React sent, which now also includes the
        // login token, e.g. {"token": "abc...", "payment_method_name": "GCash"}

        $user_id = require_auth($conn, $input);
        // Checks $input['token'] is valid. If missing/invalid, this
        // function sends a 401 error and stops the script right here -
        // none of the code below runs.

        require_fields($input, ['payment_method_name']);
        // Makes sure this field exists and isn't empty.

        $stmt = mysqli_prepare($conn, "INSERT INTO Payment_Methods (payment_method_name) VALUES (?)");
        mysqli_stmt_bind_param($stmt, "s", $input['payment_method_name']);
        // "s" = string, since payment_method_name is text.

        mysqli_stmt_execute($stmt)
            ? send_success(['payment_method_id' => mysqli_insert_id($conn)], 'Payment method created', 201)
            : send_error(mysqli_error($conn), 500);
        // If the insert worked: send back the new row's auto-generated ID.
        // If it failed: send back MySQL's actual error message.
        break;

    case 'PUT':
        // ---- Updating an existing payment method - must be logged in ----

        if (!$id) send_error('Payment method ID required', 400);
        // Can't update without knowing WHICH one - stop here if no ID.

        $input = get_json_input();
        $user_id = require_auth($conn, $input);

        require_fields($input, ['payment_method_name']);

        $stmt = mysqli_prepare($conn, "UPDATE Payment_Methods SET payment_method_name = ? WHERE payment_method_id = ?");
        mysqli_stmt_bind_param($stmt, "si", $input['payment_method_name'], $id);
        // "s" for the new name, "i" for the ID of the row being updated.

        mysqli_stmt_execute($stmt)
            ? send_success(null, 'Payment method updated')
            : send_error(mysqli_error($conn), 500);
        break;

    case 'DELETE':
        // ---- Deleting a payment method - must be logged in ----

        if (!$id) send_error('Payment method ID required', 400);

        $input = get_json_input();
        // Even though DELETE has no other data to send, we still need
        // a JSON body just to carry the token, e.g. {"token": "abc..."}

        $user_id = require_auth($conn, $input);

        $stmt = mysqli_prepare($conn, "DELETE FROM Payment_Methods WHERE payment_method_id = ?");
        mysqli_stmt_bind_param($stmt, "i", $id);

        mysqli_stmt_execute($stmt)
            ? send_success(null, 'Payment method deleted')
            : send_error(mysqli_error($conn), 500);
        break;

    default:
        // ---- Any method other than GET/POST/PUT/DELETE ----
        send_error('Method not allowed', 405);
        break;
}