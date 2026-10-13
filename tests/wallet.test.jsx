import { expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { localDate } from '../src/lib/format';
import { MemoryRouter } from "react-router-dom";
vi.mock('../src/lib/api', () => ({ api: async () => [{ id: 9, name: 'Groceries', type: 'expense' }] }));
import Dashboard from "../src/pages/Dashboard";
const fixture = vi.hoisted(() => ({ empty: false }));
const { createWallet, updateWallet, deleteWallet } = vi.hoisted(() => ({ createWallet: vi.fn().mockResolvedValue({}), updateWallet: vi.fn().mockResolvedValue({}), deleteWallet: vi.fn().mockResolvedValue({}) }));
vi.mock("../src/state/AppContext", () => ({ useApp: () => ({
  transactions: [], budgets: [{ id: 1, category: 'Food', limit: 200, spent: 10, period: 'monthly', startDate: localDate().slice(0, 7) + '-01' }],
  wallets: fixture.empty ? [] : [{ id: 2, name: 'Physical money', expenseType: 'Other', isDefault: true }, { id: 1, name: 'GCash', expenseType: 'Groceries' }],
  goals: [], profile: { name: 'Admin User' }, date: (d) => d,
  money: (value) => `$${value}`, currency: 'USD', createWallet, updateWallet, deleteWallet, notify: vi.fn(),
}) }));
it('removes balance totals and submits name and expense type', async () => {
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  expect(screen.getByText('Total Budgeted').closest('.stat-card')).toHaveTextContent('$200');
  expect(screen.queryByText('$700')).not.toBeInTheDocument();
  expect(screen.getByText('$190')).toBeInTheDocument();
  expect(screen.getByText('GCash')).toBeInTheDocument();
  expect(screen.queryByText('Total Balance')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Add Wallet/ }));
  fireEvent.change(screen.getByLabelText('Wallet name'), { target: { value: 'Bank savings' } });
  await screen.findByRole('option', { name: 'Groceries' });
  fireEvent.change(screen.getByLabelText('Expense type'), { target: { value: 'Groceries' } });
  expect(screen.queryByLabelText(/balance/i)).not.toBeInTheDocument();
  const buttons = screen.getAllByRole('button', { name: 'Add wallet' });
  fireEvent.click(buttons.at(-1));
  await waitFor(() => expect(createWallet).toHaveBeenCalledWith({ name: 'Bank savings', expense_type: 'Groceries' }));
});

it('edits an existing wallet', async () => {
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Edit GCash' }));
  expect(screen.getByLabelText('Wallet name')).toHaveValue('GCash');
  expect(screen.getByLabelText('Expense type')).toHaveValue('Groceries');
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(updateWallet).toHaveBeenCalledWith(1, { name: 'GCash', expense_type: 'Groceries' }));
});

it('allows classifying physical money while preserving its default identity', async () => {
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Physical money' }));
  expect(screen.queryByRole('button', { name: 'Delete wallet' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Wallet name')).toHaveAttribute('readonly');
  expect(screen.getByLabelText('Expense type')).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(updateWallet).toHaveBeenCalledWith(2, { name: 'Physical money', expense_type: 'Other' }));
});

it('asks for a password before deleting and shows a rejected password', async () => {
  deleteWallet.mockRejectedValueOnce(new Error('Incorrect password'));
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Edit GCash' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete wallet' }));
  expect(deleteWallet).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Confirm your password'), { target: { value: 'wrong-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect password');
  expect(deleteWallet).toHaveBeenCalledWith(1, 'wrong-password');
});

it('opens the same form from the empty-state action and preserves values after a failed save', async () => {
  fixture.empty = true;
  createWallet.mockRejectedValueOnce(new Error('Save unavailable'));
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  fixture.empty = false;
  fireEvent.click(screen.getAllByRole('button', { name: 'Add Wallet' }).at(-1));
  fireEvent.change(screen.getByLabelText('Wallet name'), { target: { value: 'Travel wallet' } });
  await screen.findByRole('option', { name: 'Groceries' });
  fireEvent.change(screen.getByLabelText('Expense type'), { target: { value: 'Groceries' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add wallet' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Save unavailable');
  expect(screen.getByLabelText('Wallet name')).toHaveValue('Travel wallet');
  expect(screen.getByLabelText('Expense type')).toHaveValue('Groceries');
});
