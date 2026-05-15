import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatDateTime } from '../utils/date';

export const exportService = {
  async exportTransactionsToPDF(
    transactions: Transaction[],
    title: string = 'Laporan Transaksi'
  ): Promise<void> {
    const totalRevenue = transactions
      .filter((t) => t.status === 'paid')
      .reduce((s, t) => s + t.total_amount, 0);

    const rows = transactions
      .map(
        (t, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${formatDateTime(t.created_at)}</td>
          <td>${t.customer_name ?? '-'}</td>
          <td>${t.customer_plate ?? '-'}</td>
          <td>${t.status}</td>
          <td style="text-align:right">${formatCurrency(t.total_amount)}</td>
        </tr>`
      )
      .join('');

    const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, system-ui, sans-serif; padding: 20px; }
          h1 { color: #FF6B35; margin: 0; }
          .header { border-bottom: 3px solid #FF6B35; padding-bottom: 10px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #0F3460; color: white; padding: 8px; text-align: left; }
          td { border-bottom: 1px solid #ddd; padding: 8px; }
          .summary { margin-top: 16px; font-weight: bold; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>MyGarage Lite</h1>
          <p>${title} • ${new Date().toLocaleDateString('id-ID')}</p>
        </div>
        <table>
          <thead>
            <tr><th>#</th><th>Tanggal</th><th>Pelanggan</th><th>Plat</th><th>Status</th><th>Total</th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6" style="text-align:center">Tidak ada data</td></tr>'}</tbody>
        </table>
        <div class="summary">
          Total Transaksi: ${transactions.length} • Total Pendapatan: ${formatCurrency(totalRevenue)}
        </div>
      </body>
    </html>`;

    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: title });
    }
  },

  async exportTransactionsToCSV(transactions: Transaction[]): Promise<void> {
    const header = 'No,ID,Tanggal,Pelanggan ID,Pelanggan,Plat Nomor,Telepon,Mekanik ID,Mekanik,Keluhan,Rekomendasi,Catatan Mekanik,Tipe,Status,Metode Pembayaran,Dibayar,Kembalian,Total Jasa,Total Sparepart,Total\n';
    const rows = transactions
      .map((t, idx) =>
        [
          idx + 1,
          t.id,
          formatDateTime(t.created_at),
          t.customer_id ?? '-',
          (t.customer_name ?? '-').replace(/,/g, ' '),
          t.customer_plate ?? '-',
          t.customer_phone ?? '-',
          t.mechanic_id ?? '-',
          (t.mechanic_name ?? '-').replace(/,/g, ' '),
          (t.complaint ?? '-').replace(/,/g, ' '),
          (t.recommendation ?? '-').replace(/,/g, ' '),
          (t.mechanic_notes ?? '-').replace(/,/g, ' '),
          t.type,
          t.status,
          (t.payment_method ?? '-').replace(/,/g, ' '),
          t.paid_amount,
          t.change_amount,
          t.total_service,
          t.total_sparepart,
          t.total_amount,
        ].join(',')
      )
      .join('\n');

    const csv = header + rows;
    const filename = `transaksi_${Date.now()}.csv`;
    const fileUri = (FileSystem.documentDirectory ?? '') + filename;
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export CSV' });
    }
  },
};
