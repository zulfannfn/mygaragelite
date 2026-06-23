import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { useTheme } from '../src/contexts/ThemeContext';
import { purchaseOrderService } from '../src/services/purchaseOrderService';
import { useAppStore } from '../src/store/useAppStore';
import { PurchaseOrder } from '../src/types';

export default function PurchaseOrderReceiveScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const showToast = useAppStore((s) => s.showToast);

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await purchaseOrderService.getById(id);
    setPo(data);
    if (data?.items) {
      const init: Record<string, string> = {};
      for (const item of data.items) {
        init[item.id] = String(item.qty_received > 0 ? item.qty_received : item.qty_ordered);
      }
      setQty(init);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (!po) return;
    setSaving(true);
    try {
      await purchaseOrderService.markReceived(
        po.id,
        Object.entries(qty).map(([itemId, v]) => ({ itemId, qty_received: parseInt(v, 10) || 0 }))
      );
      showToast('PO ditandai diterima', 'success');
      router.back();
    } catch (e: any) {
      showToast('Gagal: ' + (e?.message ?? ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!po) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ScreenHeader title="Qty Diterima" showBack />
        <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 }}>Memuat...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title="Qty Diterima" showBack />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
          Masukkan jumlah item yang benar-benar diterima dari supplier.
        </Text>
        {(po.items ?? []).map((item) => (
          <View
            key={item.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: 12,
            }}
          >
            <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600', flex: 1 }} numberOfLines={2}>
              {item.sparepart_name}
            </Text>
            <TextInput
              value={qty[item.id] ?? ''}
              onChangeText={(v) => setQty((prev) => ({ ...prev, [item.id]: v.replace(/[^0-9]/g, '') }))}
              keyboardType="numeric"
              style={{
                width: 80,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.md,
                paddingHorizontal: 10,
                paddingVertical: 8,
                color: theme.colors.text,
                textAlign: 'center',
                backgroundColor: theme.colors.cardLight,
              }}
            />
          </View>
        ))}

        <Button title="Simpan" size="lg" fullWidth loading={saving} onPress={save} />
      </ScrollView>
    </View>
  );
}
