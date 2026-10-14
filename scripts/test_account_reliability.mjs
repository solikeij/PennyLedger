import { spawn, execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import net from 'node:net';
import assert from 'node:assert/strict';

const testDb = `pennyledger_test_${randomBytes(8).toString('hex')}`;
let server;
let serverLog = '';
const php = process.env.PHP_BINARY || 'php';
try {
  const fixture = JSON.parse(execFileSync(php, ['scripts/reliability_fixture.php', 'setup', testDb], { encoding: 'utf8', windowsHide: true }));
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  server = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', 'public'], {
    env: { ...process.env, DB_NAME: testDb }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (data) => { serverLog += data; });
  server.on('error', (error) => { serverLog += error.message; });
  const base = `http://127.0.0.1:${port}/index.php`;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await fetch(base); break; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  // Send a fixture API request and check its expected response status.
  async function request(path, { method = 'GET', body, who = 'user', key, status = 200 } = {}) {
    const response = await fetch(base + path, { method, headers: {
      Authorization: `Bearer ${fixture.users[who].token}`, 'Content-Type': 'application/json',
      ...(method === 'POST' ? { 'Idempotency-Key': key || randomUUID() } : {}),
    }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    const raw = await response.text();
    assert.equal(response.status, status, `${method} ${path}: ${raw}`);
    return JSON.parse(raw).data;
  }
  const wallets = await request('/wallets');
  assert.equal(wallets.length, 0, 'Wallet list supports an empty state');
  assert.equal((await request('/lookups/payment-methods')).length, 0, 'Lookups must not silently create wallets');
  const cash = await request('/wallets', { method: 'POST', status: 201, body: { name: 'Cash', expense_type: 'Other' } });
  const key = randomUUID();
  const extra = await request('/wallets', { method: 'POST', key, status: 201, body: { name: 'Test bank', expense_type: 'Other' } });
  const replay = await request('/wallets', { method: 'POST', key, status: 201, body: { name: 'Test bank', expense_type: 'Other' } });
  assert.equal(extra.id, replay.id);
  assert.equal((await request('/write-requests/' + key)).confirmed, true);
  assert.equal((await request('/activity-logs')).total, 2, 'Replayed writes must not duplicate activity');
  const types = await request('/lookups/transaction-types');
  const expense = types.find((type) => type.code === 'expense').id;
  await request('/transactions', { method: 'POST', status: 422, body: { category_name: 'Food', transaction_type_id: expense, payment_method_id: cash.paymentMethodId, amount: -1, description: 'Rejected', transaction_date: '2026-10-11' } });
  assert.equal((await request('/activity-logs')).total, 2, 'Failed writes must not create activity');
  const validTransaction = { category_name: 'Food', transaction_type_id: expense, payment_method_id: cash.paymentMethodId, amount: 10, description: 'Validation test', transaction_date: '2026-10-11' };
  for (const invalid of [{ amount: 0.001 }, { amount: 100000000 }, { category_name: 'Food123' }, { description: '   ' }, { transaction_date: '2026-02-30' }, { payment_method_id: '1junk' }, { transaction_type_id: '1junk' }]) {
    await request('/transactions', { method: 'POST', status: 422, body: { ...validTransaction, ...invalid } });
  }
  assert.equal((await request('/activity-logs')).total, 2, 'Rejected form values never create activity');
  for (let i = 0; i < 27; i++) await request('/transactions', { method: 'POST', status: 201, body: {
    category_name: i % 2 ? 'Food' : 'Travel', transaction_type_id: expense,
    payment_method_id: cash.paymentMethodId, amount: 10, description: `Expense ${i}`, transaction_date: '2026-10-11',
  } });
  const first = await request('/transactions?per_page=25&page=1');
  const second = await request('/transactions?per_page=25&page=2');
  assert.equal(first.total, 27); assert.equal(first.items.length, 25); assert.equal(second.items.length, 2);
  assert.equal(new Set([...first.items, ...second.items].map((row) => row.id)).size, 27);
  assert.equal((await request('/transactions?q=Expense%2026')).total, 1);
  assert.equal((await request('/transactions?category=Food')).total, 13);
  assert.equal((await request('/transactions', { who: 'other' })).total, 0);
  const aggregate = await request('/reports?type=ledger');
  assert.equal(aggregate.length, 2); assert.equal(aggregate.reduce((sum, row) => sum + row.amount, 0), -270);
  assert.equal(aggregate.reduce((sum, row) => sum + row.recordCount, 0), 27);
  await request(`/transactions/${first.items[0].id}/archive`, { method: 'PATCH' });
  assert.equal((await request('/transactions?archived=true')).total, 1);
  assert.equal((await request('/reports?type=summary')).totalExpense, 270, 'Archiving must preserve totals');
  const report = await request('/report-logs', { method: 'POST', status: 201, body: { name: 'Test report', type: 'income-expense', range: '2026-10', period: 'October 2026', snapshot: { income: 0, expense: 270 } } });
  assert.equal('snapshot' in (await request('/report-logs')).items[0], false);
  assert.equal((await request(`/report-logs/${report.id}`)).snapshot.expense, 270);
  await request(`/report-logs/${report.id}`, { who: 'other', status: 404 });
  await request('/budgets', { method: 'POST', status: 201, body: { category_name: 'Monthly budget', budget_amount: 1000, budget_period: 'monthly', start_date: '2026-10-01', end_date: '2026-10-31' } });
  const performance = await request('/reports/budget-performance?year=2026&month=10');
  assert.equal(performance.summary.total_spent, 270, 'Main analytics includes expenses beyond the first page and archived records');
  assert.equal(performance.summary.total_allocated, 1000);
  assert.equal(performance.budgets[0].transactions.length, 27);
  await request('/reports/budget-performance?year=2026&month=13', { status: 422 });
  const statuses = await request('/lookups/goal-statuses');
  const goal = await request('/goals', { method: 'POST', status: 201, body: { goal_name: 'Test goal', target_amount: 1000, target_date: '2026-12-31', status_id: statuses[0].id } });
  await request('/goal-contributions', { method: 'POST', status: 201, body: { goal_id: goal.id, amount: 10, contribution_date: '2026-10-11', description: 'Test contribution' } });
  // Goal CRUD preserves contributions during edits and removes them only after an owned delete.
  const goalEdit = { goal_name: 'Updated goal', target_amount: 1500, target_date: '2027-01-31', status_id: statuses[0].id };
  await request(`/goals/${goal.id}`, { method: 'PUT', body: goalEdit });
  assert.equal((await request(`/goals/${goal.id}`)).saved, 10);
  assert.equal((await request(`/goals/${goal.id}`)).target, 1500);
  await request(`/goals/${goal.id}`, { method: 'PUT', who: 'other', status: 404, body: goalEdit });
  await request(`/goals/${goal.id}`, { method: 'DELETE', who: 'other', status: 404 });
  assert.equal((await request(`/goals/${goal.id}`)).saved, 10, 'Another account cannot edit or delete a goal or its savings');
  const removableGoal = await request('/goals', { method: 'POST', status: 201, body: { ...goalEdit, goal_name: 'Goal to delete' } });
  const removableContribution = await request('/goal-contributions', { method: 'POST', status: 201, body: { goal_id: removableGoal.id, amount: 25, contribution_date: '2026-10-11', description: 'Removed with goal' } });
  await request(`/goals/${removableGoal.id}`, { method: 'DELETE' });
  await request(`/goals/${removableGoal.id}`, { status: 404 });
  await request(`/goals/${removableGoal.id}`, { method: 'DELETE', status: 404 });
  await request(`/goal-contributions/${removableContribution.id}`, { method: 'DELETE', status: 404 });
  assert.equal((await request('/goals')).length, 1, 'The unrelated goal remains');
  assert.equal((await request('/goal-contributions?goal_id=' + goal.id)).length, 1);
  assert.ok((await request('/activity-logs?action=DELETE')).items.some(item => item.relatedItem === `goals #${removableGoal.id}`));
  await request(`/wallets/${extra.id}`, { method: 'PUT', body: { name: extra.name, expense_type: 'Food' } });
  await request('/wallet-transfers', { method: 'POST', status: 410, body: { from_wallet_id: extra.id, to_wallet_id: cash.id, amount: 10 } });
  assert.ok((await request('/activity-logs')).total > 0);
  assert.equal((await request('/activity-logs', { who: 'other' })).total, 0);
  assert.equal('balance' in (await request('/wallets'))[0], false);
  assert.equal((await request('/wallets')).find(w => w.id === extra.id).expenseType, 'Food');
  await request('/wallets', { method: 'POST', status: 422, body: { name: 'Invalid', expense_type: 'Not a saved category' } });
  await request('/wallets', { method: 'POST', status: 422, body: { name: ' ', expense_type: 'Other' } });
  await request('/activity-logs', { who: 'admin', status: 403 });
  await request('/admin/activity-logs', { who: 'admin', status: 403 });
  await request('/admin/activity-logs/1', { who: 'admin', status: 403 });
  await request('/admin/auth-events', { who: 'other', status: 403 });
  assert.equal((await request('/admin/auth-events', { who: 'admin' })).items.length, 0, 'Private writes never reach the auth store');
  assert.equal((await request('/activity-logs?user_id=' + fixture.users.user.id, { who: 'other' })).total, 0);
  const logs = await request('/activity-logs?per_page=5');
  const nextLogs = await request('/activity-logs?per_page=5&page=2');
  assert.equal(logs.items.length, 5);
  assert.equal(new Set([...logs.items, ...nextLogs.items].map(row => row.id)).size, 10);
  assert.ok(logs.items[0].relatedItem);
  assert.equal((await request('/activity-logs?action=ARCHIVE')).total, 1);
  assert.equal((await request('/activity-logs?q=Test%20bank')).total, 2);
  assert.equal((await request('/activity-logs?from=2000-01-01&to=2000-01-02')).total, 0);
  await request('/activity-logs?from=2026-02-30', { status: 422 });
  await request('/activity-logs?from=2026-10-12&to=2026-10-01', { status: 422 });
  const income = await request('/profile/income-estimate', { method: 'PUT', body: { amount: 433.33 } });
  assert.equal(income.monthlyIncomeEstimate, 433.33);
  for (const amount of [-1, 100000000, '1e309', 'invalid']) await request('/profile/income-estimate', { method: 'PUT', body: { amount }, status: 422 });
  assert.equal((await request('/profile')).monthlyIncomeEstimate, 433.33, 'Invalid edits preserve the saved estimate');
  assert.equal((await request('/transactions')).total, 27, 'Expected income never creates a transaction');
  const createdByAdmin = await request('/admin/users', { who: 'admin', method: 'POST', status: 201, body: { first_name: 'Admin', last_name: 'Created', email: 'created@fixture.invalid', password: 'TestPassword123!' } });
  assert.ok((await request('/admin/users', { who: 'admin' })).items.some(user => user.id === createdByAdmin.id));
  await request(`/admin/users/${createdByAdmin.id}/status`, { who: 'admin', method: 'PATCH', body: { status: 'inactive' } });
  assert.equal((await request('/admin/auth-events', { who: 'admin' })).items.length, 0, 'Admin writes must not leak into authentication events');
  const userId = fixture.users.user.id;
  await request(`/admin/users/${userId}`, { method: 'DELETE', who: 'other', body: { password: 'TestPassword123!' }, status: 403 });
  await request(`/admin/users/${userId}`, { method: 'DELETE', who: 'admin', body: { password: 'TestPassword123!' }, status: 409 });
  await request('/profile/archive', { method: 'PATCH', body: { password: 'wrong' }, status: 403 });
  await request('/profile/archive', { method: 'PATCH', body: { password: 'TestPassword123!' } });
  await request('/profile', { status: 401 });
  const archived = await request('/admin/users?status=deleted', { who: 'admin' });
  assert.equal(archived.items[0].id, userId);
  await request(`/admin/users/${userId}/restore`, { method: 'PATCH', who: 'admin' });
  const login = await request('/auth/login', { method: 'POST', body: { email: 'user@fixture.invalid', password: 'TestPassword123!' } });
  fixture.users.user.token = login.token;
  const authEvents = (await request('/admin/auth-events', { who: 'admin' })).items;
  assert.equal(authEvents[0].eventType, 'LOGIN');
  assert.deepEqual(Object.keys(authEvents[0]).sort(), ['eventType', 'timestamp', 'user']);
  assert.equal((await request('/activity-logs?action=LOGIN')).total, 1);
  assert.equal((await request('/transactions')).total, 27, 'Restore must retain ledger data');
  await request('/profile', { method: 'DELETE', body: { password: 'wrong' }, status: 403 });
  await request('/profile', { method: 'DELETE', body: { password: 'TestPassword123!' } });
  await request('/profile', { status: 401 });
  assert.equal(existsSync('public' + fixture.photoPath), false, 'Profile photo must be removed');
  assert.equal((await request('/admin/users?status=deleted', { who: 'admin' })).total, 0);
  // Email reuse checks deletion of the actual user row, without sending email.
  await request('/admin/users', { method: 'POST', who: 'admin', status: 201, body: { first_name: 'Reused', last_name: 'Email', email: 'user@fixture.invalid', password: 'TestPassword123!' } });
  // Exercise wallet/category restrictions on a separate account in the disposable database.
  const categoryRequest = (path, options = {}) => request(path, { ...options, who: 'other' });
  const generalWallet = await categoryRequest('/wallets', { method: 'POST', status: 201, body: { name: 'General wallet', expense_type: 'Other' } });
  const generalExpense = { ...validTransaction, payment_method_id: generalWallet.paymentMethodId };
  const foodRecord = await categoryRequest('/transactions', { method: 'POST', status: 201, body: generalExpense });
  const travelRecord = await categoryRequest('/transactions', { method: 'POST', status: 201, body: { ...generalExpense, category_name: 'Travel' } });
  const foodWallet = await categoryRequest('/wallets', { method: 'POST', status: 201, body: { name: 'GCash food', expense_type: 'Food' } });
  assert.equal((await categoryRequest('/lookups/payment-methods')).find(item => item.id === foodWallet.paymentMethodId).expenseType, 'Food');
  const foodExpense = { ...generalExpense, payment_method_id: foodWallet.paymentMethodId };
  const restrictedRecord = await categoryRequest('/transactions', { method: 'POST', status: 201, body: foodExpense });
  const beforeRejected = await categoryRequest('/activity-logs');
  const rejectedKey = randomUUID();
  await categoryRequest('/transactions', { method: 'POST', key: rejectedKey, status: 422, body: { ...foodExpense, category_name: 'Travel' } });
  assert.equal((await categoryRequest('/write-requests/' + rejectedKey)).confirmed, false);
  // A rejected new category must be rolled back along with the transaction and audit.
  await categoryRequest('/transactions', { method: 'POST', status: 422, body: { ...foodExpense, category_name: 'Unmatched category' } });
  const { category_name: ignoredCategory, ...byCategoryId } = foodExpense;
  await categoryRequest('/transactions', { method: 'POST', status: 422, body: { ...byCategoryId, category_id: travelRecord.categoryId } });
  await categoryRequest(`/transactions/${restrictedRecord.id}`, { method: 'PUT', status: 422, body: { ...foodExpense, category_name: 'Travel' } });
  await categoryRequest(`/transactions/${restrictedRecord.id}`, { method: 'PUT', status: 422, body: { ...byCategoryId, category_id: travelRecord.categoryId } });
  assert.equal((await categoryRequest(`/transactions/${restrictedRecord.id}`)).category, 'Food', 'Rejected edits preserve the saved category');
  assert.equal((await categoryRequest('/activity-logs')).total, beforeRejected.total, 'Category conflicts never create activity');
  assert.equal((await categoryRequest('/transactions')).total, 3, 'Category conflicts never create transactions');
  await categoryRequest(`/transactions/${restrictedRecord.id}`, { method: 'PUT', body: { ...byCategoryId, category_id: foodRecord.categoryId } });
  // Matching uses the database category comparison, including case-insensitive saved names.
  await categoryRequest(`/transactions/${restrictedRecord.id}`, { method: 'PUT', body: { ...foodExpense, category_name: 'food' } });
  const incomeType = types.find(type => type.code === 'income').id;
  await categoryRequest('/transactions', { method: 'POST', status: 201, body: { ...foodExpense, transaction_type_id: incomeType, category_name: 'Salary' } });
  await categoryRequest(`/transactions/${restrictedRecord.id}/archive`, { method: 'PATCH' });
  await categoryRequest(`/wallets/${foodWallet.id}`, { method: 'PUT', status: 422, body: { name: 'Rejected rename', expense_type: 'Travel' } });
  assert.equal((await categoryRequest('/wallets')).find(item => item.id === foodWallet.id).name, 'GCash food', 'A rejected type change must not rename the wallet');
  await categoryRequest(`/wallets/${generalWallet.id}`, { method: 'PUT', status: 422, body: { name: generalWallet.name, expense_type: 'Food' } });
  await categoryRequest(`/wallets/${foodWallet.id}`, { method: 'PUT', body: { name: foodWallet.name, expense_type: 'Other' } });
  const unrestrictedTravel = await categoryRequest('/transactions', { method: 'POST', status: 201, body: { ...foodExpense, category_name: 'Travel' } });
  await categoryRequest(`/wallets/${foodWallet.id}`, { method: 'PUT', status: 422, body: { name: foodWallet.name, expense_type: 'Food' } });
  // Correct the one conflicting expense, then safely restrict the wallet again.
  await categoryRequest(`/transactions/${unrestrictedTravel.id}`, { method: 'PUT', body: foodExpense });
  await categoryRequest(`/wallets/${foodWallet.id}`, { method: 'PUT', body: { name: foodWallet.name, expense_type: 'Food' } });
  await categoryRequest(`/transactions/${unrestrictedTravel.id}`, { method: 'PUT', status: 422, body: { ...foodExpense, category_name: 'Travel' } });
  // Moving a transaction to an unrestricted wallet preserves its chosen category.
  await categoryRequest(`/transactions/${unrestrictedTravel.id}`, { method: 'PUT', body: { ...generalExpense, category_name: 'Travel' } });
  const otherId = fixture.users.other.id;
  // Bulk mutations validate ownership before changing any row and preserve totals on archive.
  const adminWallet = await request('/wallets', { who: 'admin', method: 'POST', status: 201, body: { name: 'Admin test wallet', expense_type: 'Other' } });
  const adminTx = await request('/transactions', { who: 'admin', method: 'POST', status: 201, body: { ...validTransaction, payment_method_id: adminWallet.paymentMethodId } });
  for (const method of ['PATCH', 'DELETE']) {
    await categoryRequest('/transactions', { method, status: 404, body: { ids: [foodRecord.id, adminTx.id], action: 'archive' } });
    assert.equal((await categoryRequest(`/transactions/${foodRecord.id}`)).archived, false, 'Invalid batches do not partially change owned rows');
    await request(`/transactions/${adminTx.id}`, { who: 'admin' });
  }
  for (const ids of [[], ['invalid'], [0], Array(101).fill(foodRecord.id), null]) {
    await categoryRequest('/transactions', { method: 'DELETE', status: 422, body: { ids } });
  }
  await categoryRequest('/transactions', { method: 'PATCH', status: 422, body: { ids: [foodRecord.id], action: 'delete' } });
  const expenseBeforeBulk = (await categoryRequest('/reports?type=summary')).totalExpense;
  const archivedBatch = await categoryRequest('/transactions', { method: 'PATCH', body: { ids: [foodRecord.id, foodRecord.id, travelRecord.id], action: 'archive' } });
  assert.equal(archivedBatch.ids.length, 2);
  assert.equal((await categoryRequest(`/transactions/${foodRecord.id}`)).archived, true);
  assert.equal((await categoryRequest(`/transactions/${travelRecord.id}`)).archived, true);
  assert.equal((await categoryRequest('/reports?type=summary')).totalExpense, expenseBeforeBulk);
  await categoryRequest('/transactions', { method: 'PATCH', body: { ids: archivedBatch.ids, action: 'restore' } });
  assert.equal((await categoryRequest(`/transactions/${foodRecord.id}`)).archived, false);
  await categoryRequest('/transactions', { method: 'DELETE', body: { ids: archivedBatch.ids } });
  await categoryRequest(`/transactions/${foodRecord.id}`, { status: 404 });
  await categoryRequest(`/transactions/${travelRecord.id}`, { status: 404 });
  assert.equal((await categoryRequest('/reports?type=summary')).totalExpense, expenseBeforeBulk - 20);
  await request(`/admin/users/${otherId}/delete`, { method: 'PATCH', who: 'admin' });
  await request(`/admin/users/${otherId}`, { method: 'DELETE', who: 'admin', body: { password: 'wrong' }, status: 403 });
  await request(`/admin/users/${otherId}`, { method: 'DELETE', who: 'admin', body: { password: 'TestPassword123!' } });
  assert.equal((await request('/admin/users?status=deleted', { who: 'admin' })).total, 0);
  console.log('PASS: isolated PHP/MySQL integration — pagination, summaries, snapshot detail, atomic activity, idempotency, ownership, archive/restore, permanent deletion, email reuse, and photo cleanup.');
} catch (error) {
  console.error(error.message);
  console.error(serverLog.slice(-6000));
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  }
  execFileSync(php, ['scripts/reliability_fixture.php', 'cleanup', testDb], { windowsHide: true, stdio: 'inherit' });
}
