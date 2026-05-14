import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { theme } from '../../constants/theme';

interface Props {
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  rightElement?: React.ReactNode;
}

export function SearchBar({ value, onChangeText, placeholder = 'Cari...', rightElement }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.md,
        paddingHorizontal: 14,
        marginHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Ionicons name="search" size={18} color={theme.colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={{
          flex: 1,
          color: theme.colors.text,
          paddingVertical: 12,
          paddingHorizontal: 10,
          fontSize: 15,
        }}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
        </Pressable>
      )}
      {rightElement}
    </View>
  );
}
