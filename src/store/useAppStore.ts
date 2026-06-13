import { create } from 'zustand';
import { settingsService } from '../services/settingsService';
import type { Language } from '../i18n';

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

  // Theme
  isDarkMode: boolean;
  setDarkMode: (v: boolean) => Promise<void>;

  // Language
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;

  // Toast
  toast: { id: number; message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;

  // Receipt Settings
  receiptPaperSize: 'A4' | '58mm' | '80mm';
  receiptFooter: string;
  setReceiptInfo: (info: Partial<{ paperSize: 'A4' | '58mm' | '80mm'; footer: string }>) => Promise<void>;

  // Bluetooth Printer
  connectedPrinter: { name: string; mac: string } | null;
  setConnectedPrinter: (printer: { name: string; mac: string } | null) => Promise<void>;

  // Customer Form Context
  lastAddedCustomerId: string | null;
  setLastAddedCustomerId: (id: string | null) => void;

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

  receiptPaperSize: '80mm',
  receiptFooter: '',
  setReceiptInfo: async (info) => {
    if (info.paperSize !== undefined) {
      set({ receiptPaperSize: info.paperSize });
      await settingsService.set('receipt_paper_size', info.paperSize);
    }
    if (info.footer !== undefined) {
      set({ receiptFooter: info.footer });
      await settingsService.set('receipt_footer', info.footer);
    }
  },

  connectedPrinter: null,
  setConnectedPrinter: async (printer) => {
    set({ connectedPrinter: printer });
    if (printer) {
      await settingsService.set('printer_name', printer.name);
      await settingsService.set('printer_mac', printer.mac);
    } else {
      await settingsService.set('printer_name', '');
      await settingsService.set('printer_mac', '');
    }
  },

  lastAddedCustomerId: null,
  setLastAddedCustomerId: (id) => set({ lastAddedCustomerId: id }),

  isDarkMode: true,
  setDarkMode: async (v) => {
    set({ isDarkMode: v });
    await settingsService.set('dark_mode', v ? 'true' : 'false');
  },

  language: 'id',
  setLanguage: async (lang) => {
    set({ language: lang });
    await settingsService.set('language', lang);
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
      receiptPaperSize: (all.receipt_paper_size as 'A4' | '58mm' | '80mm') ?? '80mm',
      receiptFooter: all.receipt_footer ?? '',
      connectedPrinter: all.printer_mac ? { name: all.printer_name ?? 'Printer', mac: all.printer_mac } : null,
      onboardingDone: all.onboarding_done === 'true',
      isDarkMode: all.dark_mode !== 'false',
      language: (all.language === 'en' ? 'en' : 'id') as Language,
    });
  },
}));
