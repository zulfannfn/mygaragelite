import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { serviceService } from '../../services/serviceService';
import { formatCurrency, parseCurrency } from '../../utils/currency';
import { Button } from './Button';
import { Input } from './Input';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (service: { service_name: string; price: number }) => void;
}

const PAGE_SIZE = 20;

export function AddServiceSheet({ visible, onClose, onAdd }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [services, setServices] = useState<{ name: string; price: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [showCustomForm, setShowCustomForm] = useState(false);

  const loadServices = useCallback(async (offset = 0, search = '') => {
    if (offset === 0) {
      setLoading(true);
      setServices([]);
    }
    try {
      const data = await serviceService.getAll(search, PAGE_SIZE, offset);
      const mappedData = data.map((s) => ({ name: s.name, price: s.price }));
      if (offset === 0) {
        setServices(mappedData);
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setServices((prev) => [...prev, ...mappedData]);
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setLoading(true);
      loadServices(0, '');
    } else {
      setServices([]);
      setHasMore(true);
    }
  }, [visible, loadServices]);

  useEffect(() => {
    if (visible && searchQuery.trim() !== '') {
      loadServices(0, searchQuery);
    }
  }, [searchQuery, visible, loadServices]);

  const handleEndReached = () => {
    if (!loading && hasMore) {
      loadServices(services.length, searchQuery);
    }
  };

  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return services;
    const q = searchQuery.toLowerCase();
    return services.filter((p) => p.name.toLowerCase().includes(q));
  }, [searchQuery, services]);

  const reset = () => {
    setCustomName('');
    setCustomPrice('');
    setSearchQuery('');
    setShowCustomForm(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submitCustom = async () => {
    if (!customName.trim() || !customPrice.trim()) {
      Alert.alert('Peringatan', 'Mohon lengkapi semua data');
      return;
    }
    const price = parseCurrency(customPrice);
    try {
      await serviceService.create({ name: customName.trim(), price });
    } catch {
      // ignore duplicate / silent fail
    }
    onAdd({
      service_name: customName.trim(),
      price,
    });
    reset();
  };

  const toggleCustomForm = () => {
    setShowCustomForm(!showCustomForm);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable
        onPress={close}
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
            flexDirection: 'column',
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
              Tambah Jasa Servis
            </Text>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: 13,
                marginTop: 4,
              }}
            >
              Pilih jasa atau buat sendiri
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Input
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Cari jasa..."
                leftIcon={<Ionicons name="search" size={18} color={theme.colors.textSecondary} />}
                containerStyle={{ marginBottom: 0 }}
              />
            </View>
            <Pressable
              onPress={toggleCustomForm}
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
                placeholder="Nama jasa..."
              />
              <Input
                value={customPrice}
                onChangeText={setCustomPrice}
                placeholder="Harga (Rp)"
                keyboardType="numeric"
              />
              <Button
                title="Tambahkan Jasa Kustom"
                fullWidth
                onPress={submitCustom}
                disabled={!customName.trim() || !customPrice.trim()}
                icon={<Ionicons name="add-circle" size={18} color="#fff" />}
              />
            </View>
          )}

          <FlatList
            data={filteredServices}
            keyExtractor={(item, index) => `${item.name}-${index}`}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loading && services.length > 0
                ? () => (
                    <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12 }}>
                      Memuat...
                    </Text>
                  )
                : undefined
            }
            ListEmptyComponent={
              loading ? (
                <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12 }}>
                  Memuat...
                </Text>
              ) : (
                <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12 }}>
                  Tidak ada jasa
                </Text>
              )
            }
            renderItem={({ item }) => (
              <View
                style={{
                  width: '100%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.colors.card,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: theme.colors.accent + '15',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="build" size={18} color={theme.colors.accent} />
                </View>
                <Pressable
                  onPress={() => {
                    onAdd({ service_name: item.name, price: item.price });
                  }}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                >
                  <Text
                    style={{ color: theme.colors.text, fontSize: 15, fontWeight: '600', flex: 1 }}
                  >
                    {item.name}
                  </Text>
                </Pressable>
                <Text
                  style={{ color: theme.colors.accent, fontSize: 15, fontWeight: '700', marginLeft: 8 }}
                >
                  {formatCurrency(item.price)}
                </Text>
              </View>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
