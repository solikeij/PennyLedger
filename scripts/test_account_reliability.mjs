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
  const otherId = fixture.users.other.id;
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
