import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { useTheme } from '../src/contexts/ThemeContext';
import { IMPORT_COLUMN_HELP, ParsedSparepartRow, sparepartImportService } from '../src/services/sparepartImportService';
import { useAppStore } from '../src/store/useAppStore';
import { formatCurrency } from '../src/utils/currency';

export default function SparepartImportScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const showToast = useAppStore((s) => s.showToast);

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedSparepartRow[]>([]);
  const [unrecognizedHeaders, setUnrecognizedHeaders] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; errors: { row: number; message: string }[] } | null>(null);

  const validRows = rows.filter((r) => r.valid);
  const invalidRows = rows.filter((r) => !r.valid);

  const pickFile = async () => {
    setPicking(true);
    setResult(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', '*/*'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      const content = asset.file
        ? await asset.file.text()
        : await FileSystem.readAsStringAsync(asset.uri);
      const { rows: parsedRows, unrecognizedHeaders: unrec } = sparepartImportService.parse(content);
      setFileName(asset.name ?? 'file.csv');
      setRows(parsedRows);
      setUnrecognizedHeaders(unrec);
      if (parsedRows.length === 0) {
        showToast('File CSV tidak berisi data', 'error');
      }
    } catch (e: any) {
      showToast('Gagal membaca file: ' + (e?.message ?? ''), 'error');
    } finally {
      setPicking(false);
    }
  };

  const doImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const r = await sparepartImportService.importRows(validRows);
      setResult(r);
      showToast(`Import selesai: ${r.created} baru, ${r.updated} diperbarui`, 'success');
    } catch (e: any) {
      showToast('Gagal import: ' + (e?.message ?? ''), 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title="Import Sparepart (CSV)" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card style={{ marginBottom: 14 }}>
          <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 14, marginBottom: 8 }}>
            Format Kolom CSV
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 8, lineHeight: 18 }}>
            Baris pertama harus berisi nama kolom (header). Kolom yang dikenali:
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {IMPORT_COLUMN_HELP.map((c) => (
              <View
                key={c.field}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: theme.radius.md,
                  backgroundColor: c.required ? theme.colors.accent + '20' : theme.colors.cardLight,
                  borderWidth: 1,
                  borderColor: c.required ? theme.colors.accent : theme.colors.border,
                }}
              >
                <Text style={{ color: c.required ? theme.colors.accent : theme.colors.textSecondary, fontSize: 11, fontWeight: c.required ? '700' : '500' }}>
                  {c.label}{c.required ? ' *' : ''}
                </Text>
              </View>
            ))}
          </View>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 8 }}>
            * wajib diisi. Sparepart yang nama-nya sudah ada akan diperbarui, yang belum ada akan ditambahkan.
          </Text>
        </Card>

        <Button
          title={fileName ? `Ganti File (${fileName})` : 'Pilih File CSV'}
          onPress={pickFile}
          loading={picking}
          fullWidth
          icon={<Ionicons name="document-attach-outline" size={18} color="#fff" />}
        />

        {rows.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 12 }}>
              <View style={{ flex: 1, backgroundColor: theme.colors.success + '18', borderRadius: theme.radius.md, padding: 10, alignItems: 'center' }}>
                <Text style={{ color: theme.colors.success, fontWeight: '800', fontSize: 18 }}>{validRows.length}</Text>
                <Text style={{ color: theme.colors.success, fontSize: 11 }}>Baris Valid</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: theme.colors.danger + '18', borderRadius: theme.radius.md, padding: 10, alignItems: 'center' }}>
                <Text style={{ color: theme.colors.danger, fontWeight: '800', fontSize: 18 }}>{invalidRows.length}</Text>
                <Text style={{ color: theme.colors.danger, fontSize: 11 }}>Baris Error</Text>
              </View>
            </View>

            {unrecognizedHeaders.length > 0 && (
              <Text style={{ color: theme.colors.warning, fontSize: 11, marginBottom: 10 }}>
                Kolom tidak dikenali (diabaikan): {unrecognizedHeaders.join(', ')}
              </Text>
            )}

            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>
              PRATINJAU ({rows.length} baris)
            </Text>
            <FlatList
              data={rows}
              keyExtractor={(item) => String(item.rowNumber)}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    padding: 10,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.card,
                    borderWidth: 1,
                    borderColor: item.valid ? theme.colors.border : theme.colors.danger + '60',
                    gap: 10,
                  }}
                >
                  <Ionicons
                    name={item.valid ? 'checkmark-circle' : 'alert-circle'}
                    size={18}
                    color={item.valid ? theme.colors.success : theme.colors.danger}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
                      Baris {item.rowNumber}: {item.name || '(tanpa nama)'}
                    </Text>
                    {item.valid ? (
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>
                        Stok: {item.stock ?? '-'} • Jual: {item.sell_price ? formatCurrency(item.sell_price) : '-'} • Beli: {item.buy_price ? formatCurrency(item.buy_price) : '-'}
                      </Text>
                    ) : (
                      <Text style={{ color: theme.colors.danger, fontSize: 11, marginTop: 2 }}>
                        {item.errors.join(', ')}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            />

            <Button
              title={`Import ${validRows.length} Sparepart`}
              onPress={doImport}
              loading={importing}
              disabled={validRows.length === 0}
              fullWidth
              size="lg"
              style={{ marginTop: 16 }}
              icon={<Ionicons name="cloud-upload" size={18} color="#fff" />}
            />
          </>
        )}

        {result && (
          <Card style={{ marginTop: 16 }}>
            <Text style={{ color: theme.colors.text, fontWeight: '700', marginBottom: 6 }}>Hasil Import</Text>
            <Text style={{ color: theme.colors.success, fontSize: 13 }}>{result.created} sparepart baru ditambahkan</Text>
            <Text style={{ color: theme.colors.info, fontSize: 13 }}>{result.updated} sparepart diperbarui</Text>
            {result.errors.length > 0 && (
              <Text style={{ color: theme.colors.danger, fontSize: 13, marginTop: 4 }}>
                {result.errors.length} baris gagal disimpan
              </Text>
            )}
            <Button
              title="Selesai"
              variant="ghost"
              fullWidth
              onPress={() => router.back()}
              style={{ marginTop: 10 }}
            />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
