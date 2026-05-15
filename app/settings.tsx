import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { Input } from '../src/components/ui/Input';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { useTheme } from '../src/contexts/ThemeContext';
import { clearDatabase, resetDatabase } from '../src/database/db';
import { backupService } from '../src/services/backupService';
import { useAppStore } from '../src/store/useAppStore';

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
  } = useAppStore();
  const { theme } = useTheme();
  const [name, setName] = useState(workshopName);
  const [address, setAddress] = useState(workshopAddress);
  const [phone, setPhone] = useState(workshopPhone);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(workshopName);
    setAddress(workshopAddress);
    setPhone(workshopPhone);
  }, [workshopName, workshopAddress, workshopPhone]);

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
