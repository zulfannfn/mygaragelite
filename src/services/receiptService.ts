import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatDateTime } from '../utils/date';
import { settingsService } from './settingsService';
import { useAppStore } from '../store/useAppStore';
import { customerService } from './customerService';

let BLEPrinter: any = null;
if (Platform.OS !== 'web') {
  try {
    const printerModule = require('react-native-thermal-receipt-printer-image-qr');
    BLEPrinter = printerModule.BLEPrinter;
  } catch (e) {
    console.warn('BLEPrinter not available');
  }
}

export type PrintMethod = 'bluetooth' | 'pdf';

export class PrinterPrintError extends Error {
  constructor(
    message = 'Gagal mengirim struk ke printer. Pastikan printer menyala dan terhubung.'
  ) {
    super(message);
    this.name = 'PrinterPrintError';
  }
}

export interface ShopInfo {
  name: string;
  address: string;
  phone: string;
  paperSize?: string;
  footer?: string;
}

async function getShopInfo(override?: Partial<ShopInfo>): Promise<ShopInfo> {
  const all = await settingsService.getAll();
  return {
    name: override?.name ?? all.workshop_name ?? 'MyGarage Bengkel',
    address: override?.address ?? all.workshop_address ?? '',
    phone: override?.phone ?? all.workshop_phone ?? '',
    paperSize: all.receipt_paper_size ?? '80mm',
    footer: all.receipt_footer ?? '',
  };
}

function statusLabel(s: Transaction['status']): string {
  return s === 'paid' ? 'LUNAS' : s === 'pending' ? 'BELUM LUNAS' : 'DIBATALKAN';
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

/**
 * Normalisasi nomor HP Indonesia ke format internasional 62xxxxx.
 * Contoh: 081234... -> 6281234..., +6281234... -> 6281234...
 */
export function normalizePhoneId(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return '62' + digits.slice(1);
  return digits;
}

export const receiptService = {
  async buildText(tx: Transaction, shopOverride?: Partial<ShopInfo>): Promise<string> {
    const shop = await getShopInfo(shopOverride);
    const lines: string[] = [];
    const sep = '--------------------------------';

    lines.push(`*${shop.name}*`);
    if (shop.address) lines.push(shop.address);
    if (shop.phone) lines.push(`Telp: ${shop.phone}`);
    lines.push(sep);
    lines.push(`No   : ${shortId(tx.id)}`);
    lines.push(`Tgl  : ${formatDateTime(tx.created_at)}`);
    lines.push(
      `Pelanggan: ${tx.customer_name ?? '-'}${tx.customer_plate ? ` (${tx.customer_plate})` : ''}`
    );
    if (tx.mechanic_name && tx.type !== 'retail') lines.push(`Mekanik  : ${tx.mechanic_name}`);
    if (tx.cashier_name) lines.push(`Kasir    : ${tx.cashier_name}`);
    lines.push(sep);

    if (tx.complaint && tx.complaint.trim() && tx.type !== 'retail') {
      lines.push(`Keluhan: ${tx.complaint.trim()}`);
      lines.push('');
    }

    if (tx.service_items && tx.service_items.length > 0 && tx.type !== 'retail') {
      lines.push('JASA:');
      for (const s of tx.service_items) {
        lines.push(`- ${s.service_name}`);
        lines.push(`    ${formatCurrency(s.price)}`);
      }
      lines.push('');
    }

    if (tx.spareparts && tx.spareparts.length > 0) {
      lines.push('SPAREPART:');
      for (const p of tx.spareparts) {
        lines.push(`- ${p.sparepart_name} x${p.quantity}`);
        lines.push(
          `    ${formatCurrency(p.sell_price)} = ${formatCurrency(p.sell_price * p.quantity)}`
        );
      }
      lines.push('');
    }

    lines.push(sep);
    if (tx.type !== 'retail') lines.push(`Subtotal Jasa     : ${formatCurrency(tx.total_service)}`);
    lines.push(`Subtotal Sparepart: ${formatCurrency(tx.total_sparepart)}`);
    lines.push(`*TOTAL            : ${formatCurrency(tx.total_amount)}*`);
    if (tx.type === 'retail' && tx.payment_method === 'Tunai' && tx.paid_amount > 0) {
      lines.push(`Bayar             : ${formatCurrency(tx.paid_amount)}`);
      lines.push(`Kembali           : ${formatCurrency(tx.change_amount)}`);
    }
    lines.push(`Status: ${statusLabel(tx.status)}${tx.payment_method ? ` (${tx.payment_method})` : ''}`);

    if (tx.recommendation && tx.recommendation.trim() && tx.type !== 'retail') {
      lines.push('');
      lines.push(`Rekomendasi: ${tx.recommendation.trim()}`);
    }

    lines.push('');
    lines.push('Terima kasih atas kepercayaan Anda 🙏');
    return lines.join('\n');
  },

  async buildHtml(tx: Transaction, shopOverride?: Partial<ShopInfo>): Promise<string> {
    const shop = await getShopInfo(shopOverride);
    const customer = tx.customer_id ? await customerService.getById(tx.customer_id) : null;

    const serviceRows = (tx.service_items ?? [])
      .map(
        (s) => `
      <tr>
        <td>${escapeHtml(s.service_name)}</td>
        <td style="text-align:right">${formatCurrency(s.price)}</td>
      </tr>`
      )
      .join('');

    const sparepartRows = (tx.spareparts ?? [])
      .map(
        (p) => `
      <tr>
        <td>${escapeHtml(p.sparepart_name ?? '-')} <span style="color:#888">×${p.quantity}</span></td>
        <td style="text-align:right">${formatCurrency(p.sell_price * p.quantity)}</td>
      </tr>`
      )
      .join('');

    const getPaperStyle = () => {
      if (shop.paperSize === '58mm') return "width: 100%; max-width: 220px; font-size: 10px; margin: 0 auto; padding: 10px 4px;";
      if (shop.paperSize === '80mm') return "width: 100%; max-width: 300px; font-size: 12px; margin: 0 auto; padding: 10px 8px;";
      return "font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; padding: 18px; color: #222;";
    };

    return `
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" />
        <style>
          * { box-sizing: border-box; font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; }
          body { color: #000; ${getPaperStyle()} }
          .header { text-align: center; border-bottom: 2px dashed #999; padding-bottom: 8px; margin-bottom: 12px; }
          .shop-name { font-size: 1.4em; font-weight: 800; color: #000; margin: 0; }
          .shop-info { font-size: 0.9em; color: #333; margin: 2px 0 0; }
          .meta { font-size: 0.95em; margin-bottom: 10px; }
          .meta div { margin: 2px 0; }
          .section-title { font-size: 0.9em; font-weight: 700; letter-spacing: 1px; color:#555; margin: 12px 0 4px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; font-size: 1em; }
          td { padding: 4px 0; border-bottom: 1px dotted #ccc; }
          .totals { margin-top: 10px; font-size: 1em; }
          .totals .row { display: flex; justify-content: space-between; padding: 3px 0; }
          .grand { font-size: 1.2em; font-weight: 800; border-top: 2px solid #333; padding-top: 6px; margin-top: 4px; }
          .status { display: inline-block; padding: 3px 8px; border-radius: 999px; font-weight: 700; font-size: 0.85em; border: 1px solid #333; }
          .note { border: 1px solid #ccc; padding: 6px; font-size: 0.9em; margin-top: 6px; }
          .footer { text-align: center; margin-top: 18px; font-size: 0.85em; color: #555; }
        </style>
      </head>
      <body>
        <div class="header">
          <p class="shop-name">${escapeHtml(shop.name)}</p>
          ${shop.address ? `<p class="shop-info">${escapeHtml(shop.address)}</p>` : ''}
          ${shop.phone ? `<p class="shop-info">Telp: ${escapeHtml(shop.phone)}</p>` : ''}
        </div>

        <div class="meta">
          <div><b>No:</b> ${shortId(tx.id)}</div>
          <div><b>Tanggal:</b> ${formatDateTime(tx.created_at)}</div>
          <div><b>Pelanggan:</b> ${escapeHtml(tx.customer_name ?? '-')}</div>
          ${tx.customer_phone ? `<div><b>No HP:</b> ${escapeHtml(tx.customer_phone)}</div>` : ''}
          ${customer?.vehicle_brand || customer?.vehicle_type || tx.customer_plate ? `<div><b>Kendaraan:</b> ${escapeHtml(customer?.vehicle_brand ?? '')} ${escapeHtml(customer?.vehicle_type ?? '')} ${tx.customer_plate ? `(${escapeHtml(tx.customer_plate)})` : ''}</div>` : ''}
          ${tx.mechanic_name && tx.type !== 'retail' ? `<div><b>Mekanik:</b> ${escapeHtml(tx.mechanic_name)}</div>` : ''}
          ${tx.cashier_name ? `<div><b>Kasir:</b> ${escapeHtml(tx.cashier_name)}</div>` : ''}
          <div style="margin-top:6px">
            <span class="status ${tx.status}">${statusLabel(tx.status)}${tx.type === 'retail' ? ' - KASIR' : ''}</span>
            ${tx.payment_method ? `<span style="margin-left:6px;font-size:12px;color:#555">${escapeHtml(tx.payment_method)}</span>` : ''}
          </div>
        </div>

        ${
          tx.complaint && tx.complaint.trim() && tx.type !== 'retail'
            ? `<div class="section-title">Keluhan</div><div class="note">${escapeHtml(tx.complaint)}</div>`
            : ''
        }

        ${
          serviceRows && tx.type !== 'retail'
            ? `<div class="section-title">Jasa Servis</div>
               <table>${serviceRows}</table>`
            : ''
        }

        ${
          sparepartRows
            ? `<div class="section-title">Sparepart</div>
               <table>${sparepartRows}</table>`
            : ''
        }

        <div class="totals">
          ${tx.type !== 'retail' ? `<div class="row"><span>Subtotal Jasa</span><span>${formatCurrency(tx.total_service)}</span></div>` : ''}
          <div class="row"><span>Subtotal Sparepart</span><span>${formatCurrency(tx.total_sparepart)}</span></div>
          <div class="row grand"><span>TOTAL</span><span>${formatCurrency(tx.total_amount)}</span></div>
          ${tx.type === 'retail' && tx.payment_method === 'Tunai' && tx.paid_amount > 0 ? `<div class="row"><span>Bayar</span><span>${formatCurrency(tx.paid_amount)}</span></div>` : ''}
          ${tx.type === 'retail' && tx.payment_method === 'Tunai' && tx.change_amount > 0 ? `<div class="row"><span>Kembali</span><span>${formatCurrency(tx.change_amount)}</span></div>` : ''}
        </div>

        ${
          tx.mechanic_notes && tx.mechanic_notes.trim() && tx.type !== 'retail'
            ? `<div class="section-title">Catatan Internal Mekanik</div>
               <div class="note">${escapeHtml(tx.mechanic_notes)}</div>`
            : ''
        }

        ${
          tx.recommendation && tx.recommendation.trim() && tx.type !== 'retail'
            ? `<div class="section-title">Rekomendasi Servis Berikutnya</div>
               <div class="note">${escapeHtml(tx.recommendation)}</div>`
            : ''
        }

        <div class="footer">${escapeHtml(shop.footer || 'Terima kasih atas kepercayaan Anda 🙏')}<br/>Cetak via MyGarage Lite</div>
      </body>
    </html>`;
  },

  async buildPendingHtml(tx: Transaction, shopOverride?: Partial<ShopInfo>): Promise<string> {
    const shop = await getShopInfo(shopOverride);
    const customer = tx.customer_id ? await customerService.getById(tx.customer_id) : null;
    const getPaperStyle = () => {
      if (shop.paperSize === '58mm') return "width: 100%; max-width: 220px; font-size: 11px; margin: 0 auto; padding: 12px 6px;";
      if (shop.paperSize === '80mm') return "width: 100%; max-width: 300px; font-size: 13px; margin: 0 auto; padding: 12px 10px;";
      return "font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; padding: 18px; color: #222;";
    };

    return `
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" />
        <style>
          * { box-sizing: border-box; font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; }
          body { color: #000; ${getPaperStyle()} }
          .header { text-align: center; border-bottom: 2px dashed #999; padding-bottom: 10px; margin-bottom: 12px; }
          .shop-name { font-size: 1.4em; font-weight: 800; color: #000; margin: 0; }
          .shop-info { font-size: 0.9em; color: #333; margin: 2px 0 0; }
          .banner { background: #FFB80022; border: 2px dashed #FFB800; border-radius: 10px; padding: 14px; text-align: center; margin: 14px 0; }
          .banner-title { font-size: 1.1em; font-weight: 800; color: #a07700; margin: 0; }
          .banner-sub { font-size: 0.9em; color: #a07700; margin-top: 4px; }
          .meta { font-size: 0.95em; margin-bottom: 10px; }
          .meta div { margin: 3px 0; }
          .section-title { font-size: 0.85em; font-weight: 700; letter-spacing: 1px; color:#555; margin: 12px 0 4px; text-transform: uppercase; }
          .note { border: 1px solid #ccc; padding: 10px 12px; border-radius: 8px; font-size: 0.95em; margin-top: 6px; line-height: 1.5; }
          .note strong { color: #000; }
          .status-box { background: #00C89622; border-radius: 8px; padding: 10px 12px; margin-top: 12px; border: 1px solid #00865f; }
          .status-box .label { font-size: 0.8em; font-weight: 700; color: #00865f; text-transform: uppercase; letter-spacing: 0.5px; }
          .status-box .value { font-size: 0.95em; color: #000; margin-top: 2px; }
          .footer { text-align: center; margin-top: 18px; font-size: 0.85em; color: #555; }
          .footer strong { color: #000; }
        </style>
      </head>
      <body>
        <div class="header">
          <p class="shop-name">${escapeHtml(shop.name)}</p>
          ${shop.address ? `<p class="shop-info">${escapeHtml(shop.address)}</p>` : ''}
          ${shop.phone ? `<p class="shop-info">Telp: ${escapeHtml(shop.phone)}</p>` : ''}
        </div>

        <div class="banner">
          <p class="banner-title">ORDER BERHASIL DIBUAT</p>
          <p class="banner-sub">Kendaraan sedang dalam proses servis</p>
        </div>

        <div class="meta">
          <div><b>No Servis:</b> ${shortId(tx.id)}</div>
          <div><b>Tanggal:</b> ${formatDateTime(tx.created_at)}</div>
          <div><b>Pelanggan:</b> ${escapeHtml(tx.customer_name ?? '-')}</div>
          ${tx.customer_phone ? `<div><b>No HP:</b> ${escapeHtml(tx.customer_phone)}</div>` : ''}
          ${customer?.vehicle_brand || customer?.vehicle_type || tx.customer_plate ? `<div><b>Kendaraan:</b> ${escapeHtml(customer?.vehicle_brand ?? '')} ${escapeHtml(customer?.vehicle_type ?? '')} ${tx.customer_plate ? `(${escapeHtml(tx.customer_plate)})` : ''}</div>` : ''}
          ${tx.mechanic_name ? `<div><b>Mekanik:</b> ${escapeHtml(tx.mechanic_name)}</div>` : ''}
          ${tx.cashier_name ? `<div><b>Kasir:</b> ${escapeHtml(tx.cashier_name)}</div>` : ''}
        </div>

        ${
          tx.complaint && tx.complaint.trim()
            ? `<div class="section-title">Keluhan Pelanggan</div><div class="note"><strong>Keluhan:</strong> ${escapeHtml(tx.complaint)}</div>`
            : ''
        }

        <div class="status-box">
          <div class="label">Status</div>
          <div class="value">${statusLabel(tx.status)} — Kendaraan sedang dikerjakan oleh mekanik. Kami akan menghubungi Anda setelah servis selesai.</div>
        </div>

        <div class="footer">
          <strong>${escapeHtml(shop.footer || 'Terima kasih atas kepercayaan Anda 🙏')}</strong><br/>
          Cetak via MyGarage Lite
        </div>
      </body>
    </html>`;
  },

  async printPdf(
    tx: Transaction,
    receiptType: 'tagihan' | 'diterima' = 'tagihan',
    shopOverride?: Partial<ShopInfo>
  ): Promise<PrintMethod> {
    const store = useAppStore.getState();
    const connectedPrinter = store.connectedPrinter;
    const shop = await getShopInfo(shopOverride);
    const wantsBluetooth =
      !!connectedPrinter && shop.paperSize !== 'A4' && Platform.OS !== 'web';

    if (wantsBluetooth && !BLEPrinter) {
      throw new PrinterPrintError(
        'Modul printer tidak tersedia. Hubungkan ulang printer di Pengaturan.'
      );
    }

    if (connectedPrinter && BLEPrinter && Platform.OS !== 'web') {
      const customer = tx.customer_id ? await customerService.getById(tx.customer_id) : null;
      if (shop.paperSize !== 'A4') {
        try {
          await BLEPrinter.init();
          try {
            await BLEPrinter.connectPrinter(connectedPrinter.mac);
          } catch (connectErr) {
            // Bisa gagal jika sudah terkoneksi; lanjut coba cetak
            console.warn('Printer connect retry:', connectErr);
          }

          const is80 = shop.paperSize === '80mm';
          const maxChar = is80 ? 48 : 32;
          const sep = '-'.repeat(maxChar) + "\n";

          const alignLR = (left: string, right: string) => {
            const spaces = Math.max(1, maxChar - left.length - right.length);
            return left + ' '.repeat(spaces) + right + "\n";
          };

          let rawPrint = "";
          
          rawPrint += "<C><B>" + shop.name + "</B></C>\n";
          if (shop.address) rawPrint += "<C>" + shop.address + "</C>\n";
          if (shop.phone) rawPrint += "<C>Telp: " + shop.phone + "</C>\n";
          rawPrint += sep;
          rawPrint += "No   : " + shortId(tx.id) + "\n";
          rawPrint += "Tgl  : " + formatDateTime(tx.created_at) + "\n";
          rawPrint += "Plg  : " + (tx.customer_name ?? "-") + "\n";
          if (tx.customer_phone) rawPrint += "No HP: " + tx.customer_phone + "\n";
          if (customer?.vehicle_brand || customer?.vehicle_type || tx.customer_plate) {
              const brand = customer?.vehicle_brand ? customer.vehicle_brand + " " : "";
              const vtype = customer?.vehicle_type ? customer.vehicle_type + " " : "";
              const plat = tx.customer_plate ? "(" + tx.customer_plate + ")" : "";
              rawPrint += "Knd  : " + brand + vtype + plat + "\n";
          }
          if (tx.mechanic_name && tx.type !== 'retail') rawPrint += "Mek  : " + tx.mechanic_name + "\n";
          if (tx.cashier_name) rawPrint += "Ksr  : " + tx.cashier_name + "\n";
          rawPrint += sep;
          
          if (receiptType === 'diterima' && tx.complaint && tx.type !== 'retail') {
            rawPrint += "KELUHAN:\n";
            rawPrint += tx.complaint + "\n";
            rawPrint += sep;
          }
          
          if (receiptType === 'tagihan' || tx.type === 'retail') {
            if (tx.service_items && tx.service_items.length > 0) {
               rawPrint += "JASA\n";
               for (const s of tx.service_items) {
                 rawPrint += s.service_name + "\n";
                 rawPrint += alignLR('', formatCurrency(s.price));
               }
            }
            if (tx.spareparts && tx.spareparts.length > 0) {
               rawPrint += "SPAREPART\n";
               for (const p of tx.spareparts) {
                 rawPrint += p.sparepart_name + "\n";
                 rawPrint += alignLR("  " + p.quantity + "x " + formatCurrency(p.sell_price), formatCurrency(p.quantity * p.sell_price));
               }
            }
            
            rawPrint += sep;
            if (tx.type !== 'retail') rawPrint += alignLR('Total Jasa', formatCurrency(tx.total_service));
            rawPrint += alignLR('Total Part', formatCurrency(tx.total_sparepart));
            rawPrint += alignLR('TOTAL', formatCurrency(tx.total_amount));
            if (tx.type === 'retail' && tx.payment_method === 'Tunai') {
              rawPrint += alignLR('Bayar', formatCurrency(tx.paid_amount));
              rawPrint += alignLR('Kembali', formatCurrency(tx.change_amount));
            }
            rawPrint += sep;
          }
          
          if (receiptType === 'diterima') {
            rawPrint += "<C>SERVICE DITERIMA</C>\n";
            rawPrint += "<C>Kendaraan sedang diservis</C>\n";
          } else {
            if (tx.type === 'retail') {
               rawPrint += "<C>LUNAS - KASIR</C>\n";
            } else {
               rawPrint += tx.status === 'paid' ? "<C>LUNAS</C>\n" : "<C>BELUM LUNAS</C>\n";
            }
          }
          rawPrint += sep;

          if (receiptType === 'tagihan' && tx.status === 'paid') {
            if (tx.mechanic_notes) {
                rawPrint += "Catatan Mekanik:\n";
                rawPrint += tx.mechanic_notes + "\n";
                rawPrint += sep;
            }
            if (tx.recommendation) {
                rawPrint += "Rekomendasi Berikutnya:\n";
                rawPrint += tx.recommendation + "\n";
                rawPrint += sep;
            }
          }

          rawPrint += "<C>" + (shop.footer || 'Terima kasih atas kepercayaan Anda') + "</C>\n";
          rawPrint += "<C>Cetak via MyGarage Lite</C>\n\n\n";

          await BLEPrinter.printBill(rawPrint);
          return 'bluetooth';
        } catch (e) {
          if (e instanceof PrinterPrintError) throw e;
          console.warn('Bluetooth print failed:', e);
          throw new PrinterPrintError();
        }
      }
    }

    // Tanpa printer thermal / kertas A4: cetak PDF
    const html = receiptType === 'diterima'
      ? await this.buildPendingHtml(tx, shopOverride)
      : await this.buildHtml(tx, shopOverride);
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: receiptType === 'diterima' ? 'Order Dibuat' : 'Struk Servis',
      });
    }
    return 'pdf';
  },

  /**
   * Template: pemberitahuan service sudah dibuat (saat tx dibuat / pending).
   */
  async buildWaCreated(tx: Transaction, shopOverride?: Partial<ShopInfo>): Promise<string> {
    const shop = await getShopInfo(shopOverride);
    const lines: string[] = [];
    lines.push(`Halo *${tx.customer_name ?? 'Pelanggan'}* 👋`);
    lines.push('');
    lines.push(`Kendaraan Anda${tx.customer_plate ? ` (${tx.customer_plate})` : ''} telah kami terima dan sedang dalam proses servis di *${shop.name}*.`);
    if (tx.complaint && tx.complaint.trim()) {
      lines.push('');
      lines.push(`Keluhan tercatat: _${tx.complaint.trim()}_`);
    }
    if (tx.mechanic_name) {
      lines.push('');
      lines.push(`Mekanik: *${tx.mechanic_name}*`);
    }
    if (tx.cashier_name) {
      lines.push('');
      lines.push(`Kasir: *${tx.cashier_name}*`);
    }
    lines.push('');
    lines.push(`No. Servis: *${shortId(tx.id)}*`);
    lines.push('');
    lines.push('Kami akan menghubungi Anda lagi setelah servis selesai. Terima kasih 🙏');
    if (shop.phone) {
      lines.push('');
      lines.push(`Bengkel: ${shop.phone}`);
    }
    return lines.join('\n');
  },

  /**
   * Template: service selesai + tagihan (untuk status pending dengan total).
   */
  async buildWaReady(tx: Transaction, shopOverride?: Partial<ShopInfo>): Promise<string> {
    const shop = await getShopInfo(shopOverride);
    const lines: string[] = [];
    lines.push(`Halo *${tx.customer_name ?? 'Pelanggan'}* 👋`);
    lines.push('');
    lines.push(`Servis kendaraan Anda${tx.customer_plate ? ` (${tx.customer_plate})` : ''} di *${shop.name}* sudah *SELESAI* ✅`);
    lines.push('Kendaraan siap diambil.');
    lines.push('');
    if (tx.service_items && tx.service_items.length > 0) {
      lines.push('*Jasa:*');
      for (const s of tx.service_items) {
        lines.push(`• ${s.service_name} — ${formatCurrency(s.price)}`);
      }
    }
    if (tx.spareparts && tx.spareparts.length > 0) {
      lines.push('*Sparepart:*');
      for (const p of tx.spareparts) {
        lines.push(`• ${p.sparepart_name} ×${p.quantity} — ${formatCurrency(p.sell_price * p.quantity)}`);
      }
    }
    lines.push('');
    lines.push(`*TOTAL TAGIHAN: ${formatCurrency(tx.total_amount)}*`);
    lines.push('Mohon untuk segera melakukan pembayaran saat pengambilan. 🙏');
    if (tx.mechanic_name) {
      lines.push('');
      lines.push(`Mekanik: *${tx.mechanic_name}*`);
    }
    if (tx.cashier_name) {
      lines.push('');
      lines.push(`Kasir: *${tx.cashier_name}*`);
    }
    if (tx.recommendation && tx.recommendation.trim()) {
      lines.push('');
      lines.push(`💡 Rekomendasi: _${tx.recommendation.trim()}_`);
    }
    if (shop.phone) {
      lines.push('');
      lines.push(`Bengkel: ${shop.phone}`);
    }
    return lines.join('\n');
  },

  /**
   * Template: service selesai + sudah lunas (struk lengkap).
   */
  async buildWaPaid(tx: Transaction, shopOverride?: Partial<ShopInfo>): Promise<string> {
    const text = await this.buildText(tx, shopOverride);
    return `Halo *${tx.customer_name ?? 'Pelanggan'}* 👋\nServis sudah selesai dan *LUNAS* ✅\nBerikut struk Anda:\n\n${text}`;
  },

  /**
   * Open WhatsApp chat with prefilled receipt text (default = receipt).
   */
  async sendWhatsApp(
    tx: Transaction,
    shopOverride?: Partial<ShopInfo>
  ): Promise<{ ok: boolean; reason?: string }> {
    const text = await this.buildText(tx, shopOverride);
    return this.sendWhatsAppText(tx.customer_phone ?? '', text);
  },

  /**
   * Generic helper: kirim text apa pun ke nomor pelanggan.
   */
  async sendWhatsAppText(
    phoneRaw: string,
    text: string
  ): Promise<{ ok: boolean; reason?: string }> {
    const phone = normalizePhoneId(phoneRaw);
    if (!phone) {
      return { ok: false, reason: 'Pelanggan belum punya nomor HP' };
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) return { ok: false, reason: 'WhatsApp tidak tersedia' };
      await Linking.openURL(url);
      return { ok: true };
    } catch {
      return { ok: false, reason: 'Gagal membuka WhatsApp' };
    }
  },
};

function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
