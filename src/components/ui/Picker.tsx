import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { Card } from './Card';

interface Props<T extends string> {
  label?: string;
  value: T;
  options: readonly T[] | T[];
  onChange: (v: T) => void;
  placeholder?: string;
  /** Optional map of option value -> display label (for status etc.) */
  optionLabels?: Record<string, string>;
  /** Optional map of option value -> Ionicons name */
  optionIcons?: Record<string, keyof typeof Ionicons.glyphMap>;
  /** Optional map of option value -> color (for status indicator) */
  optionColors?: Record<string, string>;
}

export function Picker<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Pilih...',
  optionLabels,
  optionIcons,
  optionColors,
}: Props<T>) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const displayLabel = (v: string) => optionLabels?.[v] ?? v;
  const valueIcon = optionIcons?.[value];
  const valueColor = optionColors?.[value];

  return (
    <View>
      {label ? (
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: 13,
            marginBottom: 8,
            fontWeight: '600',
          }}
        >
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          backgroundColor: theme.colors.cardLight,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          paddingHorizontal: 12,
          paddingVertical: 8,
          minHeight: 40,
          width: '100%',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 36, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            {valueIcon ? (
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: (valueColor ?? theme.colors.accent) + '18',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={valueIcon}
                  size={16}
                  color={valueColor ?? theme.colors.accent}
                />
              </View>
            ) : (
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: theme.colors.borderLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="person" size={16} color={theme.colors.textSecondary} />
              </View>
            )}
          </View>
          <Text
            style={{
              color: value ? theme.colors.text : theme.colors.textMuted,
              fontSize: 15,
              fontWeight: value ? '600' : '400',
              flex: 1,
              marginRight: 12,
            }}
            numberOfLines={1}
          >
            {value ? displayLabel(value) : placeholder}
          </Text>
          <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
        </View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
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
              paddingBottom: Math.max(20, insets.bottom + 12),
              maxHeight: '80%',
            }}
          >
            {/* Drag handle */}
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
            {label ? (
              <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 18,
                    fontWeight: '800',
                  }}
                >
                  {label}
                </Text>
              </View>
            ) : null}
            <FlatList
              data={options as T[]}
              keyExtractor={(item) => item}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4, gap: 8 }}
              renderItem={({ item }) => {
                const active = item === value;
                const icon = optionIcons?.[item];
                const color = optionColors?.[item] ?? theme.colors.accent;
                return (
                  <Card
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    style={{
                      borderColor: active ? color + '40' : theme.colors.border,
                      borderWidth: active ? 1.5 : 1,
                    }}
                    padding="sm"
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                      {icon ? (
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            backgroundColor: color + '18',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                          }}
                        >
                          <Ionicons name={icon} size={18} color={color} />
                        </View>
                      ) : (
                        <View style={{ width: 40, marginRight: 12 }} />
                      )}
                      <Text
                        style={{
                          color: theme.colors.text,
                          fontSize: 15,
                          fontWeight: active ? '700' : '500',
                          flex: 1,
                          marginRight: 12,
                        }}
                        numberOfLines={1}
                      >
                        {displayLabel(item)}
                      </Text>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={22} color={color} />
                      ) : (
                        <View style={{ width: 22 }} />
                      )}
                    </View>
                  </Card>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
