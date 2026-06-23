import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { AdBanner } from '../../src/components/ui/AdBanner';
import { Badge } from '../../src/components/ui/Badge';
import { Card } from '../../src/components/ui/Card';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { SearchBar } from '../../src/components/ui/SearchBar';
import { SkeletonCard } from '../../src/components/ui/Skeleton';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useSparepartStore } from '../../src/store/useSparepartStore';
import { formatCurrency } from '../../src/utils/currency';
import { useTranslation } from '../../src/i18n';

type FilterKey = 'all' | 'low' | 'out' | string;

export default function SparepartsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const t = useTranslation();
  const { spareparts, loading, hasMore, search, setSearch, load, loadMore } = useSparepartStore();
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [tempFilter, setTempFilter] = useState<FilterKey>('all');

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (filterParam === 'low' || filterParam === 'out') setFilter(filterParam);
  }, [filterParam]);

  const handleEndReached = () => {
    loadMore();
  };

  const lowStockCount = spareparts.filter((s) => s.stock > 0 && s.stock <= s.min_stock).length;
  const outStockCount = spareparts.filter((s) => s.stock <= 0).length;

  const categories = useMemo(() => {
    const set = new Set<string>();
    spareparts.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set).sort();
  }, [spareparts]);

  const filtered = useMemo(() => {
    return spareparts.filter((s) => {
      if (filter === 'all') return true;
      if (filter === 'low') return s.stock > 0 && s.stock <= s.min_stock;
      if (filter === 'out') return s.stock <= 0;
      return s.category === filter;
    });
  }, [spareparts, filter]);

  const statusChips: {
    key: FilterKey;
    label: string;
    count?: number;
    color?: string;
    icon: 'apps' | 'warning' | 'close-circle';
  }[] = [
    { key: 'all', label: t.common.all, count: spareparts.length, icon: 'apps' },
    {
      key: 'low',
      label: t.spareparts.lowStock,
      count: lowStockCount,
      color: theme.colors.warning,
      icon: 'warning',
    },
    {
      key: 'out',
      label: t.spareparts.outOfStock,
      count: outStockCount,
      color: theme.colors.danger,
      icon: 'close-circle',
    },
  ];

  const categoryChips = categories.map((c) => ({
    key: c,
    label: c,
    count: spareparts.filter((s) => s.category === c).length,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader
        title={t.spareparts.title}
        subtitle={`${spareparts.length} ${t.spareparts.items}${lowStockCount > 0 ? ` • ⚠️ ${lowStockCount} ${t.spareparts.lowStockWarning}` : ''}`}
        rightElement={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => router.push('/sparepart-import')}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: theme.colors.card,
                borderWidth: 1,
                borderColor: theme.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="document-attach-outline" size={20} color={theme.colors.text} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/sparepart-form')}
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
          </View>
        }
      />

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={t.spareparts.searchPlaceholder}
        rightElement={
          <Pressable
            onPress={() => {
              setTempFilter(filter);
              setFilterModalOpen(true);
            }}
            hitSlop={6}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: filter !== 'all' ? theme.colors.accent + '22' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
              marginLeft: 4,
            })}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={filter !== 'all' ? theme.colors.accent : theme.colors.textMuted}
            />
          </Pressable>
        }
      />

      {/* Active filter chip */}
      {filter !== 'all' && (
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable
              onPress={() => setFilter('all')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: theme.radius.md,
                backgroundColor:
                  (filter === 'low'
                    ? theme.colors.warning
                    : filter === 'out'
                      ? theme.colors.danger
                      : theme.colors.accent) + '18',
                borderWidth: 1,
                borderColor:
                  filter === 'low'
                    ? theme.colors.warning
                    : filter === 'out'
                      ? theme.colors.danger
                      : theme.colors.accent,
              }}
            >
              <Ionicons
                name={
                  filter === 'low'
                    ? 'warning'
                    : filter === 'out'
                      ? 'close-circle'
                      : 'pricetag'
                }
                size={12}
                color={
                  filter === 'low'
                    ? theme.colors.warning
                    : filter === 'out'
                      ? theme.colors.danger
                      : theme.colors.accent
                }
              />
              <Text
                style={{
                  color:
                    filter === 'low'
                      ? theme.colors.warning
                      : filter === 'out'
                        ? theme.colors.danger
                        : theme.colors.accent,
                  fontSize: 11,
                  fontWeight: '700',
                }}
              >
                {filter === 'low'
                  ? 'Stok Menipis'
                  : filter === 'out'
                    ? 'Habis'
                    : filter}
              </Text>
              <Ionicons
                name="close"
                size={12}
                color={
                  filter === 'low'
                    ? theme.colors.warning
                    : filter === 'out'
                      ? theme.colors.danger
                      : theme.colors.accent
                }
              />
            </Pressable>
          </ScrollView>
        </View>
      )}

      {loading && spareparts.length === 0 ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={filtered}
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
              {loading && spareparts.length > 0 && <View style={{ padding: 16 }}><SkeletonCard /></View>}
              <View style={{ marginTop: 8 }}><AdBanner /></View>
            </>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title={filter === 'all' ? t.spareparts.empty : t.spareparts.emptyFilter}
              description={
                filter === 'all'
                  ? t.spareparts.emptyDesc
                  : t.spareparts.emptyFilterDesc
              }
            />
          }
          renderItem={({ item }) => {
            const isOut = item.stock <= 0;
            const isLow = !isOut && item.stock <= item.min_stock;
            const stockColor = isOut
              ? theme.colors.danger
              : isLow
                ? theme.colors.warning
                : theme.colors.success;
            // Stock fill ratio relative to (min_stock * 2) as a healthy benchmark
            const benchmark = Math.max(item.min_stock * 2, 1);
            const fillPct = Math.min(100, Math.round((item.stock / benchmark) * 100));
            return (
              <Card
                onPress={() =>
                  router.push({ pathname: '/sparepart-history', params: { id: item.id } })
                }
                padding="md"
              >
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {/* Icon avatar */}
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      backgroundColor: stockColor + '1F',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: stockColor + '40',
                    }}
                  >
                    <Ionicons name="cube" size={22} color={stockColor} />
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
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                      <Text style={{ color: theme.colors.accent, fontSize: 16, fontWeight: '800' }}>
                        {formatCurrency(item.sell_price)}
                      </Text>
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        gap: 8,
                        marginTop: 6,
                        alignItems: 'center',
                      }}
                    >
                      <Badge label={item.category} variant="info" />
                      {item.brand ? <Badge label={item.brand} variant="neutral" /> : null}
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                        Min: {item.min_stock}
                      </Text>
                      {item.buy_price > 0 ? (() => {
                        const marginPct = Math.round((item.sell_price - item.buy_price) / item.sell_price * 100);
                        const mc = marginPct >= 20 ? theme.colors.success : marginPct >= 10 ? theme.colors.warning : theme.colors.danger;
                        return (
                          <View style={{ backgroundColor: mc + '22', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ color: mc, fontSize: 11, fontWeight: '700' }}>{marginPct}%</Text>
                          </View>
                        );
                      })() : null}
                    </View>

                    {/* Stock progress bar */}
                    <View style={{ marginTop: 10 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          marginBottom: 4,
                        }}
                      >
                        <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                          {t.spareparts.stockLabel}
                        </Text>
                        <Text style={{ color: stockColor, fontSize: 12, fontWeight: '800' }}>
                          {isOut ? t.spareparts.outLabel : `${item.stock} ${t.common.pieces}`}
                        </Text>
                      </View>
                      <View
                        style={{
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: theme.colors.cardLight,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            width: `${fillPct}%`,
                            height: '100%',
                            backgroundColor: stockColor,
                            borderRadius: 3,
                          }}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Filter Modal */}
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
          <View
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
              {t.spareparts.filterTitle}
            </Text>

            {/* Status */}
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
              {t.spareparts.stockStatus}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {statusChips.map((chip) => {
                const active = tempFilter === chip.key;
                return (
                  <Pressable
                    key={chip.key}
                    onPress={() => setTempFilter(chip.key)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 10,
                      borderRadius: theme.radius.lg,
                      backgroundColor: active ? (chip.color ?? theme.colors.primary) : theme.colors.cardLight,
                      borderWidth: 1,
                      borderColor: active ? (chip.color ?? theme.colors.primary) : theme.colors.border,
                    }}
                  >
                    <Ionicons
                      name={chip.icon}
                      size={14}
                      color={active ? '#fff' : theme.colors.textSecondary}
                    />
                    <Text
                      style={{
                        color: active ? '#fff' : theme.colors.text,
                        fontSize: 12,
                        fontWeight: '600',
                      }}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Categories */}
            {categoryChips.length > 0 && (
              <>
                <Text
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: 12,
                    fontWeight: '600',
                    marginBottom: 8,
                  }}
                >
                  {t.spareparts.category}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {categoryChips.map((chip) => {
                    const active = tempFilter === chip.key;
                    return (
                      <Pressable
                        key={chip.key}
                        onPress={() => setTempFilter(chip.key)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: theme.radius.lg,
                          backgroundColor: active ? theme.colors.accent : theme.colors.cardLight,
                          borderWidth: 1,
                          borderColor: active ? theme.colors.accent : theme.colors.border,
                        }}
                      >
                        <Text
                          style={{
                            color: active ? '#fff' : theme.colors.text,
                            fontSize: 12,
                            fontWeight: '600',
                          }}
                        >
                          {chip.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => {
                  setFilter(tempFilter);
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
                  setTempFilter('all');
                  setFilter('all');
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
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
