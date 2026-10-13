import { expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TransactionModal, IncomeModal } from '../src/components/Forms';
import { TransactionTable } from '../src/pages/Transactions';
const mocks = vi.hoisted(() => ({update:vi.fn(), remove:vi.fn(), income:vi.fn(), create:vi.fn()}));
vi.mock('../src/state/AppContext', () => ({useApp:()=>({updateTransaction:mocks.update, deleteTransaction:mocks.remove, createTransaction:mocks.create, saveIncomeEstimate:mocks.income, income:1200, currency:'USD', money:n=>`$${Number(n).toFixed(2)}`, date:String, notify:vi.fn()})}));
vi.mock('../src/lib/api',()=>({api:async path=>path.endsWith('payment-methods')?[{id:1,name:'Cash'},{id:2,name:'Bank'}]:path.endsWith('transaction-types')?[{id:1,code:'income'},{id:2,code:'expense'}]:[]}));
const tx={id:7,description:'Salary',category:'Salary',amount:500,date:'2026-10-05',paymentMethodId:2,archived:false};
beforeEach(()=>{vi.clearAllMocks(); mocks.update.mockResolvedValue(tx); mocks.income.mockResolvedValue({});});
it('prefills income editing, preserves its wallet, and updates the existing transaction',async()=>{
 const close=vi.fn(); render(<TransactionModal transaction={tx} onClose={close}/>);
 await screen.findByRole('option',{name:'Bank'});
 expect(screen.getByLabelText('Payment method')).toHaveValue('2');
 expect(screen.getByLabelText('Amount (USD)')).toHaveValue(500);
 fireEvent.change(screen.getByLabelText('Amount (USD)'),{target:{value:'650'}});
 fireEvent.click(screen.getByRole('button',{name:'Save Changes'}));
 await waitFor(()=>expect(mocks.update).toHaveBeenCalledWith(7,expect.objectContaining({amount:650,payment_method_id:2,transaction_type_id:1})));
 expect(mocks.create).not.toHaveBeenCalled(); expect(close).toHaveBeenCalled();
});
it('requires confirmation for deletion and leaves failure visible',async()=>{
 mocks.remove.mockRejectedValue(new Error('Delete failed'));
 render(<TransactionTable records={[tx]}/>);
 fireEvent.click(screen.getByRole('button',{name:'Delete Salary'}));
 expect(mocks.remove).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Confirm deletion'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Delete failed');
 expect(mocks.remove).toHaveBeenCalledWith(7);
});
it('edits expected income without creating an income transaction',async()=>{
 render(<IncomeModal onClose={vi.fn()}/>);
 expect(screen.getByLabelText('Pay amount (USD)')).toHaveValue(1200);
 fireEvent.change(screen.getByLabelText('Pay amount (USD)'),{target:{value:'100'}});
 fireEvent.change(screen.getByLabelText('Pay Frequency'),{target:{value:'weekly'}});
 fireEvent.click(screen.getByRole('button',{name:'Save Expected Income'}));
 await waitFor(()=>expect(mocks.income).toHaveBeenCalledWith(433.33));
 expect(mocks.create).not.toHaveBeenCalled();
});
it('keeps the edit form open and displays field-specific save errors', async () => {
 mocks.update.mockRejectedValueOnce(Object.assign(new Error('Validation failed'),{fields:{amount:'Amount is invalid'}}));
 const close=vi.fn(); render(<TransactionModal transaction={tx} onClose={close}/>);
 await screen.findByRole('option',{name:'Bank'});
 fireEvent.click(screen.getByRole('button',{name:'Save Changes'}));
 expect(await screen.findByText('Amount is invalid')).toHaveAttribute('role', 'alert');
 expect(screen.getByLabelText('Amount (USD)')).toHaveAttribute('aria-invalid', 'true');
 expect(close).not.toHaveBeenCalled();
 expect(screen.getByRole('button',{name:'Save Changes'})).toBeEnabled();
});
it('does not submit a whitespace-only description', async () => {
 render(<TransactionModal transaction={tx} onClose={vi.fn()}/>);
 await screen.findByRole('option',{name:'Bank'});
 fireEvent.change(screen.getByLabelText('Description'),{target:{value:'   '}});
 fireEvent.click(screen.getByRole('button',{name:'Save Changes'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Enter a transaction description');
 expect(mocks.update).not.toHaveBeenCalled();
});