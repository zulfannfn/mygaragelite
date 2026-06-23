import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { AdBanner } from '../../src/components/ui/AdBanner';
import { Badge } from '../../src/components/ui/Badge';
import { Card } from '../../src/components/ui/Card';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { SearchBar } from '../../src/components/ui/SearchBar';
import { SkeletonCard } from '../../src/components/ui/Skeleton';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useTranslation } from '../../src/i18n';
import { exportService } from '../../src/services/exportService';
import { useAppStore } from '../../src/store/useAppStore';
import { useTransactionStore } from '../../src/store/useTransactionStore';
import { TransactionStatus, TransactionType } from '../../src/types';
import { checkOnline } from '../../src/utils/network';
import { formatCompactCurrency } from '../../src/utils/currency';
import { endOfDay, endOfMonth, endOfYear, formatDate, formatDuration, startOfDay, startOfMonth, startOfYear } from '../../src/utils/date';

const STATUS_FILTERS: {
  label: string;
  value?: TransactionStatus;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
}[] = [
  { label: 'Semua', icon: 'apps' },
  { label: 'Lunas', value: 'paid', icon: 'checkmark-circle', color: '#00C896' },
  { label: 'Dikerjakan', value: 'in_progress', icon: 'construct', color: '#FF6B35' },
  { label: 'Antrian', value: 'pending', icon: 'time', color: '#FFB800' },
  { label: 'Menunggu Bayar', value: 'waiting_payment', icon: 'cash', color: '#A855F7' },
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

export default function TransactionsScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const { theme } = useTheme();
  const t = useTranslation();
  const { transactions, loading, hasMore, filters, setFilters, load, loadMore } = useTransactionStore();
  const offlineTxCount = useAppStore((s) => s.offlineTxCount);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [tempType, setTempType] = useState<TransactionType | undefined>(undefined);
  const [tempStatus, setTempStatus] = useState<TransactionStatus | undefined>(undefined);
  const [tempStart, setTempStart] = useState<number | undefined>(undefined);
  const [tempEnd, setTempEnd] = useState<number | undefined>(undefined);
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end' | null>(null);

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
      showToast(t.transactions.exportSuccess, 'success');
    } catch {
      showToast(t.transactions.exportFailed, 'error');
    }
  };

  const OFFLINE_TX_LIMIT = 5;
  const handleNewTransaction = async () => {
    const online = await checkOnline();
    if (!online && offlineTxCount >= OFFLINE_TX_LIMIT) {
      Alert.alert(
        'Koneksi Internet Diperlukan',
        'Dibutuhkan koneksi internet untuk melanjutkan transaksi.',
        [{ text: 'OK' }]
      );
      return;
    }
    router.push('/transaction-form');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader
        title={t.transactions.title}
        subtitle={`${transactions.length} ${t.transactions.title.toLowerCase()} • ${formatCompactCurrency(totalRevenue)}`}
        rightElement={
          <Pressable
            onPress={handleNewTransaction}
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
        placeholder={t.transactions.searchPlaceholder}
        rightElement={
          <Pressable
            onPress={() => {
              setTempType(filters.type);
              setTempStatus(filters.status);
              setTempStart(filters.startDate);
              setTempEnd(filters.endDate);
              setDatePickerTarget(null);
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
            {filters.status && (() => {
              const sf = STATUS_FILTERS.find((f) => f.value === filters.status);
              const chipColor = sf?.color ?? theme.colors.accent;
              const chipLabel = sf?.label ?? filters.status;
              const chipIcon = sf?.icon ?? 'ellipse';
              return (
                <Pressable
                  onPress={() => setFilters({ status: undefined })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: theme.radius.md,
                    backgroundColor: chipColor + '18',
                    borderWidth: 1,
                    borderColor: chipColor,
                  }}
                >
                  <Ionicons name={chipIcon} size={12} color={chipColor} />
                  <Text style={{ color: chipColor, fontSize: 11, fontWeight: '700' }}>{chipLabel}</Text>
                  <Ionicons name="close" size={12} color={chipColor} />
                </Pressable>
              );
            })()}
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
          ListFooterComponent={() => (
            <>
              {loading && transactions.length > 0 && <View style={{ padding: 16 }}><SkeletonCard /></View>}
              <View style={{ marginTop: 8 }}><AdBanner /></View>
            </>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title={t.transactions.empty}
              description={t.transactions.emptyDesc}
            />
          }
          renderItem={({ item }) => {
            const statusVariant =
              item.status === 'paid'
                ? 'success'
                : item.status === 'in_progress'
                  ? 'info'
                  : item.status === 'waiting_payment'
                    ? 'accent'
                    : item.status === 'pending'
                      ? 'warning'
                      : 'danger';
            const statusLabel =
              item.status === 'paid'
                ? 'Lunas'
                : item.status === 'in_progress'
                  ? 'Dikerjakan'
                  : item.status === 'waiting_payment'
                    ? 'Menunggu Bayar'
                    : item.status === 'pending'
                      ? 'Antrian'
                      : 'Batal';
            const statusColor =
              item.status === 'paid'
                ? theme.colors.success
                : item.status === 'in_progress'
                  ? theme.colors.accent
                  : item.status === 'waiting_payment'
                    ? '#A855F7'
                    : item.status === 'pending'
                      ? theme.colors.warning
                      : theme.colors.danger;
            const initial = (item.customer_name ?? '?').charAt(0).toUpperCase();
            const typeColor = item.type === 'service' ? '#FF6B35' : '#00C896';
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
                        <View
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 5,
                            backgroundColor: typeColor,
                          }}
                        />
                        <Text
                          style={{
                            color: theme.colors.text,
                            fontSize: 15,
                            fontWeight: '700',
                            flex: 1,
                          }}
                          numberOfLines={1}
                        >
                          {item.customer_name ?? t.dashboard.noCustomer}
                        </Text>
                      </View>
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
                    </View>

                    {/* Petugas: mekanik & kasir */}
                    {((item.mechanic_name && item.type !== 'retail') || item.cashier_name) ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 12,
                          marginTop: 6,
                          flexWrap: 'wrap',
                          alignItems: 'center',
                        }}
                      >
                        {item.mechanic_name && item.type !== 'retail' ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Ionicons name="construct" size={11} color={theme.colors.textMuted} />
                            <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                              {item.mechanic_name}
                            </Text>
                          </View>
                        ) : null}
                        {item.cashier_name ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Ionicons name="person" size={11} color={theme.colors.textMuted} />
                            <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                              {item.cashier_name}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginTop: 6,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="calendar-outline" size={11} color={theme.colors.textMuted} />
                        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                          {formatDate(item.created_at)}
                        </Text>
                      </View>
                      {item.type === 'service' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons
                            name={item.status === 'paid' ? 'timer-outline' : 'time-outline'}
                            size={11}
                            color={item.status === 'paid' ? theme.colors.textMuted : theme.colors.warning}
                          />
                          <Text
                            style={{
                              color: item.status === 'paid' ? theme.colors.textMuted : theme.colors.warning,
                              fontSize: 11,
                              fontWeight: '600',
                            }}
                          >
                            {formatDuration(item.created_at, item.status === 'paid' ? item.updated_at : Date.now())}
                          </Text>
                        </View>
                      ) : null}
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
              {t.transactions.filterTitle}
            </Text>

            {/* Type filter */}
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
              {t.transactions.transactionType}
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
              {t.transactions.status}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {STATUS_FILTERS.map((f) => {
                const active = tempStatus === f.value;
                return (
                  <Pressable
                    key={f.label}
                    onPress={() => setTempStatus(f.value)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      minWidth: '46%',
                      flex: 1,
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
            <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700', marginBottom: 10 }}>
              {t.transactions.dateRange}
            </Text>

            {/* Preset chips */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {[
                { label: 'Hari ini', start: startOfDay(), end: endOfDay() },
                { label: 'Bulan ini', start: startOfMonth(), end: endOfMonth() },
                { label: 'Tahun ini', start: startOfYear(), end: endOfYear() },
              ].map((p) => {
                const active = tempStart === p.start && tempEnd === p.end;
                return (
                  <Pressable
                    key={p.label}
                    onPress={() => { setTempStart(p.start); setTempEnd(p.end); }}
                    style={{
                      flex: 1, paddingVertical: 7, borderRadius: theme.radius.md, alignItems: 'center',
                      backgroundColor: active ? theme.colors.accent : theme.colors.cardLight,
                      borderWidth: 1, borderColor: active ? theme.colors.accent : theme.colors.border,
                    }}
                  >
                    <Text style={{ color: active ? '#fff' : theme.colors.text, fontSize: 11, fontWeight: '600' }}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Date buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <Pressable
                onPress={() => setDatePickerTarget('start')}
                style={({ pressed }) => ({
                  flex: 1, height: 44, borderRadius: theme.radius.md,
                  backgroundColor: datePickerTarget === 'start' ? theme.colors.accent + '18' : theme.colors.cardLight,
                  borderWidth: 1, borderColor: datePickerTarget === 'start' ? theme.colors.accent : theme.colors.border,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: tempStart ? theme.colors.text : theme.colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                  {t.transactions.from}
                </Text>
                <Text style={{ color: tempStart ? theme.colors.accent : theme.colors.textMuted, fontSize: 12 }}>
                  {tempStart ? formatDate(tempStart) : 'Pilih'}
                </Text>
              </Pressable>
              <View style={{ width: 1, backgroundColor: theme.colors.divider, alignSelf: 'center', height: 28 }} />
              <Pressable
                onPress={() => setDatePickerTarget('end')}
                style={({ pressed }) => ({
                  flex: 1, height: 44, borderRadius: theme.radius.md,
                  backgroundColor: datePickerTarget === 'end' ? theme.colors.accent + '18' : theme.colors.cardLight,
                  borderWidth: 1, borderColor: datePickerTarget === 'end' ? theme.colors.accent : theme.colors.border,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: tempEnd ? theme.colors.text : theme.colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                  {t.transactions.to}
                </Text>
                <Text style={{ color: tempEnd ? theme.colors.accent : theme.colors.textMuted, fontSize: 12 }}>
                  {tempEnd ? formatDate(tempEnd) : 'Pilih'}
                </Text>
              </Pressable>
            </View>

            {/* iOS inline date picker */}
            {Platform.OS === 'ios' && datePickerTarget !== null && (
              <View style={{ marginBottom: 8 }}>
                <DateTimePicker
                  value={datePickerTarget === 'start' ? new Date(tempStart ?? Date.now()) : new Date(tempEnd ?? Date.now())}
                  mode="date"
                  display="spinner"
                  onChange={(_, date) => {
                    if (!date) return;
                    if (datePickerTarget === 'start') {
                      const d = new Date(date); d.setHours(0, 0, 0, 0);
                      setTempStart(d.getTime());
                    } else {
                      const d = new Date(date); d.setHours(23, 59, 59, 999);
                      setTempEnd(d.getTime());
                    }
                  }}
                  style={{ height: 130 }}
                />
                <Pressable
                  onPress={() => setDatePickerTarget(null)}
                  style={{ alignItems: 'center', paddingVertical: 8 }}
                >
                  <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 14 }}>Selesai</Text>
                </Pressable>
              </View>
            )}

            {/* Android native date picker (shows as system dialog) */}
            {Platform.OS === 'android' && datePickerTarget !== null && (
              <DateTimePicker
                value={datePickerTarget === 'start' ? new Date(tempStart ?? Date.now()) : new Date(tempEnd ?? Date.now())}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setDatePickerTarget(null);
                  if (event.type === 'set' && date) {
                    if (datePickerTarget === 'start') {
                      const d = new Date(date); d.setHours(0, 0, 0, 0);
                      setTempStart(d.getTime());
                    } else {
                      const d = new Date(date); d.setHours(23, 59, 59, 999);
                      setTempEnd(d.getTime());
                    }
                  }
                }}
              />
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => {
                  setFilters({ type: tempType, status: tempStatus, startDate: tempStart, endDate: tempEnd });
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
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{t.common.apply}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setTempType(undefined);
                  setTempStatus(undefined);
                  setTempStart(undefined);
                  setTempEnd(undefined);
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
                <Text style={{ color: theme.colors.textSecondary, fontWeight: '700', fontSize: 14 }}>{t.common.reset}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
