import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, PermissionsAndroid } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { Input } from '../src/components/ui/Input';
import { Picker } from '../src/components/ui/Picker';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { useTheme } from '../src/contexts/ThemeContext';
import { clearDatabase, resetDatabase } from '../src/database/db';
import { backupService } from '../src/services/backupService';
import { useAppStore } from '../src/store/useAppStore';

let BLEPrinter: any = null;
if (Platform.OS !== 'web') {
  try {
    const printerModule = require('react-native-thermal-receipt-printer-image-qr');
    BLEPrinter = printerModule.BLEPrinter;
  } catch (e) {
    console.warn('BLEPrinter not available');
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const {
    workshopName,
    workshopAddress,
    workshopPhone,
    isDarkMode,
    setWorkshopInfo,
    setDarkMode,
    showToast,
    loadSettings,
    receiptPaperSize,
    receiptFooter,
    setReceiptInfo,
    connectedPrinter,
    setConnectedPrinter,
  } = useAppStore();
  const { theme } = useTheme();
  const [name, setName] = useState(workshopName);
  const [address, setAddress] = useState(workshopAddress);
  const [phone, setPhone] = useState(workshopPhone);
  const [paperSize, setPaperSize] = useState(receiptPaperSize);
  const [footer, setFooter] = useState(receiptFooter);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [btDevices, setBtDevices] = useState<any[]>([]);
  const [scanningBt, setScanningBt] = useState(false);

  useEffect(() => {
    setName(workshopName);
    setAddress(workshopAddress);
    setPhone(workshopPhone);
    setPaperSize(receiptPaperSize);
    setFooter(receiptFooter);
  }, [workshopName, workshopAddress, workshopPhone, receiptPaperSize, receiptFooter]);

  const saveInfo = async () => {
    await setWorkshopInfo({ name: name.trim(), address: address.trim(), phone: phone.trim() });
    showToast('Pengaturan disimpan', 'success');
  };

  const doBackup = async () => {
    try {
      setBusy(true);
      await backupService.exportBackup();
      showToast('Backup berhasil', 'success');
    } catch {
      showToast('Gagal backup', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    try {
      setBusy(true);
      const r = await backupService.importBackup();
      showToast(r.message, r.ok ? 'success' : 'error');
      if (r.ok) await loadSettings();
    } catch {
      showToast('Gagal restore', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    setConfirmReset(false);
    setBusy(true);
    await resetDatabase();
    await loadSettings();
    showToast('Database direset & data dummy dimuat', 'success');
    setBusy(false);
  };

  const doClear = async () => {
    setConfirmClear(false);
    setBusy(true);
    await clearDatabase();
    await loadSettings();
    showToast('Semua data berhasil dihapus', 'success');
    setBusy(false);
  };

  const scanPrinters = async () => {
    if (Platform.OS === 'web') {
      showToast('Bluetooth tidak didukung di Web', 'error');
      return;
    }
    if (!BLEPrinter) {
      showToast('Modul printer belum dimuat', 'error');
      return;
    }

    if (Platform.OS === 'android') {
      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
      } catch (err) {
        console.warn('Gagal meminta izin:', err);
      }
    }

    setScanningBt(true);
    try {
      await BLEPrinter.init();
      const results = await BLEPrinter.getDeviceList();
      setBtDevices(results);
    } catch (e) {
      showToast('Gagal scan, pastikan Bluetooth aktif & diizinkan', 'error');
    } finally {
      setScanningBt(false);
    }
  };

  const connectToPrinter = async (mac: string, name: string) => {
    if (!BLEPrinter) return;
    setBusy(true);
    try {
      await BLEPrinter.connectPrinter(mac);
      await setConnectedPrinter({ name, mac });
      showToast(`Terhubung ke ${name}`, 'success');
      setBtDevices([]);
    } catch (e) {
      showToast('Gagal terhubung ke printer', 'error');
    } finally {
      setBusy(false);
    }
  };

  const disconnectPrinter = async () => {
    await setConnectedPrinter(null);
    showToast('Printer diputuskan', 'success');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title="Pengaturan" showBack />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 + (Platform.OS === 'android' ? 48 : 34) }}>
        <Text style={{ ...sectionBase, color: theme.colors.textSecondary }}>BENGKEL</Text>
        <Card style={{ marginBottom: 16 }}>
          <Input label="Nama Bengkel" value={name} onChangeText={setName} />
          <Input label="Alamat" value={address} onChangeText={setAddress} />
          <Input
            label="No. Telepon"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <Button title="Simpan" onPress={saveInfo} fullWidth />
        </Card>

        <Text style={{ ...sectionBase, color: theme.colors.textSecondary }}>MANAJEMEN</Text>
        <Card style={{ marginBottom: 16 }} padding="sm">
          <Pressable
            onPress={() => router.push('/employees')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              padding: 12,
              borderRadius: theme.radius.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.colors.accent + '25',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="people" size={20} color={theme.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>
                Kelola Karyawan
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                Tambah/edit mekanik, kasir, admin
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </Card>

        <Text style={{ ...sectionBase, color: theme.colors.textSecondary }}>STRUK & CETAK</Text>
        <Card style={{ marginBottom: 16 }}>
          <Picker
            label="Ukuran Kertas"
            value={paperSize}
            options={['A4', '58mm', '80mm']}
            onChange={(v) => setPaperSize(v as 'A4' | '58mm' | '80mm')}
            optionIcons={{
              A4: 'document-text',
              '58mm': 'receipt',
              '80mm': 'receipt',
            }}
          />
          <Input
            label="Pesan Footer (Opsional)"
            value={footer}
            onChangeText={setFooter}
            placeholder="Terima kasih, barang tidak dapat dikembalikan."
            multiline
            numberOfLines={2}
            style={{ textAlignVertical: 'top' }}
          />
          <View style={{ marginTop: 8 }}>
            <Button
              title="Simpan Pengaturan Struk"
              onPress={async () => {
                await setReceiptInfo({ paperSize, footer: footer.trim() });
                showToast('Pengaturan struk disimpan', 'success');
              }}
              fullWidth
            />
          </View>
        </Card>

        {Platform.OS !== 'web' && (
          <>
            <Text style={{ ...sectionBase, color: theme.colors.textSecondary }}>PRINTER BLUETOOTH (THERMAL)</Text>
            <Card style={{ marginBottom: 16 }}>
              {connectedPrinter ? (
                <View style={{ marginBottom: 16, backgroundColor: theme.colors.success + '22', padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="print" size={24} color={theme.colors.success} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.success, fontWeight: '700' }}>{connectedPrinter.name}</Text>
                    <Text style={{ color: theme.colors.success, fontSize: 12 }}>{connectedPrinter.mac}</Text>
                  </View>
                  <Pressable onPress={disconnectPrinter} style={{ padding: 6 }}>
                    <Ionicons name="close-circle" size={24} color={theme.colors.danger} />
                  </Pressable>
                </View>
              ) : (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginBottom: 8 }}>
                    Tidak ada printer yang terhubung.
                  </Text>
                  <Button
                    title={scanningBt ? 'Mencari Printer...' : 'Scan Printer Bluetooth'}
                    onPress={scanPrinters}
                    loading={scanningBt}
                    icon={<Ionicons name="bluetooth" size={18} color="#fff" />}
                    fullWidth
                  />
                </View>
              )}

              {btDevices.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 }}>
                    Printer Ditemukan:
                  </Text>
                  {btDevices.map((dev, i) => (
                    <Pressable
                      key={i}
                      onPress={() => connectToPrinter(dev.inner_mac_address, dev.device_name)}
                      style={{
                        padding: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.border,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <View>
                        <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{dev.device_name}</Text>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{dev.inner_mac_address}</Text>
                      </View>
                      <Ionicons name="link" size={20} color={theme.colors.primary} />
                    </Pressable>
                  ))}
                </View>
              )}
            </Card>
          </>
        )}

        <Text style={{ ...sectionBase, color: theme.colors.textSecondary }}>TAMPILAN</Text>
        <Card style={{ marginBottom: 16 }}>
          <Pressable
            onPress={() => setDarkMode(!isDarkMode)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: theme.radius.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name={isDarkMode ? 'moon' : 'sunny'} size={20} color={theme.colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                {isDarkMode ? 'Dark Mode' : 'Light Mode'}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                {isDarkMode ? 'Tema gelap modern' : 'Tema terang'}
              </Text>
            </View>
            <View
              style={{
                width: 44,
                height: 26,
                borderRadius: 13,
                backgroundColor: isDarkMode ? theme.colors.success : theme.colors.border,
                padding: 3,
                alignItems: isDarkMode ? 'flex-end' : 'flex-start',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: '#fff',
                }}
              />
            </View>
          </Pressable>
        </Card>

        <Text style={{ ...sectionBase, color: theme.colors.textSecondary }}>DATA</Text>
        <Card style={{ marginBottom: 12 }}>
          <Button
            title="Backup Database"
            variant="secondary"
            onPress={doBackup}
            loading={busy}
            icon={<Ionicons name="cloud-upload-outline" size={18} color="#fff" />}
            fullWidth
          />
          <View style={{ height: 8 }} />
          <Button
            title="Restore Database"
            variant="outline"
            onPress={doRestore}
            loading={busy}
            icon={<Ionicons name="cloud-download-outline" size={18} color={theme.colors.text} />}
            fullWidth
          />
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Button
            title="Hapus Semua Data"
            variant="danger"
            onPress={() => setConfirmClear(true)}
            loading={busy}
            icon={<Ionicons name="trash" size={18} color="#fff" />}
            fullWidth
          />
          <View style={{ height: 8 }} />
          <Button
            title="Reset & Muat Data Dummy"
            variant="outline"
            onPress={() => setConfirmReset(true)}
            loading={busy}
            icon={<Ionicons name="refresh" size={18} color={theme.colors.text} />}
            fullWidth
          />
        </Card>

        <Text style={{ ...sectionBase, color: theme.colors.textSecondary }}>TENTANG</Text>
        <Card>
          <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 16 }}>
            MyGarage Lite
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 }}>
            Versi 1.0.0
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
            Aplikasi manajemen bengkel motor & mobil yang ringan, modern, dan mudah digunakan.
            Cocok untuk bengkel kecil hingga menengah di Indonesia.
          </Text>
        </Card>
      </ScrollView>

      <ConfirmDialog
        visible={confirmReset}
        title="Reset Database?"
        message="Semua data akan dihapus dan diganti dengan data dummy. Tindakan ini tidak dapat dibatalkan."
        confirmText="Reset"
        destructive
        onConfirm={doReset}
        onCancel={() => setConfirmReset(false)}
      />
      <ConfirmDialog
        visible={confirmClear}
        title="Hapus Semua Data?"
        message="Semua data akan dihapus permanen tanpa data dummy. Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        destructive
        onConfirm={doClear}
        onCancel={() => setConfirmClear(false)}
      />
    </View>
  );
}

const sectionBase = {
  fontSize: 11,
  fontWeight: '700' as const,
  letterSpacing: 1,
  marginBottom: 8,
  marginTop: 8,
};
