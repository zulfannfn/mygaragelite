import { Alert } from 'react-native';
import { PrinterPrintError } from '../services/receiptService';

type RouterLike = { push: (href: string) => void };

export function showPrinterReconnectAlert(router: RouterLike): void {
  Alert.alert(
    'Printer tidak terhubung',
    'Gagal mengirim struk ke printer. Pastikan printer dalam keadaan menyala, lalu hubungkan ulang di Pengaturan → Printer Bluetooth.',
    [
      { text: 'Nanti', style: 'cancel' },
      { text: 'Ke Pengaturan', onPress: () => router.push('/settings') },
    ]
  );
}

export function handleReceiptPrintError(
  error: unknown,
  router: RouterLike,
  showToast?: (message: string, type?: 'error' | 'success' | 'info') => void
): void {
  if (error instanceof PrinterPrintError) {
    showPrinterReconnectAlert(router);
    return;
  }
  const message =
    error instanceof Error ? error.message : 'Terjadi kesalahan saat mencetak.';
  if (showToast) {
    showToast('Gagal cetak: ' + message, 'error');
  } else {
    Alert.alert('Gagal Cetak', message);
  }
}
