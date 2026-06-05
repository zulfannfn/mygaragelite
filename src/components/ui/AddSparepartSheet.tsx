import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { sparepartService } from '../../services/sparepartService';
import { Sparepart } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Input } from './Input';
import { SearchBar } from './SearchBar';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (sp: Sparepart, qty: number) => void;
}

const PAGE_SIZE = 20;

export function AddSparepartSheet({ visible, onClose, onPick }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Sparepart[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Sparepart | null>(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Custom Form states
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customBuyPrice, setCustomBuyPrice] = useState('');
  const [customSellPrice, setCustomSellPrice] = useState('');
  const [customStock, setCustomStock] = useState('1');
  const [customMinStock, setCustomMinStock] = useState('0');
  const [customCategory, setCustomCategory] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const loadSpareparts = useCallback(async (offset = 0) => {
    if (offset === 0) {
      setLoading(true);
      setItems([]);
    }
    try {
      const data = await sparepartService.getAll(search, PAGE_SIZE, offset);
      if (offset === 0) {
        setItems(data);
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setItems((prev) => [...prev, ...data]);
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (error) {
      console.error('Error loading spareparts:', error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (visible) {
      loadSpareparts(0);
    } else {
      setSelected(null);
      setSearch('');
      setQty(1);
      setItems([]);
      setHasMore(true);
    }
  }, [visible, loadSpareparts]);

  const handleEndReached = () => {
    if (!loading && hasMore) {
      loadSpareparts(items.length);
    }
  };

  const filtered = useMemo(
    () =>
      items.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase().trim())
      ),
    [items, search]
  );

  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(items.map((s) => s.category))];
    return uniqueCategories.sort();
  }, [items]);

  const submit = () => {
    if (!selected) return;
    onPick(selected, Math.max(1, qty));
    setSelected(null);
    setQty(1);
    setSearch('');
  };

  const submitCustom = async () => {
    if (!customName.trim() || !customBuyPrice.trim() || !customSellPrice.trim() || !customStock.trim()) {
      Alert.alert('Peringatan', 'Mohon lengkapi semua data');
      return;
    }
    try {
      const stockVal = Math.max(0, parseInt(customStock) || 0);
      const minStockVal = Math.max(0, parseInt(customMinStock) || 0);
      const newSp = await sparepartService.create({
        name: customName.trim(),
        category: customCategory.trim() || 'Umum',
        buy_price: Number(customBuyPrice.replace(/[^0-9]/g, '')) || 0,
        sell_price: Number(customSellPrice.replace(/[^0-9]/g, '')) || 0,
        stock: stockVal,
        min_stock: minStockVal,
      });
      // Simulate selection to add right away
      onPick(newSp, 1);
      setShowCustomForm(false);
      setCustomName('');
      setCustomBuyPrice('');
      setCustomSellPrice('');
      setCustomStock('1');
      setCustomMinStock('0');
      setCustomCategory('');
      setSearch('');
    } catch (e) {
      console.error('Error create custom sparepart', e);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            paddingTop: 8,
            paddingBottom: Math.max(28, insets.bottom + 16),
            height: '90%',
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.colors.borderLight,
              alignSelf: 'center',
              marginBottom: 12,
            }}
          />

          <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
            <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
              Pilih Sparepart
            </Text>
          </View>

          {!selected ? (
            <>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <SearchBar 
                    value={search} 
                    onChangeText={setSearch} 
                    placeholder="Cari sparepart..." 
                    containerStyle={{ marginHorizontal: 0, marginBottom: 0 }} 
                  />
                </View>
                <Pressable
                  onPress={() => setShowCustomForm(!showCustomForm)}
                  style={({ pressed }) => ({
                    width: 48,
                    height: 48,
                    borderRadius: theme.radius.md,
                    backgroundColor: showCustomForm ? theme.colors.accent : theme.colors.card,
                    borderWidth: 1,
                    borderColor: showCustomForm ? theme.colors.accent : theme.colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Ionicons
                    name="add"
                    size={20}
                    color={showCustomForm ? '#fff' : theme.colors.textSecondary}
                  />
                </Pressable>
              </View>

              {showCustomForm && (
                <View
                  style={{
                    padding: 14,
                    backgroundColor: theme.colors.card,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    marginHorizontal: 16,
                    marginBottom: 12,
                  }}
                >
                  <Input
                    value={customName}
                    onChangeText={setCustomName}
                    placeholder="Nama Sparepart"
                  />
                  <Pressable
                    onPress={() => setShowCategoryPicker(true)}
                    style={{
                      backgroundColor: theme.colors.background,
                      borderRadius: theme.radius.md,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      marginBottom: 12,
                    }}
                  >
                    <Text style={{ color: customCategory ? theme.colors.text : theme.colors.textSecondary }}>
                      {customCategory || 'Pilih Kategori Sparepart'}
                    </Text>
                  </Pressable>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        value={customBuyPrice}
                        onChangeText={setCustomBuyPrice}
                        placeholder="Harga Beli (Rp)"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        value={customSellPrice}
                        onChangeText={setCustomSellPrice}
                        placeholder="Harga Jual (Rp)"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        value={customStock}
                        onChangeText={setCustomStock}
                        placeholder="Stok"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        value={customMinStock}
                        onChangeText={setCustomMinStock}
                        placeholder="Minimum Stok"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <Button
                    title="Tambah Sparepart Baru"
                    fullWidth
                    onPress={submitCustom}
                    disabled={!customName.trim() || !customBuyPrice.trim() || !customSellPrice.trim() || !customStock.trim()}
                    icon={<Ionicons name="add-circle" size={18} color="#fff" />}
                  />
                </View>
              )}

              <FlatList
                data={filtered}
                keyExtractor={(it) => it.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loading && items.length > 0 ? () => (
                  <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12 }}>
                    Memuat...
                  </Text>
                ) : undefined}
                ListEmptyComponent={
                  loading ? (
                    <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12 }}>
                      Memuat...
                    </Text>
                  ) : (
                    <EmptyState
                      icon="cube-outline"
                      title="Tidak ditemukan"
                      description="Coba kata kunci lain"
                    />
                  )
                }
                renderItem={({ item }) => {
                  const isOut = item.stock <= 0;
                  return (
                    <View
                      style={{
                        width: '100%',
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        padding: 14,
                        borderRadius: theme.radius.lg,
                        backgroundColor: theme.colors.card,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        opacity: isOut ? 0.5 : 1,
                      }}
                    >
                      <Pressable
                        onPress={() => !isOut && setSelected(item)}
                        disabled={isOut}
                        style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1 }}
                      >
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            backgroundColor: isOut ? theme.colors.borderLight : theme.colors.warning + '15',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                          }}
                        >
                          <Ionicons name="cube" size={20} color={isOut ? theme.colors.textMuted : theme.colors.warning} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: theme.colors.text,
                              fontSize: 15,
                              fontWeight: '600',
                            }}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          <Text
                            style={{
                              color: isOut ? theme.colors.danger : theme.colors.textSecondary,
                              fontSize: 12,
                              marginTop: 4,
                            }}
                          >
                            {isOut ? 'STOK HABIS' : `Stok: ${item.stock}`} • {item.category}
                          </Text>
                        </View>
                      </Pressable>
                      <Text
                        style={{
                          color: theme.colors.accent,
                          fontSize: 15,
                          fontWeight: '700',
                          marginLeft: 8,
                          flexShrink: 0,
                        }}
                      >
                        {formatCurrency(item.sell_price)}
                      </Text>
                    </View>
                  );
                }}
              />
            </>
          ) : (
            // Quantity step
            <View style={{ flex: 1, paddingHorizontal: 20 }}>
              <View
                style={{
                  padding: 16,
                  backgroundColor: theme.colors.card,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 16,
                    fontWeight: '700',
                  }}
                >
                  {selected.name}
                </Text>
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  Stok tersisa: {selected.stock} • Harga: {formatCurrency(selected.sell_price)}
                </Text>
              </View>

              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: 13,
                  fontWeight: '600',
                  marginBottom: 8,
                }}
              >
                Jumlah
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 20,
                  paddingVertical: 16,
                  backgroundColor: theme.colors.card,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Pressable
                  onPress={() => setQty((q) => Math.max(1, q - 1))}
                  style={({ pressed }) => ({
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    backgroundColor: theme.colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Ionicons name="remove" size={26} color="#fff" />
                </Pressable>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 32,
                    fontWeight: '800',
                    minWidth: 60,
                    textAlign: 'center',
                  }}
                >
                  {qty}
                </Text>
                <Pressable
                  onPress={() =>
                    setQty((q) => (selected.stock > 0 ? Math.min(selected.stock, q + 1) : q + 1))
                  }
                  style={({ pressed }) => ({
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    backgroundColor: theme.colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Ionicons name="add" size={26} color="#fff" />
                </Pressable>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: 16,
                }}
              >
                <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>
                  Subtotal
                </Text>
                <Text
                  style={{
                    color: theme.colors.accent,
                    fontSize: 18,
                    fontWeight: '800',
                  }}
                >
                  {formatCurrency(selected.sell_price * qty)}
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 20 }}>
                <Button
                  title="Tambahkan ke Transaksi"
                  size="lg"
                  fullWidth
                  onPress={submit}
                  icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />}
                />
                <Button
                  title="Pilih Sparepart Lain"
                  variant="ghost"
                  fullWidth
                  onPress={() => setSelected(null)}
                />
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <Pressable
          onPress={() => setShowCategoryPicker(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              paddingTop: 8,
              paddingBottom: Math.max(28, insets.bottom + 16),
              height: '90%',
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.colors.borderLight,
                alignSelf: 'center',
                marginBottom: 12,
              }}
            />

            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
                Pilih Kategori
              </Text>
            </View>

            {/* Add new category section at the top */}
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Input
                    value={newCategory}
                    onChangeText={setNewCategory}
                    placeholder="Kategori baru..."
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>
                <Pressable
                  onPress={() => {
                    if (newCategory.trim()) {
                      setCustomCategory(newCategory.trim());
                      setNewCategory('');
                      setShowCategoryPicker(false);
                    }
                  }}
                  disabled={!newCategory.trim()}
                  style={({ pressed }) => ({
                    width: 48,
                    height: 48,
                    borderRadius: theme.radius.md,
                    backgroundColor: newCategory.trim() ? theme.colors.accent : theme.colors.card,
                    borderWidth: 1,
                    borderColor: newCategory.trim() ? theme.colors.accent : theme.colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Ionicons
                    name="add"
                    size={20}
                    color={newCategory.trim() ? '#fff' : theme.colors.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            <FlatList
              data={categories}
              keyExtractor={(item) => item}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setCustomCategory(item);
                    setShowCategoryPicker(false);
                  }}
                  style={{
                    padding: 14,
                    backgroundColor: customCategory === item ? theme.colors.accent + '15' : theme.colors.card,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: customCategory === item ? theme.colors.accent : theme.colors.border,
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      color: customCategory === item ? theme.colors.accent : theme.colors.text,
                      fontSize: 15,
                      fontWeight: '600',
                    }}
                  >
                    {item}
                  </Text>
                </Pressable>
              )}
            />

            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <Button
                title="Tutup"
                variant="ghost"
                fullWidth
                onPress={() => setShowCategoryPicker(false)}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}
