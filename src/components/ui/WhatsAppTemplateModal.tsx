import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { receiptService } from '../../services/receiptService';
import { Transaction } from '../../types';
import { Button } from './Button';

type TemplateKey = 'created' | 'ready' | 'paid';

interface Props {
  visible: boolean;
  tx: Transaction | null;
  onClose: () => void;
  onSent?: () => void;
  onError?: (msg: string) => void;
}

export function WhatsAppTemplateModal({
  visible,
  tx,
  onClose,
  onSent,
  onError,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<TemplateKey | null>(null);
  const [busy, setBusy] = useState(false);
  const isRetail = tx?.type === 'retail';

  const TEMPLATES = [
    {
      key: 'created' as TemplateKey,
      title: 'Servis Diterima',
      desc: 'Pemberitahuan kendaraan diterima & sedang dikerjakan',
      icon: 'construct' as const,
      color: theme.colors.info,
    },
    {
      key: 'ready' as TemplateKey,
      title: 'Selesai + Tagihan',
      desc: 'Servis selesai, kendaraan siap diambil & tagihan',
      icon: 'cash' as const,
      color: theme.colors.warning,
    },
    {
      key: 'paid' as TemplateKey,
      title: 'Selesai + Lunas',
      desc: 'Struk lengkap, transaksi sudah dibayar',
      icon: 'checkmark-circle' as const,
      color: theme.colors.success,
    },
  ];

  const send = async () => {
    if (!tx || (!isRetail && !selected)) return;
    setBusy(true);
    try {
      if (isRetail) {
        const r = await receiptService.sendWhatsApp(tx);
        if (!r.ok) {
          onError?.(r.reason ?? 'Gagal kirim WA');
        } else {
          onSent?.();
          onClose();
        }
      } else {
        const text =
          selected === 'created'
            ? await receiptService.buildWaCreated(tx)
            : selected === 'ready'
              ? await receiptService.buildWaReady(tx)
              : await receiptService.buildWaPaid(tx);
        const r = await receiptService.sendWhatsAppText(tx.customer_phone ?? '', text);
        if (!r.ok) {
          onError?.(r.reason ?? 'Gagal kirim WA');
        } else {
          onSent?.();
          onClose();
          setSelected(null);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setSelected(null);
    onClose();
  };

  const noPhone = !tx?.customer_phone;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <Pressable
        onPress={close}
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
            paddingBottom: Math.max(28, insets.bottom + 16),
            maxHeight: '90%',
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

          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
              {isRetail ? 'Kirim Struk Pembelian' : 'Kirim ke WhatsApp'}
            </Text>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: 13,
                marginTop: 4,
              }}
            >
              {isRetail
                ? 'Kirim struk transaksi retail ke WhatsApp pelanggan'
                : 'Pilih template pesan untuk pelanggan'}
            </Text>
          </View>

          {noPhone ? (
            <View style={{ paddingHorizontal: 20, paddingVertical: 24 }}>
              <View
                style={{
                  backgroundColor: theme.colors.danger + '15',
                  borderRadius: theme.radius.lg,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Ionicons
                  name="alert-circle"
                  size={24}
                  color={theme.colors.danger}
                />
                <Text style={{ color: theme.colors.danger, flex: 1, fontSize: 14, lineHeight: 20 }}>
                  Pelanggan belum punya nomor HP. Tambahkan dulu di data pelanggan.
                </Text>
              </View>
              <Button
                title="Tutup"
                variant="ghost"
                fullWidth
                onPress={close}
                style={{ marginTop: 16 }}
              />
            </View>
          ) : isRetail ? (
            <>
              <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
                <View
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: theme.radius.lg,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: theme.colors.success + '25',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="receipt" size={24} color={theme.colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontSize: 15,
                        fontWeight: '700',
                      }}
                    >
                      Struk Pembelian
                    </Text>
                    <Text
                      style={{
                        color: theme.colors.textSecondary,
                        fontSize: 13,
                        marginTop: 2,
                        lineHeight: 18,
                      }}
                    >
                      Detail transaksi akan dikirim ke WhatsApp pelanggan
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 10 }}>
                <Button
                  title="Kirim via WhatsApp"
                  variant="success"
                  size="lg"
                  fullWidth
                  loading={busy}
                  onPress={send}
                  icon={<Ionicons name="logo-whatsapp" size={20} color="#fff" />}
                />
                <Button title="Batal" variant="ghost" fullWidth onPress={close} />
              </View>
            </>
          ) : (
            <>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                {TEMPLATES.filter((tpl) => {
                  if (tx?.status === 'paid') {
                    return tpl.key === 'paid';
                  }
                  return tpl.key !== 'paid';
                }).map((tpl) => {
                  const active = selected === tpl.key;
                  return (
                    <Pressable
                      key={tpl.key}
                      onPress={() => setSelected(tpl.key)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 16,
                        padding: 16,
                        marginBottom: 12,
                        borderRadius: theme.radius.lg,
                        backgroundColor: active
                          ? tpl.color + '18'
                          : theme.colors.card,
                        borderWidth: 2,
                        borderColor: active ? tpl.color : theme.colors.border,
                        opacity: pressed ? 0.85 : 1,
                        minHeight: 76,
                      })}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          backgroundColor: tpl.color + '25',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name={tpl.icon} size={24} color={tpl.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: theme.colors.text,
                            fontSize: 16,
                            fontWeight: '700',
                          }}
                        >
                          {tpl.title}
                        </Text>
                        <Text
                          style={{
                            color: theme.colors.textSecondary,
                            fontSize: 13,
                            marginTop: 3,
                            lineHeight: 18,
                          }}
                        >
                          {tpl.desc}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: active ? tpl.color : theme.colors.borderLight,
                          backgroundColor: active ? tpl.color : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {active ? (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 10 }}>
                <Button
                  title="Buka WhatsApp"
                  variant="success"
                  size="lg"
                  fullWidth
                  loading={busy}
                  disabled={!selected}
                  onPress={send}
                  icon={<Ionicons name="logo-whatsapp" size={20} color="#fff" />}
                />
                <Button title="Batal" variant="ghost" fullWidth onPress={close} />
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
