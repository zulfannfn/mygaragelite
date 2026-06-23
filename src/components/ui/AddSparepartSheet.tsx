import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { sparepartService } from '../../services/sparepartService';
import { useTranslation } from '../../i18n';
import { Sparepart } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Input } from './Input';
import { SearchBar } from './SearchBar';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (sp: Sparepart, qty: number, discount: number) => void;
}

const PAGE_SIZE = 20;

export function AddSparepartSheet({ visible, onClose, onPick }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const [items, setItems] = useState<Sparepart[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Sparepart | null>(null);
  const [qty, setQty] = useState(1);
  const [qtyStr, setQtyStr] = useState('1');
  const [discount, setDiscount] = useState(0);
  const [discountStr, setDiscountStr] = useState('0');
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
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryInput, setShowCategoryInput] = useState(false);

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
      setQtyStr('1');
      setDiscount(0);
      setDiscountStr('0');
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
    onPick(selected, Math.max(1, qty), Math.max(0, discount));
    setSelected(null);
    setQty(1);
    setQtyStr('1');
    setDiscount(0);
    setDiscountStr('0');
    setSearch('');
  };

  const submitCustom = async () => {
    if (!customName.trim() || !customBuyPrice.trim() || !customSellPrice.trim() || !customStock.trim()) {
      Alert.alert(t.common.warning, t.common.fillAllData);
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
      onPick(newSp, 1, 0);
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

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.toLowerCase().includes(categorySearch.toLowerCase().trim())),
    [categories, categorySearch]
  );

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
              {t.spareparts.pickSparepart}
            </Text>
          </View>

          {!selected ? (
            <>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <SearchBar
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t.spareparts.searchPlaceholder}
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
                    placeholder={t.spareparts.name}
                  />
                  {/* Category selector — inline dropdown, no Modal */}
                  <Pressable
                    onPress={() => {
                      setShowCategoryPicker(!showCategoryPicker);
                      setCategorySearch('');
                      setShowCategoryInput(false);
                      setNewCategory('');
                    }}
                    style={({ pressed }) => ({
                      backgroundColor: theme.colors.cardLight,
                      borderRadius: theme.radius.md,
                      borderWidth: 1,
                      borderColor: showCategoryPicker ? theme.colors.accent : theme.colors.border,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      marginBottom: showCategoryPicker ? 4 : 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ color: customCategory ? theme.colors.text : theme.colors.textMuted, fontSize: 14 }}>
                      {customCategory || t.spareparts.selectCategory}
                    </Text>
                    <Ionicons
                      name={showCategoryPicker ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={theme.colors.textMuted}
                    />
                  </Pressable>

                  {showCategoryPicker && (
                    <View
                      style={{
                        backgroundColor: theme.colors.card,
                        borderWidth: 1,
                        borderColor: theme.colors.accent,
                        borderRadius: theme.radius.md,
                        marginBottom: 12,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Search + toggle "+" */}
                      <View style={{ flexDirection: 'row', gap: 6, padding: 8 }}>
                        <View
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: theme.colors.cardLight,
                            borderRadius: theme.radius.sm,
                            borderWidth: 1,
                            borderColor: theme.colors.border,
                            paddingHorizontal: 8,
                          }}
                        >
                          <Ionicons name="search" size={14} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
                          <TextInput
                            value={categorySearch}
                            onChangeText={setCategorySearch}
                            placeholder="Cari kategori..."
                            placeholderTextColor={theme.colors.textMuted}
                            style={{
                              flex: 1,
                              color: theme.colors.text,
                              fontSize: 13,
                              paddingVertical: 7,
                            }}
                          />
                        </View>
                        <Pressable
                          onPress={() => { setShowCategoryInput(!showCategoryInput); setNewCategory(''); }}
                          style={({ pressed }) => ({
                            width: 36,
                            height: 36,
                            borderRadius: theme.radius.sm,
                            backgroundColor: showCategoryInput ? theme.colors.accent : theme.colors.cardLight,
                            borderWidth: 1,
                            borderColor: showCategoryInput ? theme.colors.accent : theme.colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: pressed ? 0.7 : 1,
                          })}
                        >
                          <Ionicons name={showCategoryInput ? 'close' : 'add'} size={18} color={showCategoryInput ? '#fff' : theme.colors.textSecondary} />
                        </Pressable>
                      </View>

                      {showCategoryInput && (
                        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 8, paddingBottom: 8 }}>
                          <TextInput
                            value={newCategory}
                            onChangeText={setNewCategory}
                            placeholder="Nama kategori baru..."
                            placeholderTextColor={theme.colors.textMuted}
                            autoFocus
                            style={{
                              flex: 1,
                              backgroundColor: theme.colors.cardLight,
                              color: theme.colors.text,
                              borderRadius: theme.radius.sm,
                              borderWidth: 1,
                              borderColor: theme.colors.border,
                              paddingHorizontal: 10,
                              paddingVertical: 7,
                              fontSize: 13,
                            }}
                          />
                          <Pressable
                            onPress={() => {
                              if (newCategory.trim()) {
                                setCustomCategory(newCategory.trim());
                                setNewCategory('');
                                setShowCategoryInput(false);
                                setCategorySearch('');
                                setShowCategoryPicker(false);
                              }
                            }}
                            disabled={!newCategory.trim()}
                            style={({ pressed }) => ({
                              width: 36,
                              height: 36,
                              borderRadius: theme.radius.sm,
                              backgroundColor: newCategory.trim() ? theme.colors.success : theme.colors.cardLight,
                              borderWidth: 1,
                              borderColor: newCategory.trim() ? theme.colors.success : theme.colors.border,
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <Ionicons name="checkmark" size={18} color={newCategory.trim() ? '#fff' : theme.colors.textMuted} />
                          </Pressable>
                        </View>
                      )}

                      <FlatList
                        data={filteredCategories}
                        keyExtractor={(cat) => cat}
                        keyboardShouldPersistTaps="handled"
                        style={{ maxHeight: 160 }}
                        renderItem={({ item: cat }) => (
                          <Pressable
                            onPress={() => {
                              setCustomCategory(cat);
                              setShowCategoryPicker(false);
                              setCategorySearch('');
                              setShowCategoryInput(false);
                            }}
                            style={({ pressed }) => ({
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              backgroundColor: customCategory === cat ? theme.colors.accent + '18' : 'transparent',
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <Text style={{
                              color: customCategory === cat ? theme.colors.accent : theme.colors.text,
                              fontSize: 14,
                              fontWeight: customCategory === cat ? '700' : '400',
                            }}>
                              {cat}
                            </Text>
                          </Pressable>
                        )}
                        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.colors.borderLight }} />}
                        ListEmptyComponent={
                          <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12, fontSize: 12 }}>
                            {categorySearch ? 'Tidak ditemukan' : 'Belum ada kategori'}
                          </Text>
                        }
                      />
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        value={customBuyPrice}
                        onChangeText={setCustomBuyPrice}
                        placeholder={t.spareparts.buyPrice}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        value={customSellPrice}
                        onChangeText={setCustomSellPrice}
                        placeholder={t.spareparts.sellPrice}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        value={customStock}
                        onChangeText={setCustomStock}
                        placeholder={t.spareparts.stock}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        value={customMinStock}
                        onChangeText={setCustomMinStock}
                        placeholder={t.spareparts.minStock}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <Button
                    title={t.spareparts.addCustomSparepart}
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
                    {t.common.loading}
                  </Text>
                ) : undefined}
                ListEmptyComponent={
                  loading ? (
                    <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12 }}>
                      {t.common.loading}
                    </Text>
                  ) : (
                    <EmptyState
                      icon="cube-outline"
                      title={t.spareparts.notFound}
                      description={t.spareparts.notFoundDesc}
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
                            {isOut ? t.spareparts.outOfStockLabel : `${t.spareparts.stock}: ${item.stock}`} • {item.category}
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
                  {t.spareparts.stockRemaining}: {selected.stock} • {t.spareparts.price}: {formatCurrency(selected.sell_price)}
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
                {t.spareparts.quantity}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  paddingVertical: 16,
                  backgroundColor: theme.colors.card,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Pressable
                  onPress={() => {
                    const next = Math.max(1, qty - 1);
                    setQty(next);
                    setQtyStr(String(next));
                  }}
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
                <TextInput
                  value={qtyStr}
                  onChangeText={(v) => {
                    const clean = v.replace(/[^0-9]/g, '');
                    setQtyStr(clean);
                    const n = parseInt(clean, 10);
                    if (!isNaN(n) && n >= 1) setQty(n);
                  }}
                  onBlur={() => {
                    const n = parseInt(qtyStr, 10);
                    const safe = isNaN(n) || n < 1 ? 1 : n;
                    setQty(safe);
                    setQtyStr(String(safe));
                  }}
                  keyboardType="numeric"
                  style={{
                    color: theme.colors.text,
                    fontSize: 28,
                    fontWeight: '800',
                    minWidth: 60,
                    textAlign: 'center',
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    backgroundColor: theme.colors.surface,
                  }}
                />
                <Pressable
                  onPress={() => {
                    const next = selected.stock > 0 ? Math.min(selected.stock, qty + 1) : qty + 1;
                    setQty(next);
                    setQtyStr(String(next));
                  }}
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

              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                    Diskon per Item (Rp)
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                    maks. margin {formatCurrency(Math.max(0, selected.sell_price - (selected.buy_price ?? 0)))}
                  </Text>
                </View>
                <TextInput
                  value={discountStr}
                  onChangeText={(v) => {
                    const clean = v.replace(/[^0-9]/g, '');
                    const n = parseInt(clean, 10) || 0;
                    const capped = Math.min(n, Math.max(0, selected.sell_price - (selected.buy_price ?? 0)));
                    setDiscountStr(capped === n ? clean : String(capped));
                    setDiscount(capped);
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={theme.colors.textMuted}
                  style={{
                    color: theme.colors.text,
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: theme.colors.surface,
                  }}
                />
              </View>

              <View style={{ marginTop: 14, gap: 6 }}>
                {discount > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Harga Normal</Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 13, textDecorationLine: 'line-through' }}>
                      {formatCurrency(selected.sell_price * qty)}
                    </Text>
                  </View>
                )}
                {discount > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Total Diskon</Text>
                    <Text style={{ color: theme.colors.danger, fontSize: 13, fontWeight: '700' }}>
                      -{formatCurrency(discount * qty)}
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>
                    {t.spareparts.subtotal}
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.accent,
                      fontSize: 18,
                      fontWeight: '800',
                    }}
                  >
                    {formatCurrency((selected.sell_price - discount) * qty)}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 10, marginTop: 20 }}>
                <Button
                  title={t.spareparts.addToTransaction}
                  size="lg"
                  fullWidth
                  onPress={submit}
                  icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />}
                />
                <Button
                  title={t.spareparts.pickOther}
                  variant="ghost"
                  fullWidth
                  onPress={() => setSelected(null)}
                />
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
