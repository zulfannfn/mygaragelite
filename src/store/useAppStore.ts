import { create } from 'zustand';
import { settingsService } from '../services/settingsService';

interface AppState {
  // App init
  isReady: boolean;
  setReady: (v: boolean) => void;

  // Onboarding
  onboardingDone: boolean;
  setOnboardingDone: (v: boolean) => void;

  // Workshop
  workshopName: string;
  workshopAddress: string;
  workshopPhone: string;
  setWorkshopInfo: (info: Partial<{ name: string; address: string; phone: string }>) => Promise<void>;

  // Toast
  toast: { id: number; message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;

  // Init
  loadSettings: () => Promise<void>;
}

let toastId = 0;

export const useAppStore = create<AppState>((set, get) => ({
  isReady: false,
  setReady: (v) => set({ isReady: v }),

  onboardingDone: false,
  setOnboardingDone: async (v) => {
    set({ onboardingDone: v });
    await settingsService.set('onboarding_done', v ? 'true' : 'false');
  },

  workshopName: 'MyGarage Bengkel',
  workshopAddress: '',
  workshopPhone: '',
  setWorkshopInfo: async (info) => {
    if (info.name !== undefined) {
      set({ workshopName: info.name });
      await settingsService.set('workshop_name', info.name);
    }
    if (info.address !== undefined) {
      set({ workshopAddress: info.address });
      await settingsService.set('workshop_address', info.address);
    }
    if (info.phone !== undefined) {
      set({ workshopPhone: info.phone });
      await settingsService.set('workshop_phone', info.phone);
    }
  },

  toast: null,
  showToast: (message, type = 'info') => {
    const id = ++toastId;
    set({ toast: { id, message, type } });
    setTimeout(() => {
      const cur = get().toast;
      if (cur && cur.id === id) set({ toast: null });
    }, 2500);
  },
  hideToast: () => set({ toast: null }),

  loadSettings: async () => {
    const all = await settingsService.getAll();
    set({
      workshopName: all.workshop_name ?? 'MyGarage Bengkel',
      workshopAddress: all.workshop_address ?? '',
      workshopPhone: all.workshop_phone ?? '',
      onboardingDone: all.onboarding_done === 'true',
    });
  },
}));
