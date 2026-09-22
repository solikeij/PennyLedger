<?php
    // This file is the "front door" - every request from React comes here first.

    // Let React talk to this PHP file (browsers block this by default)
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");

    // Tell whoever is asking that we will reply in JSON
    header("Content-Type: application/json");

    // Browsers send a test request first (OPTIONS) before the real one.
    // Just say "okay" and stop - nothing else to do here.
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }

    // Connect to the database
    require __DIR__ . '/../config/db.php';

    // Load our reusable toolbox functions
    require __DIR__ . '/../helpers/response.php';   // for sending answers back
    require __DIR__ . '/../helpers/auth.php';       // for checking login
    require __DIR__ . '/../helpers/validator.php';  // for checking required fields

    // Load PHPMailer functionality.
    require __DIR__ . '/../helpers/mailer.php';

    // Figure out WHAT was requested (which resource, which id)
    // We build this from REQUEST_URI instead of PATH_INFO, because PATH_INFO
    // isn't always reliably set depending on the Apache/XAMPP configuration.

    $scriptName = $_SERVER['SCRIPT_NAME'];
    // e.g. "/IM_SYSTEM_MT/public/index.php" - the path to THIS file itself

    $requestUri = strtok($_SERVER['REQUEST_URI'], '?');
    // e.g. "/IM_SYSTEM_MT/public/index.php/categories/3"
    // strtok(..., '?') cuts off any ?query=string part, we don't need that here

    $request = substr($requestUri, strlen($scriptName));
    // Removes the "/IM_SYSTEM_MT/public/index.php" part, leaving just
    // "/categories/3" - the part we actually care about

    $request = trim($request, '/');
    // Removes leading/trailing slashes -> "categories/3"

    $uri = explode('/', $request);
    // Splits into pieces -> ['categories', '3']

    $resource = $uri[0] ?? null; // which feature (categories, transactions, etc.)
    $id       = $uri[1] ?? null; // which specific item (if any)
    $method   = $_SERVER['REQUEST_METHOD']; // GET, POST, PUT, or DELETE

    // Send the request to the right file based on the resource
    switch ($resource) {

        case 'categories':
            require __DIR__ . '/../controllers/categories_controller.php';
            break;
        
        case 'payment-methods':
            require __DIR__ . '/../controllers/payment_methods_controller.php';
            break;
        
        case 'transactions':
            require __DIR__ . '/../controllers/transactions_controller.php';
            break;
        
        case 'budgets':
            require __DIR__ . '/../controllers/budgets_controller.php';
            break;
        
        case 'goals':
            require __DIR__ . '/../controllers/goals_controller.php';
            break;

        case 'reports':
            require __DIR__ . '/../controllers/reports_controller.php';
            break;
        
        case 'activity-logs':
            require __DIR__ . '/../controllers/activity_logs_controller.php';
            break;

        case 'mail-test':
            require __DIR__ . '/../controllers/mail_test_controller.php';
            break;
            
        case 'transaction-types':
        case 'goal-statuses':
        case 'activity-types':
            // All three of these are simple read-only lookup tables, so they
            // share ONE controller file. We tell that file which table to
            // use by passing along $resource (e.g. "transaction-types").
            $lookup_table = $resource;
            require __DIR__ . '/../controllers/lookups_controller.php';
            break;
            
        case 'auth':
            $action = $id;
            require __DIR__ . '/../controllers/auth_controller.php';
            break;

        default:
            // Nothing matched - the URL is wrong
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Resource not found']);
            break;
}