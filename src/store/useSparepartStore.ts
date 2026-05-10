import { create } from 'zustand';
import { SparepartInput, sparepartService } from '../services/sparepartService';
import { Sparepart } from '../types';

interface SparepartState {
  spareparts: Sparepart[];
  loading: boolean;
  search: string;
  setSearch: (s: string) => void;
  load: () => Promise<void>;
  add: (input: SparepartInput) => Promise<Sparepart>;
  update: (id: string, input: SparepartInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useSparepartStore = create<SparepartState>((set, get) => ({
  spareparts: [],
  loading: false,
  search: '',
  setSearch: (s) => {
    set({ search: s });
    get().load();
  },
  load: async () => {
    set({ loading: true });
    const data = await sparepartService.getAll(get().search);
    set({ spareparts: data, loading: false });
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
