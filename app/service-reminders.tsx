import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { EmptyState } from '../src/components/ui/EmptyState';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { useTheme } from '../src/contexts/ThemeContext';
import { ReminderRange, serviceReminderService } from '../src/services/serviceReminderService';
import { useAppStore } from '../src/store/useAppStore';
import { ServiceReminderDue, Transaction } from '../src/types';
import { formatCurrency } from '../src/utils/currency';
import { formatDate, daysBetween } from '../src/utils/date';

export default function ServiceRemindersScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const showToast = useAppStore((s) => s.showToast);

  const [range, setRange] = useState<ReminderRange>('this_month');
  const [items, setItems] = useState<ServiceReminderDue[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<ServiceReminderDue | null>(null);
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await serviceReminderService.getDueList(range);
    setItems(data);
    setLoading(false);
  }, [range]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openDetail = async (item: ServiceReminderDue) => {
    setSelected(item);
    setDetail(null);
    const tx = await serviceReminderService.getLastServiceDetail(item.transaction_id);
    setDetail(tx);
  };

  const closeDetail = () => {
    setSelected(null);
    setDetail(null);
  };

  const sendReminder = async () => {
    if (!selected) return;
    if (!selected.customer_phone) {
      showToast('Pelanggan belum punya nomor HP', 'error');
      return;
    }
    setSending(true);
    try {
      const message = await serviceReminderService.buildReminderMessage(selected);
      const result = await serviceReminderService.sendReminder(
        selected.customer_id,
        selected.transaction_id,
        selected.customer_phone,
        message
      );
      if (!result.ok) {
        showToast(result.reason ?? 'Gagal kirim reminder', 'error');
        return;
      }
      showToast('Reminder berhasil dikirim', 'success');
      closeDetail();
      await load();
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader
        title="Reminder Service"
        subtitle={`${items.length} pelanggan perlu diingatkan`}
        showBack
      />

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 }}>
        {([
          { key: 'this_month' as const, label: 'Bulan Ini' },
          { key: 'next_month' as const, label: 'Bulan Depan' },
        ]).map((opt) => {
          const active = range === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setRange(opt.key)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: theme.radius.lg,
                alignItems: 'center',
                backgroundColor: active ? theme.colors.accent : theme.colors.cardLight,
                borderWidth: 1,
                borderColor: active ? theme.colors.accent : theme.colors.border,
              }}
            >
              <Text style={{ color: active ? '#fff' : theme.colors.text, fontSize: 13, fontWeight: '700' }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.transaction_id}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 40 + (Platform.OS === 'android' ? 48 : 34),
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="notifications-outline"
              title="Tidak ada pelanggan due"
              description="Belum ada pelanggan yang perlu diingatkan servis pada periode ini."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const days = daysBetween(Date.now(), item.next_service_date);
          const overdue = days < 0;
          return (
            <Card onPress={() => openDetail(item)} padding="md">
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: theme.colors.accent + '1F',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={item.customer_type === 'bengkel' ? 'business' : 'person'}
                    size={18}
                    color={theme.colors.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>
                    {item.customer_name}
                  </Text>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                    {item.customer_plate || '-'}{item.customer_vehicle_brand ? ` • ${item.customer_vehicle_brand}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <Badge
                      label={overdue ? `Lewat ${Math.abs(days)} hari` : `${days} hari lagi`}
                      variant={overdue ? 'danger' : days <= 7 ? 'warning' : 'info'}
                    />
                    <Text style={{ color: theme.colors.textMuted, fontSize: 11, alignSelf: 'center' }}>
                      {formatDate(item.next_service_date)}
                    </Text>
                  </View>
                  {item.recommendation ? (
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
                      📝 {item.recommendation}
                    </Text>
                  ) : null}
                </View>
                <Badge
                  label={item.sent_count > 0 ? `Direminder ${item.sent_count}x` : 'Belum direminder'}
                  variant={item.sent_count > 0 ? 'success' : 'neutral'}
                />
              </View>
            </Card>
          );
        }}
      />

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={closeDetail}>
        <Pressable
          onPress={closeDetail}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              paddingTop: 8,
              paddingBottom: Math.max(24, insets.bottom + 16),
              maxHeight: '85%',
            }}
          >
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.borderLight, alignSelf: 'center', marginBottom: 12 }} />
            <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
              <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
                {selected?.customer_name}
              </Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                {selected?.customer_plate} • Estimasi servis: {selected ? formatDate(selected.next_service_date) : ''}
              </Text>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              {!detail ? (
                <Text style={{ color: theme.colors.textMuted, textAlign: 'center', padding: 16 }}>Memuat...</Text>
              ) : (
                <Card style={{ marginBottom: 12 }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                    SERVIS TERAKHIR • {formatDate(detail.created_at)}
                  </Text>
                  {detail.complaint ? (
                    <Text style={{ color: theme.colors.text, marginTop: 8, fontSize: 13 }}>
                      Keluhan: {detail.complaint}
                    </Text>
                  ) : null}
                  {detail.recommendation ? (
                    <Text style={{ color: theme.colors.text, marginTop: 6, fontSize: 13 }}>
                      Rekomendasi: {detail.recommendation}
                    </Text>
                  ) : null}
                  {detail.service_items && detail.service_items.length > 0 ? (
                    <View style={{ marginTop: 8 }}>
                      {detail.service_items.map((s) => (
                        <Text key={s.id} style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                          • {s.service_name} — {formatCurrency(s.price)}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 14, marginTop: 8 }}>
                    Total: {formatCurrency(detail.total_amount)}
                  </Text>
                </Card>
              )}
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: 12 }}>
                Sudah diingatkan {selected?.sent_count ?? 0}x sebelumnya.
              </Text>
            </ScrollView>

            <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
              <Button
                title="Kirim Reminder via WhatsApp"
                variant="success"
                size="lg"
                fullWidth
                loading={sending}
                disabled={!selected?.customer_phone}
                onPress={sendReminder}
                icon={<Ionicons name="logo-whatsapp" size={18} color="#fff" />}
              />
              {!selected?.customer_phone ? (
                <Text style={{ color: theme.colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                  Pelanggan belum punya nomor HP.
                </Text>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
