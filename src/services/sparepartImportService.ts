import { parseCSV } from '../utils/csv';
import { sparepartService } from './sparepartService';
import { stockHistoryService } from './stockHistoryService';

type Field =
  | 'name'
  | 'category'
  | 'stock'
  | 'min_stock'
  | 'buy_price'
  | 'sell_price'
  | 'supplier'
  | 'barcode'
  | 'brand'
  | 'rack_name'
  | 'rack_row';

const HEADER_ALIASES: Record<Field, string[]> = {
  name: ['nama', 'nama sparepart', 'name'],
  category: ['kategori', 'category'],
  stock: ['stok', 'stock'],
  min_stock: ['stok minimum', 'stok min', 'min stock', 'min_stock'],
  buy_price: ['harga beli', 'buy price', 'buy_price'],
  sell_price: ['harga jual', 'sell price', 'sell_price'],
  supplier: ['supplier', 'pemasok'],
  barcode: ['barcode', 'kode barcode'],
  brand: ['merk', 'merk sparepart', 'brand'],
  rack_name: ['nama rak', 'rack name', 'rack_name', 'rak'],
  rack_row: ['baris rak', 'rack row', 'rack_row', 'baris'],
};

export const IMPORT_COLUMN_HELP: { field: Field; label: string; required: boolean }[] = [
  { field: 'name', label: 'Nama', required: true },
  { field: 'sell_price', label: 'Harga Jual', required: true },
  { field: 'category', label: 'Kategori', required: false },
  { field: 'stock', label: 'Stok', required: false },
  { field: 'min_stock', label: 'Stok Minimum', required: false },
  { field: 'buy_price', label: 'Harga Beli', required: false },
  { field: 'supplier', label: 'Supplier', required: false },
  { field: 'barcode', label: 'Barcode', required: false },
  { field: 'brand', label: 'Merk', required: false },
  { field: 'rack_name', label: 'Nama Rak', required: false },
  { field: 'rack_row', label: 'Baris Rak', required: false },
];

export interface ParsedSparepartRow {
  rowNumber: number;
  raw: Record<string, string>;
  name: string;
  category?: string;
  stock?: number;
  min_stock?: number;
  buy_price?: number;
  sell_price?: number;
  supplier?: string;
  barcode?: string;
  brand?: string;
  rack_name?: string;
  rack_row?: string;
  valid: boolean;
  errors: string[];
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

function parsePrice(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const cleaned = v.replace(/[^0-9]/g, '');
  if (cleaned === '') return undefined;
  return parseInt(cleaned, 10);
}

function parseIntOrUndefined(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const cleaned = v.replace(/[^0-9]/g, '');
  if (cleaned === '') return undefined;
  return parseInt(cleaned, 10);
}

export const sparepartImportService = {
  /** Parses CSV text into rows, mapping recognized headers (Indonesian/English) to Sparepart fields. */
  parse(text: string): { rows: ParsedSparepartRow[]; unrecognizedHeaders: string[] } {
    const table = parseCSV(text);
    if (table.length === 0) return { rows: [], unrecognizedHeaders: [] };

    const headerRow = table[0].map(normalizeHeader);
    const fieldByColIndex: (Field | null)[] = headerRow.map((h) => {
      for (const field of Object.keys(HEADER_ALIASES) as Field[]) {
        if (HEADER_ALIASES[field].includes(h)) return field;
      }
      return null;
    });
    const unrecognizedHeaders = table[0].filter((_, i) => fieldByColIndex[i] === null && table[0][i].trim() !== '');

    const rows: ParsedSparepartRow[] = [];
    for (let r = 1; r < table.length; r++) {
      const cells = table[r];
      if (cells.every((c) => c.trim() === '')) continue;

      const raw: Record<string, string> = {};
      fieldByColIndex.forEach((field, i) => {
        if (field) raw[field] = (cells[i] ?? '').trim();
      });

      const errors: string[] = [];
      const name = raw.name?.trim() ?? '';
      if (!name) errors.push('Nama wajib diisi');
      const sellPrice = parsePrice(raw.sell_price);
      if (!sellPrice || sellPrice <= 0) errors.push('Harga jual wajib diisi dan lebih dari 0');

      rows.push({
        rowNumber: r + 1,
        raw,
        name,
        category: raw.category || undefined,
        stock: parseIntOrUndefined(raw.stock),
        min_stock: parseIntOrUndefined(raw.min_stock),
        buy_price: parsePrice(raw.buy_price),
        sell_price: sellPrice,
        supplier: raw.supplier || undefined,
        barcode: raw.barcode || undefined,
        brand: raw.brand || undefined,
        rack_name: raw.rack_name || undefined,
        rack_row: raw.rack_row || undefined,
        valid: errors.length === 0,
        errors,
      });
    }

    return { rows, unrecognizedHeaders };
  },

  /** Imports valid rows: updates an existing sparepart (matched by name, case-insensitive) or creates a new one. */
  async importRows(
    rows: ParsedSparepartRow[]
  ): Promise<{ created: number; updated: number; errors: { row: number; message: string }[] }> {
    let created = 0;
    let updated = 0;
    const errors: { row: number; message: string }[] = [];

    for (const row of rows) {
      if (!row.valid) continue;
      try {
        const existing = await sparepartService.getByName(row.name);
        if (existing) {
          const newStock = row.stock ?? existing.stock;
          await sparepartService.update(existing.id, {
            name: row.name,
            category: row.category ?? existing.category,
            stock: newStock,
            min_stock: row.min_stock ?? existing.min_stock,
            buy_price: row.buy_price ?? existing.buy_price,
            sell_price: row.sell_price ?? existing.sell_price,
            supplier: row.supplier ?? existing.supplier,
            barcode: row.barcode ?? existing.barcode,
            brand: row.brand ?? existing.brand,
            rack_name: row.rack_name ?? existing.rack_name,
            rack_row: row.rack_row ?? existing.rack_row,
          });
          const delta = newStock - existing.stock;
          if (delta !== 0) {
            await stockHistoryService.record(existing.id, row.name, delta, newStock, 'Import CSV', 'adjustment');
          }
          updated++;
        } else {
          const initStock = row.stock ?? 0;
          const sp = await sparepartService.create({
            name: row.name,
            category: row.category ?? 'Lainnya',
            stock: initStock,
            min_stock: row.min_stock ?? 5,
            buy_price: row.buy_price ?? 0,
            sell_price: row.sell_price ?? 0,
            supplier: row.supplier ?? '',
            barcode: row.barcode ?? '',
            brand: row.brand ?? '',
            rack_name: row.rack_name ?? '',
            rack_row: row.rack_row ?? '',
          });
          if (initStock > 0) {
            await stockHistoryService.record(sp.id, sp.name, initStock, initStock, 'Import CSV', 'manual');
          }
          created++;
        }
      } catch (e: any) {
        errors.push({ row: row.rowNumber, message: e?.message ?? 'Gagal menyimpan' });
      }
    }

    return { created, updated, errors };
  },
};
