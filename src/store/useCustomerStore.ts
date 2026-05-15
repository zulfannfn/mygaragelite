import { create } from 'zustand';
import { CustomerInput, customerService } from '../services/customerService';
import { Customer } from '../types';

interface CustomerState {
  customers: Customer[];
  loading: boolean;
  hasMore: boolean;
  search: string;
  setSearch: (s: string) => void;
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  add: (input: CustomerInput) => Promise<Customer>;
  update: (id: string, input: CustomerInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const PAGE_SIZE = 20;

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: [],
  loading: false,
  hasMore: true,
  search: '',
  setSearch: (s) => {
    set({ search: s, customers: [], hasMore: true });
    get().load();
  },
  load: async () => {
    set({ loading: true });
    const data = await customerService.getAll(get().search, PAGE_SIZE, 0);
    set({ customers: data, loading: false, hasMore: data.length === PAGE_SIZE });
  },
  loadMore: async () => {
    const { customers, loading, hasMore, search } = get();
    if (loading || !hasMore) return;
    
    set({ loading: true });
    const offset = customers.length;
    const data = await customerService.getAll(search, PAGE_SIZE, offset);
    set({
      customers: [...customers, ...data],
      loading: false,
      hasMore: data.length === PAGE_SIZE,
    });
  },
  add: async (input) => {
    const c = await customerService.create(input);
    await get().load();
    return c;
  },
  update: async (id, input) => {
    await customerService.update(id, input);
    await get().load();
  },
  remove: async (id) => {
    await customerService.delete(id);
    await get().load();
  },
}));
