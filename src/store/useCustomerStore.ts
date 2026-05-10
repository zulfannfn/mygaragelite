import { create } from 'zustand';
import { CustomerInput, customerService } from '../services/customerService';
import { Customer } from '../types';

interface CustomerState {
  customers: Customer[];
  loading: boolean;
  search: string;
  setSearch: (s: string) => void;
  load: () => Promise<void>;
  add: (input: CustomerInput) => Promise<Customer>;
  update: (id: string, input: CustomerInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: [],
  loading: false,
  search: '',
  setSearch: (s) => {
    set({ search: s });
    get().load();
  },
  load: async () => {
    set({ loading: true });
    const data = await customerService.getAll(get().search);
    set({ customers: data, loading: false });
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
