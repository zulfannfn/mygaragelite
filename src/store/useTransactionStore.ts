import { create } from 'zustand';
import {
    TransactionInput,
    transactionService,
} from '../services/transactionService';
import { PaymentMethod, Transaction, TransactionStatus, TransactionType } from '../types';

interface TransactionFilters {
  search: string;
  status?: TransactionStatus;
  type?: TransactionType;
  startDate?: number;
  endDate?: number;
}

interface TransactionState {
  transactions: Transaction[];
  loading: boolean;
  filters: TransactionFilters;
  setFilters: (f: Partial<TransactionFilters>) => void;
  load: () => Promise<void>;
  add: (input: TransactionInput) => Promise<Transaction>;
  updateStatus: (id: string, status: TransactionStatus, payment?: PaymentMethod | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  loading: false,
  filters: { search: '' },
  setFilters: (f) => {
    set({ filters: { ...get().filters, ...f } });
    get().load();
  },
  load: async () => {
    set({ loading: true });
    const data = await transactionService.getAll(get().filters);
    set({ transactions: data, loading: false });
  },
  add: async (input) => {
    const tx = await transactionService.create(input);
    await get().load();
    return tx;
  },
  updateStatus: async (id, status, payment) => {
    await transactionService.updateStatus(id, status, payment);
    await get().load();
  },
  remove: async (id) => {
    await transactionService.delete(id);
    await get().load();
  },
}));
