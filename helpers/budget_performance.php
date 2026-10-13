<?php

// Pure calculations shared by the authenticated report endpoint and checks.
function build_budget_performance(array $budgets, array $transactions, string $start, string $end): array
{
    $items = [];
    $monthlyPlans = [];
    $coveredIds = [];
    $monthSpent = 0;
    foreach ($transactions as $tx)
        $monthSpent += (int) round((float) $tx['amount'] * 100);
    foreach ($budgets as $budget) {
        $windowStart = max($start, $budget['start_date']);
        $windowEnd = min($end, $budget['end_date']);
        if ($windowStart > $windowEnd)
            continue;
        $overall = $budget['category_name'] === 'Monthly budget';
        $limit = (int) round((float) $budget['budget_amount'] * 100);
        $spent = 0;
        $audit = [];
        foreach ($transactions as $tx) {
            if ($tx['transaction_date'] < $windowStart || $tx['transaction_date'] > $windowEnd)
                continue;
            if (!$overall && (int) $tx['category_id'] !== (int) $budget['category_id'])
                continue;
            $cents = (int) round((float) $tx['amount'] * 100);
            $spent += $cents;
            $coveredIds[(int) $tx['transaction_id']] = $cents;
            $audit[] = [
                'id' => (int) $tx['transaction_id'],
                'date' => $tx['transaction_date'],
                'category' => $tx['category_name'],
                'description' => $tx['description'],
                'amount' => $cents / 100,
                'payment_method' => $tx['payment_method_name'] ?? null,
                'archived' => (bool) ($tx['archived'] ?? false),
            ];
        }
        $item = [
            'budget_id' => (int) $budget['budget_id'],
            'category_id' => (int) $budget['category_id'],
            'category' => $budget['category_name'],
            'is_monthly_plan' => $overall,
            'budget_period' => $budget['budget_period'],
            'start_date' => $windowStart,
            'end_date' => $windowEnd,
            'allocated_limit' => $limit / 100,
            'total_spent' => $spent / 100,
            'remaining_balance' => ($limit - $spent) / 100,
            'over_budget_by' => max(0, $spent - $limit) / 100,
            'percent_used' => $limit > 0 ? round($spent / $limit * 100, 2) : null,
            'status_flag' => $spent > $limit ? 'Exceeded' : ($spent >= $limit * 0.8 ? 'Warning' : 'On Track'),
            'transactions' => $audit,
        ];
        $items[] = $item;
        if ($overall)
            $monthlyPlans[] = $item;
    }
    // An overall monthly plan supersedes category allocations for summary totals.
    $summaryItems = $monthlyPlans ?: $items;
    $allocated = array_sum(array_map(fn($b) => (int) round($b['allocated_limit'] * 100), $summaryItems));
    $categories = array_values(array_filter($items, fn($b) => !$b['is_monthly_plan']));
    $countStatus = fn($status) => count(array_filter($categories, fn($b) => $b['status_flag'] === $status));
    return [
        'period' => substr($start, 0, 7),
        'start_date' => $start,
        'end_date' => $end,
        'warning_threshold_percent' => 80,
        'summary' => [
            'total_allocated' => $allocated / 100,
            'total_spent' => $monthSpent / 100,
            'remaining_balance' => ($allocated - $monthSpent) / 100,
            'budgeted_spent' => array_sum($coveredIds) / 100,
            'unbudgeted_spent' => ($monthSpent - array_sum($coveredIds)) / 100,
            'on_track_count' => $countStatus('On Track'),
            'warning_count' => $countStatus('Warning'),
            'over_budget_count' => $countStatus('Exceeded'),
            'category_count' => count($categories),
            'budget_count' => count($items),
            'uses_monthly_plan' => $monthlyPlans !== [],
        ],
        'budgets' => $items,
    ];
}
