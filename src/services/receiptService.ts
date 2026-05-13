import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatDateTime } from '../utils/date';
import { settingsService } from './settingsService';

export interface ShopInfo {
  name: string;
  address: string;
  phone: string;
}

async function getShopInfo(override?: Partial<ShopInfo>): Promise<ShopInfo> {
  const all = await settingsService.getAll();
  return {
    name: override?.name ?? all.workshop_name ?? 'MyGarage Bengkel',
    address: override?.address ?? all.workshop_address ?? '',
    phone: override?.phone ?? all.workshop_phone ?? '',
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
    if (tx.mechanic_name) lines.push(`Mekanik  : ${tx.mechanic_name}`);
    lines.push(sep);

    if (tx.complaint && tx.complaint.trim()) {
      lines.push(`Keluhan: ${tx.complaint.trim()}`);
      lines.push('');
    }

    if (tx.service_items && tx.service_items.length > 0) {
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
    lines.push(`Subtotal Jasa     : ${formatCurrency(tx.total_service)}`);
    lines.push(`Subtotal Sparepart: ${formatCurrency(tx.total_sparepart)}`);
    lines.push(`*TOTAL            : ${formatCurrency(tx.total_amount)}*`);
    lines.push(`Status: ${statusLabel(tx.status)}${tx.payment_method ? ` (${tx.payment_method})` : ''}`);

    if (tx.recommendation && tx.recommendation.trim()) {
      lines.push('');
      lines.push(`Rekomendasi: ${tx.recommendation.trim()}`);
    }

    lines.push('');
    lines.push('Terima kasih atas kepercayaan Anda 🙏');
    return lines.join('\n');
  },

  async buildHtml(tx: Transaction, shopOverride?: Partial<ShopInfo>): Promise<string> {
    const shop = await getShopInfo(shopOverride);

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

    return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; padding: 18px; color: #222; }
          .header { text-align: center; border-bottom: 2px dashed #999; padding-bottom: 10px; margin-bottom: 12px; }
          .shop-name { font-size: 20px; font-weight: 800; color: #FF6B35; margin: 0; }
          .shop-info { font-size: 12px; color: #555; margin: 2px 0 0; }
          .meta { font-size: 12px; margin-bottom: 10px; }
          .meta div { margin: 2px 0; }
          .section-title { font-size: 11px; font-weight: 700; letterSpacing: 1px; color:#777; margin: 12px 0 4px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          td { padding: 6px 0; border-bottom: 1px dotted #ccc; }
          .totals { margin-top: 10px; font-size: 13px; }
          .totals .row { display: flex; justify-content: space-between; padding: 3px 0; }
          .grand { font-size: 16px; font-weight: 800; color: #FF6B35; border-top: 2px solid #333; padding-top: 6px; margin-top: 4px; }
          .status { display: inline-block; padding: 4px 10px; border-radius: 999px; font-weight: 700; font-size: 11px; }
          .status.paid { background: #00C89622; color: #00865f; }
          .status.pending { background: #FFB80022; color: #a07700; }
          .status.cancelled { background: #FF475722; color: #b8323f; }
          .note { background: #f5f5f7; padding: 8px 10px; border-radius: 8px; font-size: 12px; margin-top: 8px; }
          .footer { text-align: center; margin-top: 18px; font-size: 11px; color: #888; }
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
          <div><b>Pelanggan:</b> ${escapeHtml(tx.customer_name ?? '-')}${tx.customer_plate ? ` (${escapeHtml(tx.customer_plate)})` : ''}</div>
          ${tx.mechanic_name ? `<div><b>Mekanik:</b> ${escapeHtml(tx.mechanic_name)}</div>` : ''}
          <div style="margin-top:6px">
            <span class="status ${tx.status}">${statusLabel(tx.status)}</span>
            ${tx.payment_method ? `<span style="margin-left:6px;font-size:12px;color:#555">${escapeHtml(tx.payment_method)}</span>` : ''}
          </div>
        </div>

        ${
          tx.complaint && tx.complaint.trim()
            ? `<div class="section-title">Keluhan</div><div class="note">${escapeHtml(tx.complaint)}</div>`
            : ''
        }

        ${
          serviceRows
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
          <div class="row"><span>Subtotal Jasa</span><span>${formatCurrency(tx.total_service)}</span></div>
          <div class="row"><span>Subtotal Sparepart</span><span>${formatCurrency(tx.total_sparepart)}</span></div>
          <div class="row grand"><span>TOTAL</span><span>${formatCurrency(tx.total_amount)}</span></div>
        </div>

        ${
          tx.recommendation && tx.recommendation.trim()
            ? `<div class="section-title">Rekomendasi Servis Berikutnya</div>
               <div class="note">${escapeHtml(tx.recommendation)}</div>`
            : ''
        }

        <div class="footer">Terima kasih atas kepercayaan Anda 🙏<br/>Cetak via MyGarage Lite</div>
      </body>
    </html>`;
  },

  async printPdf(tx: Transaction, shopOverride?: Partial<ShopInfo>): Promise<void> {
    const html = await this.buildHtml(tx, shopOverride);
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Struk Servis',
      });
    }
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
