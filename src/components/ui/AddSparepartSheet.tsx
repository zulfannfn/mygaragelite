import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { theme } from '../../constants/theme';
import { sparepartService } from '../../services/sparepartService';
import { Sparepart } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { SearchBar } from './SearchBar';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (sp: Sparepart, qty: number) => void;
}

export function AddSparepartSheet({ visible, onClose, onPick }: Props) {
  const [items, setItems] = useState<Sparepart[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Sparepart | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (visible) {
      sparepartService.getAll().then(setItems);
    } else {
      setSelected(null);
      setSearch('');
      setQty(1);
    }
  }, [visible]);

  const filtered = useMemo(
    () =>
      items.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase().trim())
      ),
    [items, search]
  );

  const submit = () => {
    if (!selected) return;
    onPick(selected, Math.max(1, qty));
    setSelected(null);
    setQty(1);
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
            paddingBottom: 28,
            height: '85%',
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
              <SearchBar value={search} onChangeText={setSearch} placeholder="Cari sparepart..." />
              <FlatList
                data={filtered}
                keyExtractor={(it) => it.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                ListEmptyComponent={
                  <EmptyState
                    icon="cube-outline"
                    title="Tidak ditemukan"
                    description="Coba kata kunci lain"
                  />
                }
                renderItem={({ item }) => {
                  const isOut = item.stock <= 0;
                  return (
                    <Pressable
                      onPress={() => !isOut && setSelected(item)}
                      disabled={isOut}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: 14,
                        borderRadius: theme.radius.lg,
                        backgroundColor: pressed ? theme.colors.cardLight : theme.colors.card,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        opacity: isOut ? 0.5 : 1,
                      })}
                    >
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          backgroundColor: isOut ? theme.colors.borderLight : theme.colors.warning + '15',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Ionicons name="cube" size={20} color={isOut ? theme.colors.textMuted : theme.colors.warning} />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
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
                          }}
                        >
                          {isOut ? 'STOK HABIS' : `Stok: ${item.stock}`} • {item.category}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: theme.colors.accent,
                          fontSize: 15,
                          fontWeight: '700',
                          flexShrink: 0,
                          marginLeft: 8,
                        }}
                      >
                        {formatCurrency(item.sell_price)}
                      </Text>
                    </Pressable>
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
    </Modal>
  );
}
