import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Reports from "../src/pages/Reports";
import { createReport, reportSnapshotDetails } from "../src/lib/reports";
const mocks = vi.hoisted(() => ({ api: vi.fn(), save: vi.fn(), notify: vi.fn() }));
vi.mock("../src/lib/api", () => ({ api: mocks.api }));
vi.mock("../src/components/BudgetPerformance", () => ({default: () => null}));
vi.mock("../src/components/SpendingInsights", () => ({default: () => null}));
vi.mock("../src/state/AppContext", () => ({useApp: () => ({transactions: [], budgets: [], goals: [], reports: [], money: n => `$${Number(n).toFixed(2)}`, date: String, addReport: mocks.save, notify: mocks.notify})}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue({id: 1});
  const now = new Date();
  const month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2,'0');
  mocks.api.mockImplementation(async path => path === '/reports?type=ledger' ? [{date: month + '-01', amount: 500, category:'Salary'}] : []);
});
it('generates from refreshed records and saves the exact displayed snapshot', async () => {
  render(<Reports />);
  fireEvent.click(screen.getByRole('button',{name:'Generate Report'}));
  expect(screen.getByRole('button',{name:'Generating...'})).toBeDisabled();
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({type:'income-expense', snapshot: expect.objectContaining({income:500, expense:0, comparison:expect.any(Object), trend:expect.any(Array)})})));
  expect(await screen.findByText('Saved report snapshot - ready to export or print')).toBeInTheDocument();
  expect(screen.getAllByText('$500.00').length).toBeGreaterThan(0);
});
it('shows save failures without claiming that the report was generated', async () => {
  mocks.save.mockRejectedValue(new Error('Report could not be saved'));
  render(<Reports />);
  fireEvent.click(screen.getByRole('button',{name:'Generate Report'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Report could not be saved');
  expect(screen.queryByText('Saved report snapshot - ready to export or print')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Generate Report'})).toBeEnabled();
});
it('compares January to December and represents missing baselines accurately', () => {
  const value = reportSnapshotDetails('2026-01', [{date:'2026-01-05', amount:100, category:'Salary'}, {date:'2025-12-05', amount:50, category:'Salary'}]);
  expect(value.comparison.period).toBe('2025-12');
  expect(value.comparison.income).toEqual({amount:50, percent:100});
  expect(value.comparison.expense.percent).toBeNull();
  expect(value.trend).toHaveLength(6);
});
it('includes budgets spanning the entire selected month', () => {
  const value = createReport('budget','2026-10', [{date:'2026-10-10',amount:-25,categoryId:1}], [{id:1,categoryId:1,startDate:'2026-09-01',endDate:'2026-11-30',limit:100}], []);
  expect(value.budgets).toHaveLength(1);
  expect(value.budgets[0].spent).toBe(25);
});