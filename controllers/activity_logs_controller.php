<?php
$user = require_auth($conn);
if ($user['role'] !== 'user') send_error('User activity is private', 403);
$userId = (int) $user['user_id'];
if ($method !== 'GET') send_error('Method not allowed', 405);
$where = 'WHERE user_id = ?';
$types = 'i';
$params = [$userId];
$actionFilter = $_GET['action'] ?? '';
if ($actionFilter !== '') {
    require_enum($actionFilter, 'action', ['CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE', 'LOGIN', 'SIGNUP', 'LOGOUT']);
    $where .= ' AND action = ?'; $types .= 's'; $params[] = $actionFilter;
}
foreach (['from', 'to'] as $key) {
    $value = $_GET[$key] ?? '';
    if ($value === '') continue;
    $parsed = is_string($value) ? DateTimeImmutable::createFromFormat('!Y-m-d', $value) : false;
    if (!$parsed || $parsed->format('Y-m-d') !== $value) send_error('Enter a valid date range', 422);
    if ($key === 'from') { $where .= ' AND created_at >= ?'; $params[] = $value; }
    else { $where .= ' AND created_at < ?'; $params[] = $parsed->modify('+1 day')->format('Y-m-d'); }
    $types .= 's';
}
if (!empty($_GET['from']) && !empty($_GET['to']) && $_GET['from'] > $_GET['to']) send_error('Start date must be before end date', 422);
$search = trim((string) ($_GET['q'] ?? ''));
if ($search !== '') {
    $search = '%' . mb_substr($search, 0, 200) . '%';
    $where .= ' AND (description LIKE ? OR related_item LIKE ? OR action LIKE ?)';
    $types .= 'sss'; array_push($params, $search, $search, $search);
}
$count = mysqli_prepare($conn, "SELECT COUNT(*) AS total FROM User_Activity {$where}");
mysqli_stmt_bind_param($count, $types, ...$params);
mysqli_stmt_execute($count);
$total = (int) mysqli_fetch_assoc(mysqli_stmt_get_result($count))['total'];
$page = max(1, (int) ($_GET['page'] ?? 1));
$limit = min(100, max(1, (int) ($_GET['per_page'] ?? 30)));
$page = min($page, max(1, (int) ceil($total / $limit)));
$offset = ($page - 1) * $limit;
$stmt = mysqli_prepare($conn, "SELECT activity_id AS id, action, description, related_item AS relatedItem, amount, created_at AS date FROM User_Activity {$where} ORDER BY created_at DESC, activity_id DESC LIMIT ? OFFSET ?");
$types .= 'ii'; array_push($params, $limit, $offset);
mysqli_stmt_bind_param($stmt, $types, ...$params);
mysqli_stmt_execute($stmt);
$rows = mysqli_fetch_all(mysqli_stmt_get_result($stmt), MYSQLI_ASSOC);
foreach ($rows as &$row) {
    $row['id'] = (int) $row['id'];
    $row['amount'] = $row['amount'] !== null ? (float) $row['amount'] : null;
    $row['date'] = str_replace(' ', 'T', $row['date']);
}
send_success(['items' => $rows, 'page' => $page, 'perPage' => $limit, 'total' => $total]);
