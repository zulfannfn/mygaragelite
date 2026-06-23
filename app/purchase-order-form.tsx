import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/ui/Button';
import { Input } from '../src/components/ui/Input';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { SearchBar } from '../src/components/ui/SearchBar';
import { useTheme } from '../src/contexts/ThemeContext';
import { purchaseOrderService } from '../src/services/purchaseOrderService';
import { sparepartService } from '../src/services/sparepartService';
import { useAppStore } from '../src/store/useAppStore';
import { Sparepart } from '../src/types';

interface POLine {
  sparepart_id: string;
  sparepart_name: string;
  sparepart_brand: string;
  qty_ordered: string;
  buy_price: string;
}

export default function PurchaseOrderFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const showToast = useAppStore((s) => s.showToast);

  const [poNumber, setPoNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<POLine[]>([]);
  const [saving, setSaving] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerResults, setPickerResults] = useState<Sparepart[]>([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');

  const loadResults = async (q: string) => {
    setPickerSearch(q);
    const data = await sparepartService.getAll(q, 30, 0);
    setPickerResults(data);
  };

  const openPicker = () => {
    setPickerSearch('');
    setShowCustomForm(false);
    setCustomName('');
    loadResults('');
    setPickerOpen(true);
  };

  const addLine = (sp: Sparepart) => {
    setLines((prev) => {
      if (prev.some((l) => l.sparepart_id === sp.id)) return prev;
      return [
        ...prev,
        {
          sparepart_id: sp.id,
          sparepart_name: sp.name,
          sparepart_brand: sp.brand ?? '',
          qty_ordered: '1',
          buy_price: String(sp.buy_price || 0),
        },
      ];
    });
    setPickerOpen(false);
  };

  const createAndAddSparepart = async () => {
    if (!customName.trim()) return;
    const created = await sparepartService.create({ name: customName.trim(), category: 'Lainnya' });
    addLine(created);
    setCustomName('');
    setShowCustomForm(false);
  };

  const removeLine = (sparepartId: string) => {
    setLines((prev) => prev.filter((l) => l.sparepart_id !== sparepartId));
  };

  const updateLine = (sparepartId: string, value: string) => {
    const clean = value.replace(/[^0-9]/g, '');
    setLines((prev) => prev.map((l) => (l.sparepart_id === sparepartId ? { ...l, qty_ordered: clean } : l)));
  };

  const canSave = lines.length > 0 && lines.every((l) => (parseInt(l.qty_ordered, 10) || 0) > 0);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await purchaseOrderService.create({
        po_number: poNumber.trim(),
        supplier: supplier.trim(),
        notes: notes.trim(),
        items: lines.map((l) => ({
          sparepart_id: l.sparepart_id,
          sparepart_name: l.sparepart_name,
          qty_ordered: parseInt(l.qty_ordered, 10) || 0,
          buy_price: parseInt(l.buy_price, 10) || 0,
        })),
      });
      showToast('Purchase Order dibuat', 'success');
      router.back();
    } catch (e: any) {
      showToast('Gagal menyimpan: ' + (e?.message ?? ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title="Buat Purchase Order" showBack />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Input label="No. PO (opsional)" value={poNumber} onChangeText={setPoNumber} placeholder="Cth: PO-001" />
        <Input label="Supplier" value={supplier} onChangeText={setSupplier} placeholder="Nama supplier (opsional)" />
        <Input
          label="Catatan"
          value={notes}
          onChangeText={setNotes}
          placeholder="Catatan (opsional)"
          multiline
          numberOfLines={2}
          style={{ minHeight: 60, textAlignVertical: 'top' }}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>Item Sparepart</Text>
          <Pressable
            onPress={openPicker}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.accent + '15',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="add-circle" size={16} color={theme.colors.accent} />
            <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '700' }}>Tambah Item</Text>
          </Pressable>
        </View>

        {lines.length === 0 ? (
          <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 16 }}>
            Belum ada item ditambahkan
          </Text>
        ) : (
          lines.map((line) => (
            <View
              key={line.sparepart_id}
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: 12,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                    {line.sparepart_name}
                  </Text>
                  {line.sparepart_brand ? (
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      Merk: {line.sparepart_brand}
                    </Text>
                  ) : null}
                </View>
                <Pressable onPress={() => removeLine(line.sparepart_id)} hitSlop={8}>
                  <Ionicons name="trash" size={16} color={theme.colors.danger} />
                </Pressable>
              </View>
              <View>
                <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginBottom: 4 }}>Qty Pesan</Text>
                <TextInput
                  value={line.qty_ordered}
                  onChangeText={(v) => updateLine(line.sparepart_id, v)}
                  keyboardType="numeric"
                  style={{
                    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
                    paddingHorizontal: 10, paddingVertical: 8, color: theme.colors.text, backgroundColor: theme.colors.surface,
                  }}
                />
              </View>
            </View>
          ))
        )}

        <Button title="Simpan PO" size="lg" fullWidth onPress={save} loading={saving} disabled={!canSave} />
      </ScrollView>

      {/* Sparepart Picker */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable
          onPress={() => setPickerOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              paddingTop: 8,
              paddingBottom: Math.max(28, insets.bottom + 16),
              height: '85%',
            }}
          >
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.borderLight, alignSelf: 'center', marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <SearchBar value={pickerSearch} onChangeText={loadResults} placeholder="Cari sparepart..." containerStyle={{ marginHorizontal: 0, marginBottom: 0 }} />
              </View>
              <Pressable
                onPress={() => setShowCustomForm(!showCustomForm)}
                style={({ pressed }) => ({
                  width: 48, height: 48, borderRadius: theme.radius.md,
                  backgroundColor: showCustomForm ? theme.colors.accent : theme.colors.card,
                  borderWidth: 1, borderColor: showCustomForm ? theme.colors.accent : theme.colors.border,
                  alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="add" size={20} color={showCustomForm ? '#fff' : theme.colors.textSecondary} />
              </Pressable>
            </View>

            {showCustomForm && (
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Input value={customName} onChangeText={setCustomName} placeholder="Nama sparepart baru" containerStyle={{ marginBottom: 0 }} />
                </View>
                <Button title="Tambah" onPress={createAndAddSparepart} disabled={!customName.trim()} />
              </View>
            )}

            <FlatList
              data={pickerResults}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => addLine(item)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: theme.radius.lg,
                    backgroundColor: pressed ? theme.colors.cardLight : theme.colors.card,
                    borderWidth: 1, borderColor: theme.colors.border,
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      Stok: {item.stock} • {item.category}{item.brand ? ` • ${item.brand}` : ''}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
