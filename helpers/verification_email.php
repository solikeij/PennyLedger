<?php
// Branded verification email: inline styles, embedded images and plain-text fallback.
function verification_email_html(string $code, string $name = '', ?DateTimeImmutable $sentAt = null): string
{
    $safeCode = htmlspecialchars($code, ENT_QUOTES, 'UTF-8');
    $safeName = htmlspecialchars(trim($name), ENT_QUOTES, 'UTF-8');
    $greeting = $safeName !== '' ? "Hi, <strong>{$safeName}</strong>" : 'Hi';
    $sentAt ??= new DateTimeImmutable('now', new DateTimeZone('Asia/Singapore'));
    $date = htmlspecialchars($sentAt->format('D, M j Y'), ENT_QUOTES, 'UTF-8');
    return <<<HTML
<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Verify your PennyLedger email</title></head>
<body style="margin:0;padding:0;background:#f3f4f1;color:#111111;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">Your PennyLedger verification code is {$safeCode}. It expires in 10 minutes.</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f3f4f1;">
<tr><td align="center" style="padding:20px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;border-collapse:collapse;background:#ffffff;">
<tr><td align="center" bgcolor="#d4edaf" style="padding:30px 24px 24px;background:#d4edaf;">
<img src="cid:penny-logo" width="60" alt="" style="display:block;width:60px;height:auto;border:0;margin:0 auto 10px;">
<h1 style="margin:0 0 10px;font-size:20px;line-height:1.2;font-weight:700;color:#192522;">PennyLedger</h1>
<span style="display:inline-block;padding:5px 16px;border:1px solid #a0b384;border-radius:20px;color:#40503a;font-size:13px;line-height:1.4;">Personal Budget &amp; Expense Tracker</span>
</td></tr>
<tr><td style="padding:26px 28px 18px;"><p style="margin:0;font-size:14px;line-height:1.6;">{$greeting}, here is your verification code.</p></td></tr>
<tr><td style="padding:0 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#e3f2c9" style="border:1px solid #b2ce8f;border-radius:12px;background:#e3f2c9;background-image:linear-gradient(145deg,#f3fae7,#d9edba);">
<tr><td style="padding:22px 24px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
<td width="55%" valign="top"><img src="cid:penny-peso" width="170" alt="" style="display:block;width:100%;max-width:170px;height:auto;opacity:.2;border:0;"></td>
<td align="right" valign="top"><span style="display:inline-block;padding:7px 9px;border:1px solid #bdd0a4;border-radius:5px;background:#cfdfbc;color:#47513e;font-size:12px;white-space:nowrap;">{$date}</span></td>
</tr></table>
</td></tr>
<tr><td align="center" style="padding:6px 12px 14px;color:#35432c;font-size:34px;line-height:1.3;font-weight:700;letter-spacing:7px;">{$safeCode}</td></tr>
<tr><td style="padding:0 24px 26px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:2px solid #9caf85;"><tr><td style="padding-top:16px;">
<p style="margin:0 0 16px;font-size:14px;line-height:1.5;">Hello,</p>
<p style="margin:0 0 16px;font-size:14px;line-height:1.5;">We received a request to create a PennyLedger account with this email address. Enter the code above on the verification page to finish setting up your account.</p>
<p style="margin:0 0 16px;font-size:14px;line-height:1.5;">This code expires in <strong>10 minutes</strong>. For your security, do not share it with anyone.</p>
<p style="margin:0;font-size:14px;line-height:1.5;">If you did not request a PennyLedger account, you can ignore this email.</p>
</td></tr></table>
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:18px 28px 30px;color:#62685f;font-size:11px;line-height:1.6;">This is an automated account verification message from PennyLedger.</td></tr>
</table></td></tr></table>
</body></html>
HTML;
}

function verification_email_text(string $code, string $name = ''): string
{
    $greeting = trim($name) !== '' ? 'Hi, ' . trim($name) : 'Hi';
    return "PennyLedger - Personal Budget & Expense Tracker\n\n"
        . "{$greeting}, here is your verification code.\n\n"
        . "We received a request to create a PennyLedger account with this email address.\n"
        . "Enter this code on the verification page: {$code}\n\n"
        . "This code expires in 10 minutes. Do not share it with anyone.\n\n"
        . "If you did not request a PennyLedger account, you can ignore this email.\n";
}
