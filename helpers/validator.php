<?php
// Purpose: Check required fields and common value formats in API input.
// Used by controllers to return field-specific validation errors.

// REVISED from helpers/validator.php. These checks return field-specific 422
// errors so forms can explain exactly which value must be corrected.

function require_fields(array $data, array $required): void
{
    $errors = [];
    foreach ($required as $field) {
        if (!array_key_exists($field, $data) || $data[$field] === '' || $data[$field] === null) {
            $errors[$field] = 'This field is required';
        }
    }

    if ($errors !== []) {
        send_error('Validation failed', 422, $errors);
    }
}

function require_positive_number(mixed $value, string $field): float
{
    if (!is_numeric($value) || !is_finite((float) $value) || round((float) $value, 2) <= 0) {
        send_error('Validation failed', 422, [$field => 'Must be greater than zero']);
    }

    return round((float) $value, 2);
}

function require_date(mixed $value, string $field): string
{
    if (!is_string($value) || !preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/D', $value)) {
        send_error('Validation failed', 422, [$field => 'Use YYYY-MM-DD']);
    }
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) {
        send_error('Validation failed', 422, [$field => 'Use YYYY-MM-DD']);
    }

    return $value;
}

function require_enum(mixed $value, string $field, array $allowed): string
{
    if (!in_array($value, $allowed, true)) {
        send_error('Validation failed', 422, [
            $field => 'Allowed values: ' . implode(', ', $allowed),
        ]);
    }

    return (string) $value;
}

function require_string(mixed $value, string $field, int $maxLength): string
{
    if (!is_string($value)) send_error('Validation failed', 422, [$field => 'Must be text']);
    $value = trim($value);
    if ($value === '' || mb_strlen($value) > $maxLength) {
        send_error('Validation failed', 422, [
            $field => "Must be between 1 and {$maxLength} characters",
        ]);
    }

    return $value;
}

// Validate category labels before saving them.
function require_category_name(mixed $value): string
{
    $message = null;
    if (!is_string($value)) {
        $message = 'Category must be text';
    } else {
        $value = trim($value);
        if ($value === '') {
            $message = 'Enter a category name';
        } elseif (!mb_check_encoding($value, 'UTF-8') || mb_strlen($value) > 100) {
            $message = 'Category must be valid text between 1 and 100 characters';
        } elseif (preg_match('/\p{N}/u', $value)) {
            $message = 'Category cannot contain numbers';
        } elseif (!preg_match("/^[\p{L}\p{M} &'\-]+$/u", $value) || !preg_match('/\p{L}/u', $value)) {
            $message = 'Category must contain letters; only spaces, apostrophes, hyphens, and & are allowed';
        }
    }
    if ($message !== null) {
        send_error($message, 422, ['category_name' => $message]);
    }
    return $value;
}

function require_positive_id(mixed $value, string $field): int
{
    if ((!is_int($value) && !is_string($value)) || !preg_match('/^[1-9][0-9]*$/D', (string) $value) || filter_var($value, FILTER_VALIDATE_INT) === false) {
        send_error('Validation failed', 422, [$field => 'Choose a valid option']);
    }
    return (int) $value;
}
