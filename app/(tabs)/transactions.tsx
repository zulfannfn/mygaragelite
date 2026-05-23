import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, KeyboardAvoidingView } from 'react-native';
import { Badge } from '../../src/components/ui/Badge';
import { Card } from '../../src/components/ui/Card';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { SearchBar } from '../../src/components/ui/SearchBar';
import { SkeletonCard } from '../../src/components/ui/Skeleton';
import { useTheme } from '../../src/contexts/ThemeContext';
import { exportService } from '../../src/services/exportService';
import { useAppStore } from '../../src/store/useAppStore';
import { useTransactionStore } from '../../src/store/useTransactionStore';
import { TransactionStatus, TransactionType } from '../../src/types';
import { formatCompactCurrency } from '../../src/utils/currency';
import { formatDateTime } from '../../src/utils/date';

const STATUS_FILTERS: {
  label: string;
  value?: TransactionStatus;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
}[] = [
  { label: 'Semua', icon: 'apps' },
  { label: 'Lunas', value: 'paid', icon: 'checkmark-circle', color: '#00C896' },
  { label: 'Pending', value: 'pending', icon: 'time', color: '#FFB800' },
  { label: 'Batal', value: 'cancelled', icon: 'close-circle', color: '#FF4757' },
];

const TYPE_FILTERS: {
  label: string;
  value?: TransactionType;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
}[] = [
  { label: 'Semua', icon: 'apps' },
  { label: 'Servis', value: 'service', icon: 'construct', color: '#FF6B35' },
  { label: 'Kasir', value: 'retail', icon: 'cart', color: '#00C896' },
];

function formatShortDate(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

interface DateInput {
  d: string;
  m: string;
  y: string;
}

function formatDateInput(ts?: number): DateInput {
  if (!ts) return { d: '', m: '', y: '' };
  const date = new Date(ts);
  return {
    d: String(date.getDate()).padStart(2, '0'),
    m: String(date.getMonth() + 1).padStart(2, '0'),
    y: String(date.getFullYear()),
  };
}

function parseDateInput(input: DateInput): number | undefined {
  const day = parseInt(input.d, 10);
  const month = parseInt(input.m, 10) - 1;
  const year = parseInt(input.y, 10);
  if (isNaN(day) || isNaN(month) || isNaN(year) || !input.d || !input.m || !input.y) return undefined;
  const date = new Date(year, month, day, 0, 0, 0, 0);
  if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) return undefined;
  return date.getTime();
}

function emptyDateInput(): DateInput {
  return { d: '', m: '', y: '' };
}

export default function TransactionsScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const { theme } = useTheme();
  const { transactions, loading, hasMore, filters, setFilters, load, loadMore } = useTransactionStore();
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [tempType, setTempType] = useState<TransactionType | undefined>(undefined);
  const [tempStatus, setTempStatus] = useState<TransactionStatus | undefined>(undefined);
  const [tempStart, setTempStart] = useState<DateInput>(emptyDateInput());
  const [tempEnd, setTempEnd] = useState<DateInput>(emptyDateInput());

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleEndReached = () => {
    loadMore();
  };

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
          <Pressable
            onPress={() => router.push('/transaction-form')}
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

      <SearchBar
        value={filters.search}
        onChangeText={(s) => setFilters({ search: s })}
        placeholder="Cari pelanggan/plat..."
        rightElement={
          <Pressable
            onPress={() => {
              setTempType(filters.type);
              setTempStatus(filters.status);
              setTempStart(formatDateInput(filters.startDate));
              setTempEnd(formatDateInput(filters.endDate));
              setFilterModalOpen(true);
            }}
            hitSlop={6}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor:
                filters.type || filters.status || filters.startDate || filters.endDate
                  ? theme.colors.accent + '22'
                  : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
              marginLeft: 4,
            })}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={
                filters.type || filters.status || filters.startDate || filters.endDate
                  ? theme.colors.accent
                  : theme.colors.textMuted
              }
            />
          </Pressable>
        }
      />

      {/* Active filter chips */}
      {(filters.type || filters.status || filters.startDate || filters.endDate) && (
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {filters.type && (
              <Pressable
                onPress={() => setFilters({ type: undefined })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.accent + '18',
                  borderWidth: 1,
                  borderColor: theme.colors.accent,
                }}
              >
                <Ionicons
                  name={filters.type === 'service' ? 'construct' : 'cart'}
                  size={12}
                  color={theme.colors.accent}
                />
                <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: '700' }}>
                  {filters.type === 'service' ? 'Service' : 'Kasir'}
                </Text>
                <Ionicons name="close" size={12} color={theme.colors.accent} />
              </Pressable>
            )}
            {filters.status && (
              <Pressable
                onPress={() => setFilters({ status: undefined })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: theme.radius.md,
                  backgroundColor:
                    (filters.status === 'paid'
                      ? theme.colors.success
                      : filters.status === 'pending'
                        ? theme.colors.warning
                        : theme.colors.danger) + '18',
                  borderWidth: 1,
                  borderColor:
                    filters.status === 'paid'
                      ? theme.colors.success
                      : filters.status === 'pending'
                        ? theme.colors.warning
                        : theme.colors.danger,
                }}
              >
                <Ionicons
                  name={
                    filters.status === 'paid'
                      ? 'checkmark-circle'
                      : filters.status === 'pending'
                        ? 'time'
                        : 'close-circle'
                  }
                  size={12}
                  color={
                    filters.status === 'paid'
                      ? theme.colors.success
                      : filters.status === 'pending'
                        ? theme.colors.warning
                        : theme.colors.danger
                  }
                />
                <Text
                  style={{
                    color:
                      filters.status === 'paid'
                        ? theme.colors.success
                        : filters.status === 'pending'
                          ? theme.colors.warning
                          : theme.colors.danger,
                    fontSize: 11,
                    fontWeight: '700',
                  }}
                >
                  {filters.status === 'paid' ? 'Lunas' : filters.status === 'pending' ? 'Pending' : 'Batal'}
                </Text>
                <Ionicons
                  name="close"
                  size={12}
                  color={
                    filters.status === 'paid'
                      ? theme.colors.success
                      : filters.status === 'pending'
                        ? theme.colors.warning
                        : theme.colors.danger
                  }
                />
              </Pressable>
            )}
            {(filters.startDate || filters.endDate) && (
              <Pressable
                onPress={() => setFilters({ startDate: undefined, endDate: undefined })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.warning + '18',
                  borderWidth: 1,
                  borderColor: theme.colors.warning,
                }}
              >
                <Ionicons name="calendar" size={12} color={theme.colors.warning} />
                <Text style={{ color: theme.colors.warning, fontSize: 11, fontWeight: '700' }}>
                  {formatShortDate(filters.startDate)} - {formatShortDate(filters.endDate)}
                </Text>
                <Ionicons name="close" size={12} color={theme.colors.warning} />
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}

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
            paddingBottom: 100 + (Platform.OS === 'android' ? 48 : 34),
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loading && transactions.length > 0 ? () => (
            <View style={{ padding: 16 }}>
              <SkeletonCard />
            </View>
          ) : undefined}
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

      {/* Unified filter modal */}
      <Modal
        visible={filterModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalOpen(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            padding: 24,
          }}
          onPress={() => setFilterModalOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.xl,
              padding: 20,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 16,
                fontWeight: '700',
                marginBottom: 16,
              }}
            >
              Filter Transaksi
            </Text>

            {/* Type filter */}
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
              Jenis Transaksi
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {TYPE_FILTERS.map((f) => {
                const active = tempType === f.value;
                return (
                  <Pressable
                    key={f.label}
                    onPress={() => setTempType(f.value)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 10,
                      borderRadius: theme.radius.lg,
                      backgroundColor: active ? theme.colors.accent : theme.colors.cardLight,
                      borderWidth: 1,
                      borderColor: active ? theme.colors.accent : theme.colors.border,
                    }}
                  >
                    <Ionicons name={f.icon} size={14} color={active ? '#fff' : theme.colors.textSecondary} />
                    <Text style={{ color: active ? '#fff' : theme.colors.text, fontSize: 13, fontWeight: '600' }}>
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Status filter */}
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
              Status
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {STATUS_FILTERS.map((f) => {
                const active = tempStatus === f.value;
                return (
                  <Pressable
                    key={f.label}
                    onPress={() => setTempStatus(f.value)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 10,
                      borderRadius: theme.radius.lg,
                      backgroundColor: active ? (f.color ?? theme.colors.primary) : theme.colors.cardLight,
                      borderWidth: 1,
                      borderColor: active ? (f.color ?? theme.colors.primary) : theme.colors.border,
                    }}
                  >
                    <Ionicons name={f.icon} size={14} color={active ? '#fff' : theme.colors.textSecondary} />
                    <Text style={{ color: active ? '#fff' : theme.colors.text, fontSize: 13, fontWeight: '600' }}>
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Date range */}
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
              Rentang Tanggal
            </Text>
            <View style={{ gap: 10, marginBottom: 16 }}>
              <View>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, marginBottom: 4 }}>Dari</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {(['d', 'm', 'y'] as const).map((k) => (
                    <TextInput
                      key={k}
                      value={tempStart[k]}
                      onChangeText={(text) => {
                        const numeric = text.replace(/\D/g, '');
                        setTempStart((prev) => ({ ...prev, [k]: numeric }));
                      }}
                      placeholder={k === 'd' ? 'DD' : k === 'm' ? 'MM' : 'YYYY'}
                      maxLength={k === 'y' ? 4 : 2}
                      keyboardType="number-pad"
                      style={{
                        flex: 1,
                        minWidth: k === 'y' ? 80 : 60,
                        height: 42,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        borderRadius: theme.radius.md,
                        backgroundColor: theme.colors.cardLight,
                        color: theme.colors.text,
                        paddingHorizontal: 10,
                        fontSize: 14,
                        textAlign: 'center',
                      }}
                    />
                  ))}
                </View>
              </View>
              <View>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, marginBottom: 4 }}>Sampai</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {(['d', 'm', 'y'] as const).map((k) => (
                    <TextInput
                      key={k}
                      value={tempEnd[k]}
                      onChangeText={(text) => {
                        const numeric = text.replace(/\D/g, '');
                        setTempEnd((prev) => ({ ...prev, [k]: numeric }));
                      }}
                      placeholder={k === 'd' ? 'DD' : k === 'm' ? 'MM' : 'YYYY'}
                      maxLength={k === 'y' ? 4 : 2}
                      keyboardType="number-pad"
                      style={{
                        flex: 1,
                        minWidth: k === 'y' ? 80 : 60,
                        height: 42,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        borderRadius: theme.radius.md,
                        backgroundColor: theme.colors.cardLight,
                        color: theme.colors.text,
                        paddingHorizontal: 10,
                        fontSize: 14,
                        textAlign: 'center',
                      }}
                    />
                  ))}
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => {
                  const start = parseDateInput(tempStart);
                  const end = parseDateInput(tempEnd);
                  setFilters({ type: tempType, status: tempStatus, startDate: start, endDate: end });
                  setFilterModalOpen(false);
                }}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.accent,
                  paddingVertical: 12,
                  borderRadius: theme.radius.lg,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Terapkan</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setTempType(undefined);
                  setTempStatus(undefined);
                  setTempStart(emptyDateInput());
                  setTempEnd(emptyDateInput());
                  setFilters({ type: undefined, status: undefined, startDate: undefined, endDate: undefined });
                  setFilterModalOpen(false);
                }}
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.cardLight,
                  paddingVertical: 12,
                  borderRadius: theme.radius.lg,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: theme.colors.textSecondary, fontWeight: '700', fontSize: 14 }}>Reset</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
