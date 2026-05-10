import React from 'react';
import { Modal, Text, View } from 'react-native';
import { theme } from '../../constants/theme';
import { Button } from './Button';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Batal',
  destructive,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.lg,
            padding: 24,
          }}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 18,
              fontWeight: '700',
              marginBottom: 8,
            }}
          >
            {title}
          </Text>
          {message ? (
            <Text style={{ color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20 }}>
              {message}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <View style={{ flex: 1 }}>
              <Button title={cancelText} variant="outline" onPress={onCancel} fullWidth />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={confirmText}
                variant={destructive ? 'danger' : 'primary'}
                onPress={onConfirm}
                fullWidth
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
