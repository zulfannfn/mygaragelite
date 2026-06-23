import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdBanner } from '../src/components/ui/AdBanner';
import { Button } from '../src/components/ui/Button';
import { Input } from '../src/components/ui/Input';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { useTheme } from '../src/contexts/ThemeContext';
import { purchaseOrderService } from '../src/services/purchaseOrderService';
import { sparepartService } from '../src/services/sparepartService';
import { stockHistoryService } from '../src/services/stockHistoryService';
import { PendingPOItemForSparepart, Sparepart, StockHistory } from '../src/types';
import { formatCurrency } from '../src/utils/currency';

const REASONS = ['Restock / Pembelian', 'Koreksi Stok', 'Retur', 'Lainnya'];

export default function SparepartHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [sparepart, setSparepart] = useState<Sparepart | null>(null);
  const [history, setHistory] = useState<StockHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'add' | 'reduce'>('add');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState(REASONS[0]);
  const [adjustCustomReason, setAdjustCustomReason] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [newBuyPrice, setNewBuyPrice] = useState('');
  const [newSellPrice, setNewSellPrice] = useState('');
  const [pendingPOItems, setPendingPOItems] = useState<PendingPOItemForSparepart[]>([]);
  const [selectedPOItem, setSelectedPOItem] = useState<PendingPOItemForSparepart | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [sp, hist, pending] = await Promise.all([
      sparepartService.getById(id),
      stockHistoryService.getBySparepart(id),
      purchaseOrderService.getPendingForSparepart(id),
    ]);
    setSparepart(sp);
    setHistory(hist);
    setPendingPOItems(pending);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdjust = (type: 'add' | 'reduce') => {
    setAdjustType(type);
    setAdjustQty('');
    setAdjustReason(REASONS[0]);
    setAdjustCustomReason('');
    setNewBuyPrice(sparepart ? String(sparepart.buy_price) : '');
    setNewSellPrice(sparepart ? String(sparepart.sell_price) : '');
    setSelectedPOItem(null);
    setAdjustModalOpen(true);
  };

  const usePendingPOItem = (poItem: PendingPOItemForSparepart) => {
    setSelectedPOItem(poItem);
    setAdjustQty(String(poItem.qty_pending));
    setAdjustReason(REASONS[0]);
    if (poItem.buy_price > 0) setNewBuyPrice(String(poItem.buy_price));
  };

  const saveAdjust = async () => {
    if (!sparepart) return;
    const qty = parseInt(adjustQty || '0', 10);
    if (qty <= 0) {
      Alert.alert('Peringatan', 'Jumlah harus lebih dari 0');
      return;
    }
    const delta = adjustType === 'add' ? qty : -qty;
    const stockAfter = Math.max(0, sparepart.stock + delta);
    let reason = adjustReason === 'Lainnya' ? (adjustCustomReason.trim() || 'Lainnya') : adjustReason;
    if (selectedPOItem) {
      reason = `${reason} (PO-${selectedPOItem.po_number || selectedPOItem.po_id.slice(0, 6).toUpperCase()})`;
    }

    const buyPriceNum = parseInt(newBuyPrice || '0', 10) || 0;
    const sellPriceNum = parseInt(newSellPrice || '0', 10) || 0;
    const priceChanged =
      adjustType === 'add' &&
      (buyPriceNum !== sparepart.buy_price || sellPriceNum !== sparepart.sell_price) &&
      sellPriceNum > 0;

    setAdjustSaving(true);
    try {
      await sparepartService.adjustStock(sparepart.id, delta);
      if (priceChanged) {
        await sparepartService.updatePrices(sparepart.id, buyPriceNum, sellPriceNum);
      }
      await stockHistoryService.record(
        sparepart.id,
        sparepart.name,
        delta,
        stockAfter,
        reason,
        'manual',
        priceChanged ? buyPriceNum : null,
        priceChanged ? sellPriceNum : null,
      );
      if (selectedPOItem && adjustType === 'add') {
        await purchaseOrderService.applyStock(selectedPOItem.po_item_id, qty);
      }
      setAdjustModalOpen(false);
      setSelectedPOItem(null);
      await load();
    } catch {
      Alert.alert('Gagal', 'Tidak dapat menyimpan perubahan stok');
    } finally {
      setAdjustSaving(false);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const sourceLabel = (s: StockHistory['source']) => {
    if (s === 'transaction') return 'Transaksi';
    if (s === 'adjustment') return 'Koreksi';
    return 'Manual';
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader
        title="Riwayat Stok"
        showBack
        rightElement={
          <Pressable
            onPress={() => router.push({ pathname: '/sparepart-form', params: { id } })}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: theme.radius.md,
              backgroundColor: pressed ? theme.colors.cardLight : theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            })}
          >
            <Ionicons name="create-outline" size={16} color={theme.colors.accent} />
            <Text style={{ color: theme.colors.accent, fontSize: 13, fontWeight: '700' }}>Edit</Text>
          </Pressable>
        }
      />

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: Math.max(100, insets.bottom + 100),
          gap: 10,
        }}
        ListFooterComponent={() => <View style={{ marginTop: 8 }}><AdBanner /></View>}
        ListHeaderComponent={
          <>
            {/* Sparepart Info Card */}
            {sparepart && (
              <View
                style={{
                  backgroundColor: theme.colors.card,
                  borderRadius: theme.radius.xl,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  marginBottom: 8,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      backgroundColor: theme.colors.accent + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="cube" size={26} color={theme.colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '800' }} numberOfLines={2}>
                      {sparepart.name}
                    </Text>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      {sparepart.category}{sparepart.brand ? ` • ${sparepart.brand}` : ''}
                    </Text>
                    {(sparepart.rack_name || sparepart.rack_row) ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Ionicons name="albums-outline" size={12} color={theme.colors.textMuted} />
                        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                          {[sparepart.rack_name && `Rak ${sparepart.rack_name}`, sparepart.rack_row && `Baris ${sparepart.rack_row}`].filter(Boolean).join(' • ')}
                        </Text>
                      </View>
                    ) : null}
                    {sparepart.barcode ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Ionicons name="barcode-outline" size={12} color={theme.colors.textMuted} />
                        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                          {sparepart.barcode}
                        </Text>
                      </View>
                    ) : null}
                    {sparepart.supplier ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Ionicons name="business-outline" size={12} color={theme.colors.textMuted} />
                        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }} numberOfLines={1}>
                          {sparepart.supplier}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {sparepart.buy_price > 0 && (() => {
                    const marginPct = Math.round((sparepart.sell_price - sparepart.buy_price) / sparepart.sell_price * 100);
                    const nominalMargin = sparepart.sell_price - sparepart.buy_price;
                    const color = marginPct >= 20 ? theme.colors.success : marginPct >= 10 ? theme.colors.warning : theme.colors.danger;
                    return (
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <View style={{ backgroundColor: color + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                          <Text style={{ color, fontSize: 14, fontWeight: '800' }}>{marginPct}%</Text>
                        </View>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                          +{formatCurrency(nominalMargin)}
                        </Text>
                      </View>
                    );
                  })()}
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: theme.colors.cardLight,
                      borderRadius: theme.radius.lg,
                      padding: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: '700' }}>STOK</Text>
                    <Text
                      style={{
                        color: sparepart.stock <= 0
                          ? theme.colors.danger
                          : sparepart.stock <= sparepart.min_stock
                            ? theme.colors.warning
                            : theme.colors.success,
                        fontSize: 22,
                        fontWeight: '800',
                        marginTop: 2,
                      }}
                    >
                      {sparepart.stock}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>min {sparepart.min_stock}</Text>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: theme.colors.cardLight,
                      borderRadius: theme.radius.lg,
                      padding: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: '700' }}>HARGA JUAL</Text>
                    <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '800', marginTop: 4 }}>
                      {formatCurrency(sparepart.sell_price)}
                    </Text>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: theme.colors.cardLight,
                      borderRadius: theme.radius.lg,
                      padding: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: '700' }}>HARGA BELI</Text>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 4 }}>
                      {formatCurrency(sparepart.buy_price)}
                    </Text>
                  </View>
                </View>

                {/* Adjust stock buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <Pressable
                    onPress={() => openAdjust('add')}
                    style={({ pressed }) => ({
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 12,
                      borderRadius: theme.radius.lg,
                      backgroundColor: theme.colors.success + '20',
                      borderWidth: 1,
                      borderColor: theme.colors.success,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Ionicons name="add-circle" size={18} color={theme.colors.success} />
                    <Text style={{ color: theme.colors.success, fontWeight: '700', fontSize: 13 }}>Tambah Stok</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openAdjust('reduce')}
                    style={({ pressed }) => ({
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 12,
                      borderRadius: theme.radius.lg,
                      backgroundColor: theme.colors.danger + '20',
                      borderWidth: 1,
                      borderColor: theme.colors.danger,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Ionicons name="remove-circle" size={18} color={theme.colors.danger} />
                    <Text style={{ color: theme.colors.danger, fontWeight: '700', fontSize: 13 }}>Kurangi Stok</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>
              RIWAYAT PERUBAHAN
            </Text>
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Ionicons name="time-outline" size={40} color={theme.colors.textMuted} />
              <Text style={{ color: theme.colors.textMuted, marginTop: 10, fontSize: 14 }}>
                Belum ada riwayat perubahan stok
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isAdd = item.delta > 0;
          const stockBefore = item.stock_after - item.delta;
          const deltaColor = isAdd ? theme.colors.success : theme.colors.danger;
          return (
            <View
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: theme.radius.lg,
                padding: 14,
                borderWidth: 1,
                borderColor: theme.colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: deltaColor + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={isAdd ? 'arrow-up' : 'arrow-down'}
                  size={18}
                  color={deltaColor}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  {/* stock sebelum → +/-delta */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
                      {stockBefore}
                    </Text>
                    <Ionicons name="arrow-forward" size={12} color={theme.colors.textMuted} />
                    <Text style={{ color: deltaColor, fontSize: 16, fontWeight: '800' }}>
                      {isAdd ? '+' : ''}{item.delta}
                    </Text>
                  </View>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                    Sisa: <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{item.stock_after}</Text>
                  </Text>
                </View>
                <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 2 }}>
                  {item.reason || sourceLabel(item.source)} • {formatDate(item.created_at)}
                </Text>
                {(item.buy_price_after != null || item.sell_price_after != null) ? (
                  <Text style={{ color: theme.colors.accent, fontSize: 11, marginTop: 2, fontWeight: '600' }}>
                    Harga diperbarui: Beli {formatCurrency(item.buy_price_after ?? 0)} / Jual {formatCurrency(item.sell_price_after ?? 0)}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      {/* Adjust Stock Modal */}
      <Modal
        visible={adjustModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAdjustModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Backdrop */}
          <Pressable
            onPress={() => setAdjustModalOpen(false)}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
          />

          {/* Sheet content */}
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
            }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              contentContainerStyle={{
                padding: 20,
                paddingBottom: Math.max(28, insets.bottom + 20),
              }}
            >
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.borderLight, alignSelf: 'center', marginBottom: 16 }} />

              <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800', marginBottom: 16 }}>
                {adjustType === 'add' ? 'Tambah Stok' : 'Kurangi Stok'}
              </Text>

              {sparepart && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Stok saat ini</Text>
                  <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '700' }}>{sparepart.stock}</Text>
                </View>
              )}

              {adjustType === 'add' && pendingPOItems.length > 0 && (
                <View
                  style={{
                    backgroundColor: theme.colors.info + '15',
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: theme.colors.info,
                    padding: 12,
                    marginBottom: 16,
                    gap: 8,
                  }}
                >
                  {pendingPOItems.map((poItem) => {
                    const active = selectedPOItem?.po_item_id === poItem.po_item_id;
                    return (
                      <View key={poItem.po_item_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="cube-outline" size={16} color={theme.colors.info} />
                        <Text style={{ color: theme.colors.text, fontSize: 12, flex: 1 }}>
                          PO-{poItem.po_number || poItem.po_id.slice(0, 6).toUpperCase()} menunggu distok:{' '}
                          <Text style={{ fontWeight: '700' }}>{poItem.qty_pending} pcs</Text>
                          {poItem.buy_price > 0 ? ` @ ${formatCurrency(poItem.buy_price)}` : ''}
                        </Text>
                        <Pressable
                          onPress={() => usePendingPOItem(poItem)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: theme.radius.md,
                            backgroundColor: active ? theme.colors.info : theme.colors.info + '25',
                          }}
                        >
                          <Text style={{ color: active ? '#fff' : theme.colors.info, fontSize: 12, fontWeight: '700' }}>
                            {active ? 'Dipilih' : 'Gunakan'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}

              <Input
                label="Jumlah"
                value={adjustQty}
                onChangeText={(v) => setAdjustQty(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="0"
                autoFocus
              />

              <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>
                KETERANGAN
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {REASONS.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setAdjustReason(r)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: theme.radius.md,
                      backgroundColor: adjustReason === r ? theme.colors.accent + '20' : theme.colors.card,
                      borderWidth: 1,
                      borderColor: adjustReason === r ? theme.colors.accent : theme.colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: adjustReason === r ? theme.colors.accent : theme.colors.textSecondary,
                        fontSize: 12,
                        fontWeight: '600',
                      }}
                    >
                      {r}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {adjustReason === 'Lainnya' && (
                <Input
                  value={adjustCustomReason}
                  onChangeText={setAdjustCustomReason}
                  placeholder="Tulis keterangan..."
                  containerStyle={{ marginBottom: 12 }}
                />
              )}

              {adjustType === 'add' && (
                <>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>
                    UPDATE HARGA (OPSIONAL)
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="Harga Beli Baru"
                        value={newBuyPrice}
                        onChangeText={(v) => setNewBuyPrice(v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="Harga Jual Baru"
                        value={newSellPrice}
                        onChangeText={(v) => setNewSellPrice(v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                    </View>
                  </View>
                </>
              )}

              {sparepart && adjustQty ? (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    backgroundColor: theme.colors.cardLight,
                    borderRadius: theme.radius.md,
                    padding: 12,
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Stok setelah</Text>
                  <Text
                    style={{
                      color: adjustType === 'add' ? theme.colors.success : theme.colors.danger,
                      fontSize: 15,
                      fontWeight: '800',
                    }}
                  >
                    {Math.max(0, sparepart.stock + (adjustType === 'add' ? 1 : -1) * (parseInt(adjustQty) || 0))}
                  </Text>
                </View>
              ) : null}

              <Button
                title={adjustType === 'add' ? 'Tambah Stok' : 'Kurangi Stok'}
                fullWidth
                size="lg"
                loading={adjustSaving}
                disabled={!adjustQty || parseInt(adjustQty) <= 0}
                onPress={saveAdjust}
                icon={
                  <Ionicons
                    name={adjustType === 'add' ? 'add-circle' : 'remove-circle'}
                    size={20}
                    color="#fff"
                  />
                }
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
