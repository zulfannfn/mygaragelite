import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Transaction, TransactionStatus, TransactionType } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatDateTime } from '../utils/date';

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: 'Menunggu',
  in_progress: 'Sedang Dikerjakan',
  waiting_payment: 'Menunggu Bayar',
  paid: 'Lunas',
  cancelled: 'Batal',
};

const TYPE_LABELS: Record<TransactionType, string> = {
  service: 'Servis',
  retail: 'Retail',
};

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(',');
}

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

  /**
   * Row-level CSV: satu baris per item jasa atau sparepart.
   * UTF-8 BOM agar Excel membuka kolom dengan benar.
   */
  async exportTransactionsToCSV(transactions: Transaction[]): Promise<void> {
    const header = csvRow([
      'No',
      'ID Transaksi',
      'Tanggal',
      'Status',
      'Tipe Transaksi',
      'Pelanggan',
      'Plat Nomor',
      'Telepon',
      'Mekanik',
      'Kasir',
      'Metode Bayar',
      'Jenis Item',
      'Nama Item',
      'Qty',
      'Harga Jual',
      'Harga Beli',
      'Margin Item',
      'Subtotal Item',
      'Total Jasa (Transaksi)',
      'Total Sparepart (Transaksi)',
      'Total Transaksi',
      'Total Margin Sparepart',
      'Pendapatan Kotor',
    ]);

    const rows: string[] = [];
    let rowNumber = 1;

    const pushLineRow = (
      t: Transaction,
      txMarginSp: number,
      txGrossProfit: number,
      itemType: string,
      itemName: string,
      qty: number,
      unitPrice: number,
      buyPrice: number | '',
      lineSubtotal: number,
      itemMargin: number | ''
    ) => {
      rows.push(
        csvRow([
          rowNumber++,
          t.id,
          formatDateTime(t.created_at),
          STATUS_LABELS[t.status] ?? t.status,
          TYPE_LABELS[t.type] ?? t.type,
          t.customer_name ?? '-',
          t.customer_plate ?? '-',
          t.customer_phone ?? '-',
          t.mechanic_name ?? '-',
          t.cashier_name ?? '-',
          t.payment_method ?? '-',
          itemType,
          itemName,
          qty,
          unitPrice,
          buyPrice,
          itemMargin,
          lineSubtotal,
          t.total_service,
          t.total_sparepart,
          t.total_amount,
          txMarginSp,
          txGrossProfit,
        ])
      );
    };

    for (const t of transactions) {
      const services = t.service_items ?? [];
      const spareparts = t.spareparts ?? [];

      const txMarginSp = spareparts.reduce((sum, sp) => {
        const buy = sp.buy_price ?? 0;
        return sum + ((sp.sell_price ?? 0) - buy) * (sp.quantity ?? 1);
      }, 0);
      const txGrossProfit = t.total_service + txMarginSp;

      for (const item of services) {
        pushLineRow(t, txMarginSp, txGrossProfit, 'Jasa', item.service_name, 1, item.price, '', item.price, '');
      }

      for (const item of spareparts) {
        const qty = item.quantity ?? 1;
        const sellP = item.sell_price ?? 0;
        const buyP = item.buy_price ?? 0;
        const lineSubtotal = qty * sellP;
        const itemMargin = (sellP - buyP) * qty;
        pushLineRow(t, txMarginSp, txGrossProfit, 'Sparepart', item.sparepart_name ?? '-', qty, sellP, buyP, lineSubtotal, itemMargin);
      }

      if (services.length === 0 && spareparts.length === 0) {
        pushLineRow(t, 0, t.total_service, '-', '(tidak ada item)', 0, 0, '', 0, '');
      }
    }

    const csv = '\uFEFF' + header + '\n' + rows.join('\n');
    const filename = `transaksi_detail_${Date.now()}.csv`;
    const fileUri = (FileSystem.documentDirectory ?? '') + filename;
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export CSV / Excel',
      });
    }
  },
};
