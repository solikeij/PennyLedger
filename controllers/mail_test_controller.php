<?php

    // This endpoint only accepts POST requests.
    if ($method !== 'POST') {
        send_error('Method not allowed', 405);
    }


    // Get the JSON data from the request body.
    $input = get_json_input();


    // Make sure the email field was provided.
    require_fields($input, [
        'email'
    ]);


    // Send the test email.
    $sent = send_email(
        $input['email'],
        'Personal Budget System - Test Email',

        // HTML content of the email.
        '
            <h2>Personal Budget System</h2>

            <p>Hello!</p>

            <p>
                This is a test email from the
                Personal Budget System.
            </p>

            <p>
                If you received this message,
                PHPMailer is working correctly.
            </p>
        '
    );


    // Return the appropriate response.
    $sent
        ? send_success(null, 'Email sent successfully')
        : send_error('Failed to send email', 500);