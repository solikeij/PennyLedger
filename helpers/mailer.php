<?php

// Purpose: Send HTML and plain-text emails using SMTP settings.
// Used by auth_controller.php; delivery errors are logged on the server.

// REVISED from helpers/mailer.php. SMTP settings come from config/mail.php,
// and send failures are logged on the server without leaking details to users.

use PHPMailer\PHPMailer\PHPMailer;

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/mail.php';

// Send an SMTP message and log delivery failures for server troubleshooting.
function send_email(string $to, string $subject, string $body, ?string $plainText = null): bool
{
    $plain = $plainText ?? strip_tags($body);

    if (MAIL_USERNAME === '' || MAIL_PASSWORD === '') {
        error_log('Mail environment variables are not configured');
        return false;
    }

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = MAIL_HOST;
        $mail->SMTPAuth = true;
        $mail->Username = MAIL_USERNAME;
        $mail->Password = MAIL_PASSWORD;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = MAIL_PORT;
        $mail->setFrom(MAIL_FROM, MAIL_FROM_NAME);
        $mail->addAddress($to);
        $mail->isHTML(true);
        $mail->CharSet = 'UTF-8';
        $mail->Subject = $subject;
        $mail->Body = $body;
        // Embed artwork locally; email recipients cannot access localhost URLs.
        foreach (['penny-logo' => 'logo.png', 'penny-peso' => 'peso.png'] as $cid => $filename) {
            if (str_contains($body, "cid:{$cid}")) {
                $mail->addEmbeddedImage(__DIR__ . '/../public/email-assets/' . $filename, $cid, $filename, 'base64', 'image/png');
            }
        }
        // OTP emails supply a readable plain-text version; older callers keep
        // the previous fallback without needing to change their call sites.
        $mail->AltBody = $plain;
        $mail->send();
        return true;
    } catch (Throwable $exception) {
        error_log('Mailer error: ' . $exception->getMessage());
        return false;
    }
}
