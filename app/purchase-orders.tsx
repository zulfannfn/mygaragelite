import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Platform, Pressable, Text, View } from 'react-native';
import { Badge } from '../src/components/ui/Badge';
import { Card } from '../src/components/ui/Card';
import { EmptyState } from '../src/components/ui/EmptyState';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { useTheme } from '../src/contexts/ThemeContext';
import { purchaseOrderService } from '../src/services/purchaseOrderService';
import { PurchaseOrder, PurchaseOrderStatus } from '../src/types';
import { formatDate } from '../src/utils/date';

type FilterKey = 'all' | PurchaseOrderStatus;

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  pre_order: 'Sedang Pre Order',
  belum_input: 'Belum Input',
  selesai: 'Selesai',
};

const STATUS_VARIANT: Record<PurchaseOrderStatus, 'warning' | 'info' | 'success'> = {
  pre_order: 'warning',
  belum_input: 'info',
  selesai: 'success',
};

export default function PurchaseOrdersScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await purchaseOrderService.getAll(filter === 'all' ? undefined : filter);
    setOrders(data);
    setLoading(false);
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'pre_order', label: 'Pre Order' },
    { key: 'belum_input', label: 'Belum Input' },
    { key: 'selesai', label: 'Selesai' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader
        title="Purchase Order"
        subtitle={`${orders.length} PO`}
        showBack
        rightElement={
          <Pressable
            onPress={() => router.push('/purchase-order-form')}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: theme.colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        }
      />

      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.key}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item: f }) => {
            const active = filter === f.key;
            return (
              <Pressable
                onPress={() => setFilter(f.key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: theme.radius.md,
                  backgroundColor: active ? theme.colors.accent : theme.colors.card,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.accent : theme.colors.border,
                }}
              >
                <Text style={{ color: active ? '#fff' : theme.colors.text, fontSize: 12, fontWeight: '700' }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 40 + (Platform.OS === 'android' ? 48 : 34),
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="cart-outline"
              title="Belum ada Purchase Order"
              description="Buat PO baru untuk memesan sparepart ke supplier."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Card onPress={() => router.push({ pathname: '/purchase-order-detail', params: { id: item.id } })} padding="md">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>
                  {item.po_number || `PO-${item.id.slice(0, 6).toUpperCase()}`}
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {item.supplier || 'Tanpa supplier'}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 4 }}>
                  {formatDate(item.created_at)}
                </Text>
              </View>
              <Badge label={STATUS_LABEL[item.status]} variant={STATUS_VARIANT[item.status]} />
            </View>
          </Card>
        )}
      />
    </View>
  );
}
