<?php 
    // controllers/auth_controller.php 
    // Handles account creation, login, and logout. 
    // index.php already gave us: $conn (database), $method (GET/POST/etc), 
    // and $action (register, login, or logout - taken from the URL). 
 
    switch ($action) { 
        case 'register': 
 
            if ($method !== 'POST')  { 
                send_error('Method not allowed', 405); 
            } 
 
            // Read the JSON body React sent, e.g. {"first_name": "Daniel", ...} 
            $input = get_json_input(); 
 
            // Make sure none of these are missing before we go any further. 
            // If something's missing, this stops the script and sends an error 
            require_fields($input, ['first_name', 'last_name', 'email', 'password']); 
 
            // Check if this email is already used by someone else 
            $stmt = mysqli_prepare($conn, "SELECT user_id FROM Users WHERE email = ?"); 
            mysqli_stmt_bind_param($stmt, "s", $input['email']); // 's' = String 
            mysqli_stmt_execute($stmt); 
            $existing = mysqli_stmt_get_result($stmt); 
             
            // fetch_assoc() returns a row if one was found, or null if not. 
            // If it found something, that email is already taken. 
            if (mysqli_fetch_assoc($existing)) { 
                    // 409 = "Conflict" - the standard status for "this already exists" 
                send_error('Email is already registered', 409); 
            } 
             
            // Turn the plain-text password into a secure, scrambled version. 
            $hashedPassword = password_hash($input['password'], PASSWORD_DEFAULT); 
 
            // NOW() is a MySQL function that fills in the current date/time 
            // automatically - we don't need to send that from PHP. 
            $stmt = mysqli_prepare($conn, "INSERT INTO Users  
                                            (first_name, last_name, email, password, created_at) 
                                            VALUES  
                                                (?, ?, ?, ?, NOW())"); 
             
            mysqli_stmt_bind_param( 
                $stmt, "ssss", 
                $input['first_name'], 
                $input['last_name'], 
                $input['email'], 
                $hashedPassword 
            ); 
             
            // If the insert worked: continue with OTP creation. 
            if (!mysqli_stmt_execute($stmt)) {
                send_error(mysqli_error($conn), 500);
            }

            // Get the ID of the user we just created.
            $user_id = mysqli_insert_id($conn);

            // Generate a random 6-digit OTP for email verification.
            $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

            // The OTP will only be valid for 10 minutes.
            $expires_at = date('Y-m-d H:i:s', time() + 600);

            // Save the OTP in the Otp_Codes table so we can verify it later.
            $stmt = mysqli_prepare($conn, "INSERT INTO Otp_Codes
                                            (user_id, code, purpose, expires_at)
                                            VALUES
                                            (?, ?, ?, ?)");
            
            $purpose = 'email_verification';

            mysqli_stmt_bind_param(
                $stmt,
                "isss",
                $user_id,
                $otp,
                $purpose,
                $expires_at
            );

            if (!mysqli_stmt_execute($stmt)) {
                send_error(mysqli_error($conn), 500);
            }

            // Send the OTP to the email address used during registration.
            $emailBody = '
                <h2>Personal Budget System</h2>
                <p>Hello ' . htmlspecialchars($input['first_name']) . '!</p>
                <p>Your email verification code is:</p>

                <h1>' . $otp . '</h1>

                <p>This OTP will expire in 10 minutes.</p>
                <p>If you did not create this account, you can ignore this email.</p>
            ';

            $sent = send_email(
                $input['email'],
                'Personal Budget System - Email Verification',
                $emailBody
            );

            if (!$sent) {
                send_error('Account created, but failed to send verification email', 500);
            }

            // Return the new user's ID and tell them to check their email.
            send_success(
                ['user_id' => $user_id],
                'Registered Successfully. Please check your email for the OTP.',
                201
            );

            break; 
         
        case 'verify-otp':

            if ($method !== 'POST') {
                send_error('Method not allowed', 405);
            }

            // Read the email and OTP sent by the user.
            $input = get_json_input();

            // Both email and OTP are required to verify the account.
            require_fields($input, ['email', 'otp']);

            // Find the user using the email they registered with.
            $stmt = mysqli_prepare($conn, "SELECT user_id FROM Users WHERE email = ?");
            mysqli_stmt_bind_param($stmt, "s", $input['email']);
            mysqli_stmt_execute($stmt);
            $result = mysqli_stmt_get_result($stmt);
            $user = mysqli_fetch_assoc($result);

            if (!$user) {
                send_error('User not found', 404);
            }

            // Find the latest unused OTP for this user's email verification.
            $stmt = mysqli_prepare($conn, "SELECT otp_id, code, expires_at
                                            FROM Otp_Codes
                                            WHERE user_id = ?
                                            AND purpose = 'email_verification'
                                            AND used = 0
                                            ORDER BY otp_id DESC
                                            LIMIT 1");

            mysqli_stmt_bind_param($stmt, "i", $user['user_id']);
            mysqli_stmt_execute($stmt);
            $result = mysqli_stmt_get_result($stmt);
            $otpData = mysqli_fetch_assoc($result);

            if (!$otpData) {
                send_error('OTP not found or already used', 400);
            }

            // Check if the OTP has already expired.
            if (strtotime($otpData['expires_at']) < time()) {
                send_error('OTP has expired', 400);
            }

            // Check if the OTP entered by the user matches the saved OTP.
            if ($input['otp'] !== $otpData['code']) {
                send_error('Invalid OTP', 400);
            }

            // Mark the OTP as used so it cannot be reused.
            $stmt = mysqli_prepare($conn, "UPDATE Otp_Codes
                                            SET used = 1
                                            WHERE otp_id = ?");

            mysqli_stmt_bind_param($stmt, "i", $otpData['otp_id']);
            mysqli_stmt_execute($stmt);

            // Mark the user's email as verified.
            $stmt = mysqli_prepare($conn, "UPDATE Users
                                            SET email_verified = 1
                                            WHERE user_id = ?");

            mysqli_stmt_bind_param($stmt, "i", $user['user_id']);
            mysqli_stmt_execute($stmt);

            send_success(null, 'Email verified successfully');

            break;
        
        case 'login': 
 
            if ($method !== 'POST') { 
                send_error('Method not allowed', 405); 
            } 
 
            // Look up the user by the email they typed 
            $input = get_json_input(); 
            require_fields($input, ['email', 'password']); 
 
            // $user will be the full row (all their info) if found, or null if not. 
            $stmt = mysqli_prepare($conn, "SELECT * FROM Users WHERE email = ?"); 
            mysqli_stmt_bind_param($stmt, "s", $input['email']); 
            mysqli_stmt_execute($stmt); 
            $result = mysqli_stmt_get_result($stmt); 
            $user = mysqli_fetch_assoc($result); 
             
            // Two checks combined with OR (any one failing means "reject"): 
            if (!$user || !password_verify($input['password'], $user['password'])) { 
                send_error('Invalid email or password', 401); 
            } 
 
            // Generate a long, random, unguessable string to act as their 
            // "login pass" for future requests. 
            $token = bin2hex(random_bytes(32)); 
            // random_bytes(32) makes 32 bytes of truly random data. 
            // bin2hex() converts that into readable letters/numbers (hex text), 
 
            // "i" = integer (user_id), "s" = string (the token itself) 
            $stmt = mysqli_prepare($conn, "INSERT INTO Tokens (user_id, token) 
                                            VALUES  
                                                (?, ?)"); 
            mysqli_stmt_bind_param($stmt, "is", $user['user_id'], $token); 
 
            // Save this token in the database, linked to this user, so 
            // require_auth() can look it up later on protected requests. 
            mysqli_stmt_execute($stmt); 
 
 
            send_success([ 
                // React will save this (e.g. in memory or localStorage) 
                'token' => $token, 
             
                // Notice: we deliberately do NOT include $user['password'] 
                // here, even though it's in $user - never send password 
                // data back to the frontend, hashed or not. 
                'user' => [ 
                    'user_id' => $user['user_id'], 
                    'first_name' => $user['first_name'], 
                    'last_name'  => $user['last_name'], 
                    'email'      => $user['email'], 
                ] 
            ], 'Login Successful'); 
            break; 
 
        case 'logout': 
 
            if ($method !== 'POST') { 
                send_error('Method not allowed', 405); 
            } 
 
            // Confirms they're sending a real, valid token before we let them 
            // "log out" - reuses the same check from helpers/auth.php. 
            $input = get_json_input(); // expects {"token": "abc123..."} 
            $user_id = require_auth($conn, $input); 
            // We don't need the returned user_id here, just the validation 
            // that the token itself is real before we delete it. 
 
            // Removing the token row means it can never be used again - 
            // that IS what "logging out" means in a token-based system. 
            $stmt = mysqli_prepare($conn, "DELETE FROM Tokens WHERE token = ?"); 
            mysqli_stmt_bind_param($stmt, "s", $input['token']); // use $input['token'] directly - no header needed 
            mysqli_stmt_execute($stmt); 
 
            send_success(null, 'Logged out successfully'); 
            break; // <-- this was missing before - without it, PHP falls through to 'default' below 
 
        default: 
             // Someone requested an action we don't recognize, e.g. /auth/blah 
            send_error('Action not found', 404); 
            break; 
    }