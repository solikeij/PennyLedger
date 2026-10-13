<?php

require __DIR__ . '/../helpers/budget_performance.php';
function check($condition, $message)
{
    if (!$condition)
        throw new RuntimeException($message);
}
function budget($id, $category, $limit, $name = 'Food', $start = '2026-10-01', $end = '2026-10-31')
{
    return ['budget_id' => $id, 'category_id' => $category, 'budget_amount' => $limit, 'category_name' => $name, 'budget_period' => 'monthly', 'start_date' => $start, 'end_date' => $end];
}
function tx($id, $category, $amount, $date = '2026-10-12', $archived = false)
{
    return ['transaction_id' => $id, 'category_id' => $category, 'amount' => $amount, 'transaction_date' => $date, 'description' => 'Expense', 'category_name' => 'Food', 'archived' => $archived];
}
$report = build_budget_performance([budget(1, 1, 100), budget(2, 2, 100), budget(3, 3, 100), budget(4, 4, 100)], [tx(1, 1, 79.99), tx(2, 2, 80), tx(3, 3, 100), tx(4, 4, 100.01, '2026-10-12', true), tx(5, 9, 20)], '2026-10-01', '2026-10-31');
check(array_column($report['budgets'], 'status_flag') === ['On Track', 'Warning', 'Warning', 'Exceeded'], '80% and 100% boundaries');
check(abs($report['budgets'][3]['over_budget_by'] - .01) < .000001, 'Cent precision');
check($report['budgets'][3]['transactions'][0]['archived'], 'Archived expense audit');
check($report['summary']['unbudgeted_spent'] == 20, 'Unbudgeted expenses');
check($report['summary']['on_track_count'] === 1 && $report['summary']['over_budget_count'] === 1, 'Status counts');
$overall = build_budget_performance([budget(1, 1, 100), budget(2, 99, 500, 'Monthly budget')], [tx(1, 1, 120), tx(2, 2, 50)], '2026-10-01', '2026-10-31');
check($overall['summary']['total_allocated'] == 500 && $overall['summary']['total_spent'] == 170, 'No double counting overall plan');
check($overall['summary']['budgeted_spent'] == 170 && $overall['summary']['unbudgeted_spent'] == 0, 'No duplicate covered expenses');
check(count($overall['budgets'][1]['transactions']) === 2, 'Overall plan all categories');
$partial = build_budget_performance([budget(1, 1, 100, 'Food', '2026-09-15', '2026-10-10'), budget(2, 2, 50, 'Travel', '2026-11-01', '2026-11-30')], [tx(1, 1, 10, '2026-10-01'), tx(2, 1, 20, '2026-10-11')], '2026-10-01', '2026-10-31');
check(count($partial['budgets']) === 1 && $partial['budgets'][0]['total_spent'] == 10, 'Intersection of month and budget dates');
$empty = build_budget_performance([], [tx(1, 1, 10)], '2026-02-01', '2026-02-28');
check($empty['summary']['total_allocated'] == 0 && $empty['summary']['unbudgeted_spent'] == 10, 'No budgets with expenses');
$zero = build_budget_performance([budget(1, 1, 0)], [tx(1, 1, 1)], '2026-10-01', '2026-10-31');
check($zero['budgets'][0]['percent_used'] === null && $zero['budgets'][0]['status_flag'] === 'Exceeded', 'Zero limit handled');
echo 'Budget performance calculation checks passed', PHP_EOL;
