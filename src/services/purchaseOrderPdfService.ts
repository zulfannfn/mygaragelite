import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { PurchaseOrder } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/date';
import { settingsService } from './settingsService';

async function getShopName(): Promise<string> {
  const name = await settingsService.get('workshop_name');
  return name ?? 'MyGarage Bengkel';
}

function poTitle(po: PurchaseOrder): string {
  return po.po_number || `PO-${po.id.slice(0, 6).toUpperCase()}`;
}

function baseStyles(): string {
  return `
    body { font-family: -apple-system, system-ui, sans-serif; padding: 24px; color: #111; }
    h1 { color: #FF6B35; margin: 0; font-size: 20px; }
    .header { border-bottom: 3px solid #FF6B35; padding-bottom: 10px; margin-bottom: 18px; }
    .meta { margin-bottom: 16px; font-size: 13px; }
    .meta div { margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px; }
    th { background: #0F3460; color: white; padding: 8px; text-align: left; }
    td { border-bottom: 1px solid #ddd; padding: 8px; }
    .signatures { display: flex; justify-content: space-between; margin-top: 60px; font-size: 13px; }
    .sign-box { width: 45%; text-align: center; }
    .sign-line { margin-top: 60px; border-top: 1px solid #333; padding-top: 6px; }
  `;
}

export const purchaseOrderPdfService = {
  /** Berita Acara Purchase Order — printed while the PO is still "sedang pre order". */
  async printBeritaAcaraPO(po: PurchaseOrder): Promise<void> {
    const shopName = await getShopName();
    const items = po.items ?? [];
    const rows = items
      .map(
        (it, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${it.sparepart_name}</td>
          <td style="text-align:right">${it.qty_ordered}</td>
        </tr>`
      )
      .join('');

    const html = `
    <html>
      <head><meta charset="utf-8" /><style>${baseStyles()}</style></head>
      <body>
        <div class="header"><h1>${shopName}</h1><p>Berita Acara Purchase Order</p></div>
        <div class="meta">
          <div><strong>No. PO:</strong> ${poTitle(po)}</div>
          <div><strong>Tanggal:</strong> ${formatDate(po.created_at)}</div>
          <div><strong>Supplier:</strong> ${po.supplier || '-'}</div>
          ${po.notes ? `<div><strong>Catatan:</strong> ${po.notes}</div>` : ''}
        </div>
        <p style="font-size:13px">Dengan ini menyatakan telah dibuat pemesanan sparepart kepada supplier di atas dengan rincian sebagai berikut:</p>
        <table>
          <thead><tr><th>#</th><th>Nama Sparepart</th><th style="text-align:right">Qty Pesan</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3" style="text-align:center">Tidak ada item</td></tr>'}</tbody>
        </table>
        <div class="signatures">
          <div class="sign-box">Dibuat oleh<div class="sign-line">(${shopName})</div></div>
          <div class="sign-box">Disetujui Supplier<div class="sign-line">(${po.supplier || '-'})</div></div>
        </div>
      </body>
    </html>`;

    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Berita Acara PO - ${poTitle(po)}` });
    }
  },

  /** Berita Acara Terima Barang — printed once items have been marked received ("belum input"). */
  async printBeritaAcaraTerima(po: PurchaseOrder): Promise<void> {
    const shopName = await getShopName();
    const items = po.items ?? [];
    const rows = items
      .map(
        (it, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${it.sparepart_name}</td>
          <td style="text-align:right">${it.qty_ordered}</td>
          <td style="text-align:right">${it.qty_received}</td>
          <td style="text-align:right">${formatCurrency(it.buy_price)}</td>
        </tr>`
      )
      .join('');

    const html = `
    <html>
      <head><meta charset="utf-8" /><style>${baseStyles()}</style></head>
      <body>
        <div class="header"><h1>${shopName}</h1><p>Berita Acara Terima Barang</p></div>
        <div class="meta">
          <div><strong>No. PO:</strong> ${poTitle(po)}</div>
          <div><strong>Tanggal Terima:</strong> ${formatDate(po.updated_at)}</div>
          <div><strong>Supplier:</strong> ${po.supplier || '-'}</div>
        </div>
        <p style="font-size:13px">Dengan ini menyatakan telah diterima barang dari supplier di atas dengan rincian sebagai berikut:</p>
        <table>
          <thead><tr><th>#</th><th>Nama Sparepart</th><th style="text-align:right">Qty Pesan</th><th style="text-align:right">Qty Diterima</th><th style="text-align:right">Harga Beli</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" style="text-align:center">Tidak ada item</td></tr>'}</tbody>
        </table>
        <div class="signatures">
          <div class="sign-box">Yang Menyerahkan<div class="sign-line">(${po.supplier || '-'})</div></div>
          <div class="sign-box">Yang Menerima<div class="sign-line">(${shopName})</div></div>
        </div>
      </body>
    </html>`;

    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Berita Acara Terima - ${poTitle(po)}` });
    }
  },
};
