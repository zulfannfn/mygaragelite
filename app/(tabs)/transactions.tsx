import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { Badge } from '../../src/components/ui/Badge';
import { Card } from '../../src/components/ui/Card';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FilterChip } from '../../src/components/ui/FilterChip';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { SearchBar } from '../../src/components/ui/SearchBar';
import { SkeletonCard } from '../../src/components/ui/Skeleton';
import { theme } from '../../src/constants/theme';
import { exportService } from '../../src/services/exportService';
import { useAppStore } from '../../src/store/useAppStore';
import { useTransactionStore } from '../../src/store/useTransactionStore';
import { TransactionStatus } from '../../src/types';
import { formatCompactCurrency } from '../../src/utils/currency';
import { formatDateTime } from '../../src/utils/date';

const FILTERS: {
  label: string;
  value?: TransactionStatus;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
}[] = [
  { label: 'Semua', icon: 'apps' },
  { label: 'Lunas', value: 'paid', icon: 'checkmark-circle', color: theme.colors.success },
  { label: 'Pending', value: 'pending', icon: 'time', color: theme.colors.warning },
  { label: 'Batal', value: 'cancelled', icon: 'close-circle', color: theme.colors.danger },
];

export default function TransactionsScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const { transactions, loading, filters, setFilters, load } = useTransactionStore();
  const [activeFilter, setActiveFilter] = useState(0);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totalRevenue = transactions
    .filter((t) => t.status === 'paid')
    .reduce((s, t) => s + t.total_amount, 0);

  const handleExport = async () => {
    try {
      await exportService.exportTransactionsToPDF(transactions, 'Laporan Transaksi');
      showToast('Berhasil export PDF', 'success');
    } catch {
      showToast('Gagal export PDF', 'error');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader
        title="Transaksi"
        subtitle={`${transactions.length} transaksi • ${formatCompactCurrency(totalRevenue)}`}
        rightElement={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={handleExport}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.colors.card,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="download-outline" size={20} color={theme.colors.text} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/transaction-form')}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          </View>
        }
      />

      <SearchBar
        value={filters.search}
        onChangeText={(s) => setFilters({ search: s })}
        placeholder="Cari pelanggan/plat..."
      />

      <View style={{ height: 52, marginBottom: 4 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            gap: 8,
            alignItems: 'center',
          }}
        >
          {FILTERS.map((f, i) => (
            <FilterChip
              key={i}
              label={f.label}
              icon={f.icon}
              color={f.color}
              active={activeFilter === i}
              onPress={() => {
                setActiveFilter(i);
                setFilters({ status: f.value });
              }}
            />
          ))}
        </ScrollView>
      </View>

      {loading && transactions.length === 0 ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 100,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="Belum ada transaksi"
              description="Mulai catat servis pertama Anda."
            />
          }
          renderItem={({ item }) => {
            const statusVariant =
              item.status === 'paid'
                ? 'success'
                : item.status === 'pending'
                  ? 'warning'
                  : 'danger';
            const statusLabel =
              item.status === 'paid'
                ? 'Lunas'
                : item.status === 'pending'
                  ? 'Pending'
                  : 'Batal';
            const statusColor =
              item.status === 'paid'
                ? theme.colors.success
                : item.status === 'pending'
                  ? theme.colors.warning
                  : theme.colors.danger;
            const initial = (item.customer_name ?? '?').charAt(0).toUpperCase();
            return (
              <Card
                onPress={() =>
                  router.push({ pathname: '/transaction-detail', params: { id: item.id } })
                }
                padding="md"
              >
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {/* Avatar */}
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: statusColor + '1F',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: statusColor + '40',
                    }}
                  >
                    <Text style={{ color: statusColor, fontSize: 18, fontWeight: '800' }}>
                      {initial}
                    </Text>
                  </View>

                  {/* Body */}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: theme.colors.text,
                          fontSize: 15,
                          fontWeight: '700',
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {item.customer_name ?? 'Tanpa Pelanggan'}
                      </Text>
                      <Text
                        style={{ color: theme.colors.accent, fontSize: 16, fontWeight: '800' }}
                      >
                        {formatCompactCurrency(item.total_amount)}
                      </Text>
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        gap: 6,
                        marginTop: 6,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      {item.customer_plate ? (
                        <Badge label={item.customer_plate} variant="accent" />
                      ) : null}
                      <Badge label={statusLabel} variant={statusVariant} />
                      {item.mechanic_name ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Ionicons name="construct" size={11} color={theme.colors.textMuted} />
                          <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                            {item.mechanic_name}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 6,
                      }}
                    >
                      <Ionicons name="time-outline" size={11} color={theme.colors.textMuted} />
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                        {formatDateTime(item.created_at)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}
