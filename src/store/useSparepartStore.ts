import { create } from 'zustand';
import { SparepartInput, sparepartService } from '../services/sparepartService';
import { Sparepart } from '../types';

interface SparepartState {
  spareparts: Sparepart[];
  loading: boolean;
  hasMore: boolean;
  search: string;
  setSearch: (s: string) => void;
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  add: (input: SparepartInput) => Promise<Sparepart>;
  update: (id: string, input: SparepartInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const PAGE_SIZE = 20;

export const useSparepartStore = create<SparepartState>((set, get) => ({
  spareparts: [],
  loading: false,
  hasMore: true,
  search: '',
  setSearch: (s) => {
    set({ search: s, spareparts: [], hasMore: true });
    get().load();
  },
  load: async () => {
    set({ loading: true });
    const data = await sparepartService.getAll(get().search, PAGE_SIZE, 0);
    set({ spareparts: data, loading: false, hasMore: data.length === PAGE_SIZE });
  },
  loadMore: async () => {
    const { spareparts, loading, hasMore, search } = get();
    if (loading || !hasMore) return;
    
    set({ loading: true });
    const offset = spareparts.length;
    const data = await sparepartService.getAll(search, PAGE_SIZE, offset);
    set({
      spareparts: [...spareparts, ...data],
      loading: false,
      hasMore: data.length === PAGE_SIZE,
    });
  },
  add: async (input) => {
    const sp = await sparepartService.create(input);
    await get().load();
    return sp;
  },
  update: async (id, input) => {
    await sparepartService.update(id, input);
    await get().load();
  },
  remove: async (id) => {
    await sparepartService.delete(id);
    await get().load();
  },
}));
