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
  hasMore: boolean;
  filters: TransactionFilters;
  setFilters: (f: Partial<TransactionFilters>) => void;
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  add: (input: TransactionInput) => Promise<Transaction>;
  updateStatus: (id: string, status: TransactionStatus, payment?: PaymentMethod | null, paidAmount?: number, changeAmount?: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const PAGE_SIZE = 20;

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  loading: false,
  hasMore: true,
  filters: { search: '' },
  setFilters: (f) => {
    set({ filters: { ...get().filters, ...f }, transactions: [], hasMore: true });
    get().load();
  },
  load: async () => {
    set({ loading: true });
    const data = await transactionService.getAll(get().filters, PAGE_SIZE, 0);
    set({ transactions: data, loading: false, hasMore: data.length === PAGE_SIZE });
  },
  loadMore: async () => {
    const { transactions, loading, hasMore, filters } = get();
    if (loading || !hasMore) return;
    
    set({ loading: true });
    const offset = transactions.length;
    const data = await transactionService.getAll(filters, PAGE_SIZE, offset);
    set({
      transactions: [...transactions, ...data],
      loading: false,
      hasMore: data.length === PAGE_SIZE,
    });
  },
  add: async (input) => {
    const tx = await transactionService.create(input);
    await get().load();
    return tx;
  },
  updateStatus: async (id, status, payment, paidAmount, changeAmount) => {
    await transactionService.updateStatus(id, status, payment, paidAmount, changeAmount);
    await get().load();
  },
  remove: async (id) => {
    await transactionService.delete(id);
    await get().load();
  },
}));
