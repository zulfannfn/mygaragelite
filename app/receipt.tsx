import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { theme } from '../src/constants/theme';
import { receiptService } from '../src/services/receiptService';
import { settingsService } from '../src/services/settingsService';
import { transactionService } from '../src/services/transactionService';
import { useAppStore } from '../src/store/useAppStore';
import { Transaction } from '../src/types';
import { formatCurrency } from '../src/utils/currency';
import { formatDateTime } from '../src/utils/date';

type ReceiptType = 'tagihan' | 'diterima';

export default function ReceiptPage() {
  const router = useRouter();
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [shop, setShop] = useState({ name: '', address: '', phone: '' });
  const [printing, setPrinting] = useState(false);
  const receiptType = (type as ReceiptType) || 'tagihan';
  const connectedPrinter = useAppStore((s) => s.connectedPrinter);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!id) return;
    transactionService.getById(id).then((data) => {
       setTx(data);
       // Auto-print saat halaman struk dibuka
       if (data && connectedPrinter) {
         handlePrint(data);
       }
    });
    settingsService.getAll().then((s) =>
      setShop({
        name: s.workshop_name ?? 'MyGarage Bengkel',
        address: s.workshop_address ?? '',
        phone: s.workshop_phone ?? '',
      })
    );
  }, [id]);

  const handlePrint = async (targetTx = tx) => {
    if (!targetTx || printing) return;
    setPrinting(true);
    try {
      await receiptService.printPdf(targetTx, receiptType);
      if (connectedPrinter) {
        Alert.alert('Berhasil', 'Struk berhasil dikirim ke printer!');
      }
    } catch (e: any) {
      Alert.alert('Gagal Cetak', e?.message ?? 'Terjadi kesalahan saat mencetak.');
    } finally {
      setPrinting(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  if (!tx) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#f2f2f2',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#888' }}>Memuat struk...</Text>
      </View>
    );
  }

  const isPaid = tx.status === 'paid';
  const isRetail = tx.type === 'retail';
  const shortId = tx.id.slice(0, 8).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: '#f2f2f2' }}>
      <ScrollView
        contentContainerStyle={{
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 48,
          paddingBottom: 100 + insets.bottom,
        }}
      >
        {/* Receipt Paper */}
        <View
          style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: '#fff',
            padding: 20,
            borderRadius: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          {/* Shop Header */}
          <View style={{ alignItems: 'center', marginBottom: 14 }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '800',
                color: '#222',
                letterSpacing: 0.5,
              }}
            >
              {shop.name}
            </Text>
            {shop.address ? (
              <Text style={{ fontSize: 12, color: '#666', marginTop: 2, textAlign: 'center' }}>
                {shop.address}
              </Text>
            ) : null}
            {shop.phone ? (
              <Text style={{ fontSize: 12, color: '#666', marginTop: 1 }}>
                Telp: {shop.phone}
              </Text>
            ) : null}
          </View>

          {/* Dashed line */}
          <View style={dashedLine} />

          {/* Transaction Info */}
          <View style={{ marginVertical: 10 }}>
            <InfoRow label="No" value={shortId} />
            <InfoRow label="Tgl" value={formatDateTime(tx.created_at)} />
            <InfoRow label="Pelanggan" value={tx.customer_name ?? '-'} />
            {tx.customer_plate ? (
              <InfoRow label="Plat" value={tx.customer_plate} />
            ) : null}
            {tx.mechanic_name && !isRetail ? (
              <InfoRow label="Mekanik" value={tx.mechanic_name} />
            ) : null}
          </View>

          {/* Dashed line */}
          <View style={dashedLine} />

          {/* Keluhan */}
          {tx.complaint && tx.complaint.trim() && !isRetail ? (
            <View style={{ marginVertical: 10 }}>
              <Text style={sectionTitle}>KELUHAN</Text>
              <Text style={{ fontSize: 13, color: '#333', lineHeight: 18, marginTop: 4 }}>
                {tx.complaint}
              </Text>
            </View>
          ) : null}

          {/* Services */}
          {tx.service_items && tx.service_items.length > 0 && !isRetail ? (
            <View style={{ marginVertical: 10 }}>
              <Text style={sectionTitle}>JASA SERVIS</Text>
              {tx.service_items.map((s) => (
                <View
                  key={s.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: 5,
                  }}
                >
                  <Text style={{ fontSize: 13, color: '#333', flex: 1, paddingRight: 8 }}>
                    {s.service_name}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#333', fontWeight: '600' }}>
                    {formatCurrency(s.price)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Spareparts */}
          {tx.spareparts && tx.spareparts.length > 0 ? (
            <View style={{ marginVertical: 10 }}>
              <Text style={sectionTitle}>SPAREPART</Text>
              {tx.spareparts.map((p) => (
                <View
                  key={p.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: 5,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontSize: 13, color: '#333' }}>
                      {p.sparepart_name}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#888' }}>
                      {formatCurrency(p.sell_price)} × {p.quantity}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, color: '#333', fontWeight: '600' }}>
                    {formatCurrency(p.sell_price * p.quantity)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Dashed line */}
          <View style={dashedLine} />

          {/* Totals */}
          {receiptType === 'tagihan' && (
            <View style={{ marginVertical: 10 }}>
              {isPaid && !isRetail && tx.service_items && tx.service_items.length > 0 ? (
                <TotalRow label="Subtotal Jasa" value={formatCurrency(tx.total_service)} />
              ) : null}
              {isPaid && tx.spareparts && tx.spareparts.length > 0 ? (
                <TotalRow label="Subtotal Sparepart" value={formatCurrency(tx.total_sparepart)} />
              ) : null}
              <TotalRow label="TOTAL" value={formatCurrency(tx.total_amount)} bold large />
              {isPaid && tx.payment_method ? (
                <TotalRow label={`Bayar (${tx.payment_method})`} value={formatCurrency(isRetail && tx.payment_method === 'Tunai' ? tx.paid_amount : tx.total_amount)} />
              ) : null}
              {isPaid && isRetail && tx.payment_method === 'Tunai' ? (
                <TotalRow label="Kembali" value={formatCurrency(tx.change_amount)} />
              ) : null}
            </View>
          )}

          {/* Dashed line */}

          {/* Status */}
          <View style={{ alignItems: 'center', marginVertical: 10 }}>
            <View
              style={{
                backgroundColor: receiptType === 'diterima' ? theme.colors.accent + '22' : (isPaid ? '#00C89622' : '#FFB80022'),
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '800',
                  color: receiptType === 'diterima' ? theme.colors.accent : (isPaid ? '#00865f' : '#a07700'),
                  letterSpacing: 1,
                }}
              >
                {receiptType === 'diterima' ? 'SERVICE DITERIMA' : (isPaid ? (isRetail ? 'LUNAS - KASIR' : 'LUNAS') : 'BELUM LUNAS')}
              </Text>
            </View>
          </View>

          {/* Dashed line */}
          <View style={dashedLine} />

          {/* Mechanic Notes & Recommendation - only for tagihan */}
          {receiptType === 'tagihan' && (
            <>
              {/* Mechanic Notes */}
              {isPaid && tx.mechanic_notes && tx.mechanic_notes.trim() ? (
                <View style={{ marginVertical: 10 }}>
                  <Text style={sectionTitle}>CATATAN MEKANIK</Text>
                  <Text style={{ fontSize: 12, color: '#555', lineHeight: 17, marginTop: 3 }}>
                    {tx.mechanic_notes}
                  </Text>
                </View>
              ) : null}

              {/* Recommendation */}
              {isPaid && tx.recommendation && tx.recommendation.trim() ? (
                <View style={{ marginVertical: 10 }}>
                  <Text style={sectionTitle}>REKOMENDASI BERIKUTNYA</Text>
                  <Text style={{ fontSize: 12, color: '#555', lineHeight: 17, marginTop: 3 }}>
                    {tx.recommendation}
                  </Text>
                </View>
              ) : null}
            </>
          )}

          {/* Footer */}
          <View style={{ alignItems: 'center', marginTop: 14 }}>
            <Text style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>
              Terima kasih atas kepercayaan Anda
            </Text>
            <Text style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
              MyGarage Lite
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: 'row',
          padding: 16,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#eee',
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          gap: 12,
          paddingBottom: Math.max(16, insets.bottom + 8),
        }}
      >
        <Pressable
          onPress={handleClose}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 8,
            backgroundColor: '#f5f5f5',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#444', fontSize: 15, fontWeight: '700' }}>Batal</Text>
        </Pressable>
        <Pressable
          onPress={() => handlePrint(tx)}
          disabled={printing}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 8,
            backgroundColor: theme.colors.accent,
            alignItems: 'center',
            opacity: printing ? 0.7 : 1,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {printing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="print" size={18} color="#fff" />
          )}
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
            {printing ? 'Mencetak...' : (connectedPrinter ? 'Cetak Ulang' : 'Cetak PDF')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 1.5,
      }}
    >
      <Text style={{ fontSize: 12, color: '#888', minWidth: 70 }}>{label}</Text>
      <Text style={{ fontSize: 12, color: '#333', flex: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function TotalRow({
  label,
  value,
  bold,
  large,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 2,
      }}
    >
      <Text
        style={{
          fontSize: large ? 14 : 12,
          color: '#555',
          fontWeight: bold ? '700' : '400',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: large ? 15 : 12,
          color: '#222',
          fontWeight: bold ? '800' : '600',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const dashedLine = {
  borderBottomWidth: 1,
  borderBottomColor: '#ccc',
  borderStyle: 'dashed' as any,
  marginVertical: 4,
};

const sectionTitle = {
  fontSize: 10,
  fontWeight: '700' as const,
  color: '#888',
  letterSpacing: 1,
  textTransform: 'uppercase' as any,
};
