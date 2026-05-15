import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Card } from '../src/components/ui/Card';
import { EmptyState } from '../src/components/ui/EmptyState';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { SearchBar } from '../src/components/ui/SearchBar';
import { SkeletonCard } from '../src/components/ui/Skeleton';
import { useTheme } from '../src/contexts/ThemeContext';
import { serviceService } from '../src/services/serviceService';
import { Service } from '../src/types';
import { formatCurrency } from '../src/utils/currency';

export default function ServicesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');

  const PAGE_SIZE = 20;

  const load = useCallback(async (offset = 0) => {
    if (offset === 0) {
      setLoading(true);
      setServices([]);
    }
    const data = await serviceService.getAll(search, PAGE_SIZE, offset);
    if (offset === 0) {
      setServices(data);
      setHasMore(data.length === PAGE_SIZE);
    } else {
      setServices((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  }, [search]);

  const handleEndReached = () => {
    if (!loading && hasMore) {
      load(services.length);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load(0);
    }, [load])
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader
        title="Daftar Jasa"
        subtitle={`${services.length} jasa tersedia`}
        showBack
        rightElement={
          <Pressable
            onPress={() => router.push('/service-form')}
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

      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Cari jasa..."
          containerStyle={{ marginHorizontal: 0 }}
        />
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 100,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loading && services.length > 0 ? () => (
            <View style={{ padding: 16 }}>
              <SkeletonCard />
            </View>
          ) : undefined}
          ListEmptyComponent={
            <EmptyState
              icon="construct-outline"
              title="Belum ada jasa"
              description="Tambahkan jasa servis yang sering digunakan."
            />
          }
          renderItem={({ item }) => (
            <Card
              onPress={() =>
                router.push({ pathname: '/service-form', params: { id: item.id } })
              }
              padding="md"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: theme.colors.accent + '18',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="build" size={20} color={theme.colors.accent} />
                </View>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 15,
                    fontWeight: '700',
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  style={{
                    color: theme.colors.accent,
                    fontSize: 15,
                    fontWeight: '700',
                    marginRight: 4,
                  }}
                >
                  {formatCurrency(item.price)}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.textMuted}
                />
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}
