import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/ui/Button';
import { theme } from '../src/constants/theme';
import { useTranslation } from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';

const { width } = Dimensions.get('window');

export default function Onboarding() {
  const router = useRouter();
  const t = useTranslation();
  const setOnboardingDone = useAppStore((s) => s.setOnboardingDone);
  const [index, setIndex] = useState(0);
  const ref = useRef<FlatList>(null);

  const slides = [
    {
      icon: 'speedometer-outline' as const,
      title: t.onboarding.welcomeTitle,
      desc: t.onboarding.welcomeDesc,
      color: theme.colors.accent,
    },
    {
      icon: 'people-outline' as const,
      title: t.onboarding.slide2Title,
      desc: t.onboarding.slide2Desc,
      color: theme.colors.blue,
    },
    {
      icon: 'analytics-outline' as const,
      title: t.onboarding.slide3Title,
      desc: t.onboarding.slide3Desc,
      color: theme.colors.success,
    },
  ];

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(i);
  };

  const finish = async () => {
    await setOnboardingDone(true);
    router.replace('/(tabs)');
  };

  const next = () => {
    if (index < slides.length - 1) {
      ref.current?.scrollToIndex({ index: index + 1 });
    } else {
      finish();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        ref={ref}
        data={slides}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item }) => (
          <View
            style={{
              width,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
            }}
          >
            <View
              style={{
                width: 140,
                height: 140,
                borderRadius: 70,
                backgroundColor: item.color + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 32,
              }}
            >
              <Ionicons name={item.icon} size={70} color={item.color} />
            </View>
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 24,
                fontWeight: '800',
                textAlign: 'center',
                marginBottom: 12,
              }}
            >
              {item.title}
            </Text>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: 15,
                textAlign: 'center',
                lineHeight: 22,
              }}
            >
              {item.desc}
            </Text>
          </View>
        )}
      />

      {/* Pagination */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 8,
          marginVertical: 16,
        }}
      >
        {slides.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === index ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === index ? theme.colors.accent : theme.colors.border,
            }}
          />
        ))}
      </View>

      <View style={{ padding: 24, paddingBottom: 32, gap: 10 }}>
        <Button
          title={index === slides.length - 1 ? t.onboarding.startNow : t.common.next}
          onPress={next}
          size="lg"
          fullWidth
        />
        {index < slides.length - 1 && (
          <Button title={t.common.skip} variant="ghost" onPress={finish} fullWidth />
        )}
      </View>
    </SafeAreaView>
  );
}
