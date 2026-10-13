<?php
// Generate a local design preview without sending mail or creating a real code.
require __DIR__ . '/../helpers/verification_email.php';
require __DIR__ . '/../vendor/autoload.php';

$html = verification_email_html('803074', 'John Doe', new DateTimeImmutable('2026-05-08', new DateTimeZone('Asia/Singapore')));
$mail = new PHPMailer\PHPMailer\PHPMailer(true);
$mail->setFrom('preview@example.com', 'PennyLedger');
$mail->addAddress('recipient@example.com');
$mail->Subject = 'Verification preview';
$mail->isHTML(true);
$mail->Body = $html;
$mail->AltBody = verification_email_text('803074', 'John Doe');
foreach (['penny-logo' => 'logo.png', 'penny-peso' => 'peso.png'] as $cid => $filename) {
    $path = __DIR__ . '/../public/email-assets/' . $filename;
    $mail->addEmbeddedImage($path, $cid, $filename, 'base64', 'image/png');
    $html = str_replace('cid:' . $cid, 'data:image/png;base64,' . base64_encode(file_get_contents($path)), $html);
}
$mail->preSend(); // Construct MIME without opening a connection or sending.
$mime = $mail->getSentMIMEMessage();
foreach (['Content-ID: <penny-logo>', 'Content-ID: <penny-peso>', 'multipart/alternative'] as $expected) {
    if (!str_contains($mime, $expected)) throw new RuntimeException('Missing MIME component: ' . $expected);
}
$escaped = verification_email_html('012345', '<script>unsafe</script>');
if (str_contains($escaped, '<script>') || !str_contains($escaped, '012345')) {
    throw new RuntimeException('Name escaping or leading-zero code failed.');
}
file_put_contents(__DIR__ . '/../verification-email-preview.html', $html);
echo "Preview saved to verification-email-preview.html. Embedded MIME images, plain text, escaping, and leading-zero code checked. No email sent.\n";
