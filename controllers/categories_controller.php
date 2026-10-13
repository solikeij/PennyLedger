<?php
// Purpose (legacy): Create and manage category choices.
// Status: Not routed by public/index.php; React reads /lookups/categories.

// Editor-only declarations of route inputs; this legacy controller is not routed.
/** @var mysqli $conn */
/** @var string $method */
/** @var int|null $id */

// This file handles everything about "categories".
// If routed later, this file expects $conn, $method, and $id from the router.

// Legacy flow: each branch represents an HTTP operation on categories.
switch ($method) {

    case 'GET':
        // Someone wants to READ data

        if ($id) {

            // They asked for ONE specific category
            $stmt = mysqli_prepare($conn, "SELECT * FROM Categories WHERE category_id = ?");
            mysqli_stmt_bind_param($stmt, "i", $id); // fill in the ? with the id (i = number)
            mysqli_stmt_execute($stmt); // run it
            $result = mysqli_stmt_get_result($stmt);
            $category = mysqli_fetch_assoc($result); // grab that one row

            $category
                ? send_success($category)              // found it - send it back
                : send_error('Category not found', 404); // not found - say so

        } else {
            // They asked for ALL categories

            $result = mysqli_query($conn, "SELECT * FROM Categories");
            $categories = mysqli_fetch_all($result, MYSQLI_ASSOC); // grab every row
            send_success($categories);
        }
        break;

    case 'POST':
        // Someone wants to CREATE a new category

        // require_auth() checks the Authorization header for a valid token.
        $input = get_json_input(); // read what they typed

        $user_id = require_auth($conn, $input);

        $stmt = mysqli_prepare($conn, "INSERT INTO Categories (category_name, transaction_type_id) VALUES (?, ?)");
        mysqli_stmt_bind_param($stmt, "si", $input['category_name'], $input['transaction_type_id']);
        // s = text, i = number - matches the order of the two values above

        mysqli_stmt_execute($stmt)
            ? send_success(['category_id' => mysqli_insert_id($conn)], 'Category created', 201)
            : send_error(mysqli_error($conn), 500);
        break;

    case 'PUT':
        // Someone wants to UPDATE an existing category

        if (!$id) send_error('Category ID required', 400); // need to know which one

        $input = get_json_input();

        // require login before allowing an update
        $user_id = require_auth($conn, $input);

        $stmt = mysqli_prepare($conn, "UPDATE Categories SET category_name = ?, transaction_type_id = ? WHERE category_id = ?");
        mysqli_stmt_bind_param($stmt, "sii", $input['category_name'], $input['transaction_type_id'], $id);

        mysqli_stmt_execute($stmt)
            ? send_success(null, 'Category updated')
            : send_error(mysqli_error($conn), 500);
        break;

    case 'DELETE':
        // Someone wants to REMOVE a category

        if (!$id) send_error('Category ID required', 400);

        //  DELETE now reads a body and requires login
        $input = get_json_input();
        $user_id = require_auth($conn, $input);

        $stmt = mysqli_prepare($conn, "DELETE FROM Categories WHERE category_id = ?");
        mysqli_stmt_bind_param($stmt, "i", $id);

        mysqli_stmt_execute($stmt)
            ? send_success(null, 'Category deleted')
            : send_error(mysqli_error($conn), 500);
        break;

    default:
        send_error('Method not allowed', 405);
        break;
}