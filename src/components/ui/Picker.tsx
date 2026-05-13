import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { theme } from '../../constants/theme';

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
  const [open, setOpen] = useState(false);

  const displayLabel = (v: string) => optionLabels?.[v] ?? v;
  const valueIcon = optionIcons?.[value];
  const valueColor = optionColors?.[value];

  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: 13,
            marginBottom: 6,
            fontWeight: '600',
          }}
        >
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: theme.colors.cardLight,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          paddingHorizontal: 14,
          minHeight: 54,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {valueIcon ? (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: (valueColor ?? theme.colors.accent) + '25',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={valueIcon}
              size={18}
              color={valueColor ?? theme.colors.accent}
            />
          </View>
        ) : null}
        <Text
          style={{
            color: value ? theme.colors.text : theme.colors.textMuted,
            fontSize: 15,
            fontWeight: value ? '600' : '400',
            flex: 1,
          }}
        >
          {value ? displayLabel(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
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
              paddingBottom: 24,
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
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 4 }}
              renderItem={({ item }) => {
                const active = item === value;
                const icon = optionIcons?.[item];
                const color = optionColors?.[item] ?? theme.colors.accent;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                      paddingHorizontal: 14,
                      minHeight: 60,
                      borderRadius: theme.radius.lg,
                      marginVertical: 3,
                      backgroundColor: active
                        ? color + '15'
                        : pressed
                          ? theme.colors.cardLight
                          : 'transparent',
                      borderWidth: active ? 1.5 : 1,
                      borderColor: active ? color : 'transparent',
                    })}
                  >
                    {icon ? (
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: color + '20',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name={icon} size={18} color={color} />
                      </View>
                    ) : null}
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontSize: 15,
                        fontWeight: active ? '700' : '500',
                        flex: 1,
                      }}
                    >
                      {displayLabel(item)}
                    </Text>
                    {active ? (
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: color,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      </View>
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
