<?php
    use PHPMailer\PHPMailer\PHPMailer;
    use PHPMailer\PHPMailer\Exception;

    // Load PHPMailer's Composer autoloader.
    require_once __DIR__ . '/../vendor/autoload.php';

    // Load our Gmail configuration.
    require_once __DIR__ . '/../config/mail.php';


    // Function used to send an email.
    function send_email($to, $subject, $body) {

        // Create a new PHPMailer object.
        // true enables PHPMailer's exceptions for errors.
        $mail = new PHPMailer(true);

        try {

            // Use SMTP instead of PHP's default mail function.
            $mail->isSMTP();

            // Gmail SMTP server.
            $mail->Host = MAIL_HOST;

            // Gmail requires authentication.
            $mail->SMTPAuth = true;

            // Gmail account used to send the email.
            $mail->Username = MAIL_USERNAME;

            // Google App Password.
            $mail->Password = MAIL_PASSWORD;

            // Use STARTTLS encryption for the connection.
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;

            // Gmail SMTP port.
            $mail->Port = MAIL_PORT;


            // Set the sender email and sender name.
            $mail->setFrom(
                MAIL_FROM,
                MAIL_FROM_NAME
            );

            // Set the recipient email.
            $mail->addAddress($to);


            // Allow HTML content inside the email.
            $mail->isHTML(true);

            // Support UTF-8 characters.
            $mail->CharSet = 'UTF-8';


            // Set the email subject.
            $mail->Subject = $subject;

            // Set the HTML email body.
            $mail->Body = $body;

            // Create a simple text version for email clients
            // that do not support HTML.
            $mail->AltBody = strip_tags($body);


            // Send the email.
            $mail->send();

            // Return true if the email was successfully sent.
            return true;

        } catch (Exception $e) {

            // Return false if PHPMailer encountered an error.
            return false;
        }
    }