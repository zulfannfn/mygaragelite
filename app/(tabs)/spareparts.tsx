import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { Badge } from '../../src/components/ui/Badge';
import { Card } from '../../src/components/ui/Card';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { FilterChip } from '../../src/components/ui/FilterChip';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { SearchBar } from '../../src/components/ui/SearchBar';
import { SkeletonCard } from '../../src/components/ui/Skeleton';
import { theme } from '../../src/constants/theme';
import { useSparepartStore } from '../../src/store/useSparepartStore';
import { formatCurrency } from '../../src/utils/currency';

type FilterKey = 'all' | 'low' | 'out' | string;

export default function SparepartsScreen() {
  const router = useRouter();
  const { spareparts, loading, search, setSearch, load } = useSparepartStore();
  const [filter, setFilter] = useState<FilterKey>('all');

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
    { key: 'all', label: 'Semua', count: spareparts.length, icon: 'apps' },
    {
      key: 'low',
      label: 'Stok Menipis',
      count: lowStockCount,
      color: theme.colors.warning,
      icon: 'warning',
    },
    {
      key: 'out',
      label: 'Habis',
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

  const isStatusFilter = filter === 'all' || filter === 'low' || filter === 'out';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader
        title="Sparepart"
        subtitle={`${spareparts.length} item${lowStockCount > 0 ? ` • ⚠️ ${lowStockCount} stok menipis` : ''}`}
        rightElement={
          <Pressable
            onPress={() => router.push('/sparepart-form')}
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
        }
      />

      <SearchBar value={search} onChangeText={setSearch} placeholder="Cari sparepart..." />

      {/* Status filter row */}
      <View style={{ height: 52 }}>
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
          {statusChips.map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              icon={chip.icon}
              count={chip.count}
              color={chip.color}
              active={filter === chip.key}
              onPress={() => setFilter(chip.key)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Category filter row (only show if there are categories) */}
      {categoryChips.length > 0 && (
        <View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 18,
              marginTop: 4,
              marginBottom: 2,
            }}
          >
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 1,
              }}
            >
              KATEGORI
            </Text>
            {!isStatusFilter ? (
              <Pressable onPress={() => setFilter('all')} hitSlop={8}>
                <Text
                  style={{
                    color: theme.colors.accent,
                    fontSize: 11,
                    fontWeight: '700',
                  }}
                >
                  Reset
                </Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ height: 48, marginBottom: 4 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingVertical: 6,
                gap: 8,
                alignItems: 'center',
              }}
            >
              {categoryChips.map((chip) => (
                <FilterChip
                  key={chip.key}
                  label={chip.label}
                  count={chip.count}
                  active={filter === chip.key}
                  onPress={() => setFilter(chip.key)}
                />
              ))}
            </ScrollView>
          </View>
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
            paddingBottom: 100,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title={filter === 'all' ? 'Belum ada sparepart' : 'Tidak ada item di filter ini'}
              description={
                filter === 'all'
                  ? 'Tambahkan sparepart untuk mulai mengelola stok.'
                  : 'Coba pilih filter lain atau tambahkan sparepart baru.'
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
                  router.push({ pathname: '/sparepart-form', params: { id: item.id } })
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
                      <Text
                        style={{
                          color: theme.colors.accent,
                          fontSize: 16,
                          fontWeight: '800',
                        }}
                      >
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
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                        Min: {item.min_stock}
                      </Text>
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
                          STOK
                        </Text>
                        <Text style={{ color: stockColor, fontSize: 12, fontWeight: '800' }}>
                          {isOut ? 'HABIS' : `${item.stock} pcs`}
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
    </View>
  );
}
