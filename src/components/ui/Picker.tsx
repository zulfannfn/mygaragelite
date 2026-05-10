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
}

export function Picker<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Pilih...',
}: Props<T>) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginBottom: 12 }}>
      {label ? (
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: 13,
            marginBottom: 6,
            fontWeight: '500',
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
          justifyContent: 'space-between',
          backgroundColor: theme.colors.cardLight,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          paddingHorizontal: 12,
          paddingVertical: 14,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text
          style={{
            color: value ? theme.colors.text : theme.colors.textMuted,
            fontSize: 15,
          }}
        >
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.lg,
              maxHeight: '70%',
              overflow: 'hidden',
            }}
          >
            {label ? (
              <View
                style={{
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                }}
              >
                <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>
                  {label}
                </Text>
              </View>
            ) : null}
            <FlatList
              data={options as T[]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    backgroundColor: pressed ? theme.colors.cardLight : 'transparent',
                  })}
                >
                  <Text style={{ color: theme.colors.text, fontSize: 15 }}>{item}</Text>
                  {item === value ? (
                    <Ionicons name="checkmark" size={20} color={theme.colors.accent} />
                  ) : null}
                </Pressable>
              )}
              ItemSeparatorComponent={() => (
                <View style={{ height: 1, backgroundColor: theme.colors.divider }} />
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
