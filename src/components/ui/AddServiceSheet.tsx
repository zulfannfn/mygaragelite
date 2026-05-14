import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { theme } from '../../constants/theme';
import { serviceService } from '../../services/serviceService';
import { formatCurrency, parseCurrency } from '../../utils/currency';
import { Button } from './Button';
import { Input } from './Input';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (service: { service_name: string; price: number }) => void;
}

export function AddServiceSheet({ visible, onClose, onAdd }: Props) {
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [services, setServices] = useState<{ name: string; price: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      serviceService.getAll().then((data) => {
        setServices(data.map((s) => ({ name: s.name, price: s.price })));
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [visible]);

  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return services;
    const q = searchQuery.toLowerCase();
    return services.filter((p) => p.name.toLowerCase().includes(q));
  }, [searchQuery, services]);

  const reset = () => {
    setCustomName('');
    setCustomPrice('');
    setSearchQuery('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const submitCustom = async () => {
    if (!customName.trim()) return;
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
            paddingBottom: 28,
            maxHeight: '88%',
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

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16 }}>
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Cari jasa..."
              leftIcon={<Ionicons name="search" size={18} color={theme.colors.textSecondary} />}
            />

            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1,
                marginBottom: 8,
                marginTop: 4,
              }}
            >
              JASA
            </Text>
            {loading ? (
              <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12 }}>
                Memuat...
              </Text>
            ) : filteredServices.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 12 }}>
                Tidak ada jasa
              </Text>
            ) : (
              filteredServices.map((svc, i) => (
                <Pressable
                  key={`${svc.name}-${i}`}
                  onPress={() => {
                    onAdd({ service_name: svc.name, price: svc.price });
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    backgroundColor: pressed ? theme.colors.cardLight : theme.colors.card,
                    borderRadius: theme.radius.lg,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  })}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: theme.colors.accent + '15',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Ionicons name="build" size={18} color={theme.colors.accent} />
                  </View>
                  <Text
                    style={{ color: theme.colors.text, fontSize: 15, fontWeight: '600', flex: 1 }}
                  >
                    {svc.name}
                  </Text>
                  <Text
                    style={{ color: theme.colors.accent, fontSize: 15, fontWeight: '700', flexShrink: 0, marginLeft: 8 }}
                  >
                    {formatCurrency(svc.price)}
                  </Text>
                </Pressable>
              ))
            )}

            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1,
                marginTop: 12,
                marginBottom: 8,
              }}
            >
              JASA KUSTOM
            </Text>
            <View
              style={{
                padding: 14,
                backgroundColor: theme.colors.card,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
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
                disabled={!customName.trim()}
                icon={<Ionicons name="add-circle" size={18} color="#fff" />}
              />
            </View>
          </ScrollView>

          <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
            <Button title="Tutup" variant="ghost" fullWidth onPress={close} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
