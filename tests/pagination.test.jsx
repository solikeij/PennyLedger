import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { usePagedResource } from '../src/lib/use-paged-resource';
import PagedList from '../src/components/PagedList';
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('../src/lib/api', () => ({ api: mocks.api }));
vi.mock('../src/state/AppContext', () => ({ useApp: () => ({ serverPagination: true, dataVersion: 0 }) }));
function Harness() {
  const [query, setQuery] = useState('');
  const list = usePagedResource('/transactions', { q: query });
  return <><input aria-label="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
    <PagedList list={list}>{list.items.map((item) => <p key={item.id}>{item.description}</p>)}</PagedList></>;
}
it('requests the next page and resets to page one when a filter changes', async () => {
  mocks.api.mockImplementation(async (path) => {
    const query = new URL('http://fixture' + path).searchParams;
    const page = Number(query.get('page'));
    return { items: [{ id: page, description: `${query.get('q') || 'All'} page ${page}` }], total: 26, page, perPage: 25 };
  });
  render(<Harness />);
  expect(await screen.findByText('All page 1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(await screen.findByText('All page 2')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Food' } });
  expect(await screen.findByText('Food page 1')).toBeInTheDocument();
  expect(screen.queryByText('All page 2')).not.toBeInTheDocument();
});
it('shows a retry state instead of an empty list when a page fails', async () => {
  mocks.api.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce({ items: [], total: 0, page: 1, perPage: 25 });
  render(<Harness />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Records are unavailable');
  expect(screen.queryByText(/0 records/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry records' }));
  expect(await screen.findByText(/0 records/)).toBeInTheDocument();
});
