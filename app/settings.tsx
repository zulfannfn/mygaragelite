import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View, PermissionsAndroid } from 'react-native';
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
import { InterstitialAd } from '../src/components/ui/AdBanner';
import { useTranslation } from '../src/i18n';

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
    setReceiptInfo,
    connectedPrinter,
    setConnectedPrinter,
    language,
    setLanguage,
  } = useAppStore();
  const { theme } = useTheme();
  const t = useTranslation();
  const [name, setName] = useState(workshopName);
  const [address, setAddress] = useState(workshopAddress);
  const [phone, setPhone] = useState(workshopPhone);
  const [paperSize, setPaperSize] = useState(receiptPaperSize);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [btDevices, setBtDevices] = useState<any[]>([]);
  const [scanningBt, setScanningBt] = useState(false);
  const [connectingMac, setConnectingMac] = useState<string | null>(null);

  useEffect(() => {
    setName(workshopName);
    setAddress(workshopAddress);
    setPhone(workshopPhone);
    setPaperSize(receiptPaperSize);
  }, [workshopName, workshopAddress, workshopPhone, receiptPaperSize]);

  const workshopDirty =
    name.trim() !== workshopName.trim() ||
    address.trim() !== workshopAddress.trim() ||
    phone.trim() !== workshopPhone.trim();

  const receiptDirty = paperSize !== receiptPaperSize;

  const saveInfo = async () => {
    await setWorkshopInfo({ name: name.trim(), address: address.trim(), phone: phone.trim() });
    showToast(t.settings.settingsSaved, 'success');
  };

  const doBackup = async () => {
    try {
      setBusy(true);
      await backupService.exportBackup();
      showToast(t.settings.backupSuccess, 'success');
      await InterstitialAd.show();
    } catch {
      showToast(t.settings.backupFailed, 'error');
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
      showToast(t.settings.restoreFailed, 'error');
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    setConfirmReset(false);
    setBusy(true);
    await resetDatabase();
    await loadSettings();
    showToast(t.settings.resetSuccess, 'success');
    setBusy(false);
  };

  const doClear = async () => {
    setConfirmClear(false);
    setBusy(true);
    await clearDatabase();
    await loadSettings();
    showToast(t.settings.deleteSuccess, 'success');
    setBusy(false);
  };

  const scanPrinters = async () => {
    if (Platform.OS === 'web') {
      showToast(t.settings.bluetoothNotSupported, 'error');
      return;
    }
    if (!BLEPrinter) {
      showToast(t.settings.printerModuleNotLoaded, 'error');
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
        console.warn(t.settings.permissionFailed, err);
      }
    }

    setScanningBt(true);
    try {
      await BLEPrinter.init();
      const results = await BLEPrinter.getDeviceList();
      setBtDevices(results);
    } catch (e) {
      showToast(t.settings.scanFailed, 'error');
    } finally {
      setScanningBt(false);
    }
  };

  const connectToPrinter = async (mac: string, name: string) => {
    if (!BLEPrinter || connectingMac) return;
    setConnectingMac(mac);
    try {
      await BLEPrinter.connectPrinter(mac);
      await setConnectedPrinter({ name, mac });
      showToast(`${t.settings.printerConnected} ${name}`, 'success');
      setBtDevices([]);
    } catch (e) {
      showToast(t.settings.printerConnectFailed, 'error');
    } finally {
      setConnectingMac(null);
    }
  };

  const disconnectPrinter = async () => {
    await setConnectedPrinter(null);
    showToast(t.settings.printerDisconnected, 'success');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title={t.settings.title} showBack />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 + (Platform.OS === 'android' ? 48 : 34) }}>
        <Text style={{ ...sectionBase, color: theme.colors.textSecondary }}>{t.settings.sectionWorkshop}</Text>
        <Card style={{ marginBottom: 16 }}>
          <Input label={t.settings.workshopName} value={name} onChangeText={setName} />
          <Input label={t.settings.workshopAddress} value={address} onChangeText={setAddress} />
          <Input
            label={t.settings.workshopPhone}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <Button title={t.common.save} onPress={saveInfo} fullWidth disabled={!workshopDirty} />
        </Card>

        <Text style={{ ...sectionBase, color: theme.colors.textSecondary }}>{t.settings.sectionManagement}</Text>
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
                {t.settings.manageEmployees}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {t.settings.manageEmployeesDesc}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>

          {/* Language toggle */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              padding: 12,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.colors.blue + '25',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="language" size={20} color={theme.colors.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>
                {t.settings.language}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {t.settings.languageDesc}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable
                onPress={() => setLanguage('id')}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: theme.radius.md,
                  backgroundColor: language === 'id' ? theme.colors.blue : theme.colors.cardLight,
                  borderWidth: 1,
                  borderColor: language === 'id' ? theme.colors.blue : theme.colors.border,
                }}
              >
                <Text style={{ color: language === 'id' ? '#fff' : theme.colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                  🇮🇩 {t.settings.languageIndonesian}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setLanguage('en')}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: theme.radius.md,
                  backgroundColor: language === 'en' ? theme.colors.blue : theme.colors.cardLight,
                  borderWidth: 1,
                  borderColor: language === 'en' ? theme.colors.blue : theme.colors.border,
                }}
              >
                <Text style={{ color: language === 'en' ? '#fff' : theme.colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                  🇬🇧 {t.settings.languageEnglish}
                </Text>
              </Pressable>
            </View>
          </View>
        </Card>

        <Text style={{ ...sectionBase, color: theme.colors.textSecondary }}>{t.settings.sectionReceipt}</Text>
        <Card style={{ marginBottom: 16 }}>
          <Picker
            label={t.settings.paperSize}
            value={paperSize}
            options={['A4', '58mm', '80mm']}
            onChange={(v) => setPaperSize(v as 'A4' | '58mm' | '80mm')}
            optionIcons={{
              A4: 'document-text',
              '58mm': 'receipt',
              '80mm': 'receipt',
            }}
          />
          <View style={{ marginTop: 8 }}>
            <Button
              title={t.settings.saveReceiptSettings}
              onPress={async () => {
                await setReceiptInfo({ paperSize });
                showToast(t.settings.settingsSaved, 'success');
              }}
              disabled={!receiptDirty}
              fullWidth
            />
          </View>
        </Card>

        {Platform.OS !== 'web' && (
          <>
            <Text style={{ ...sectionBase, color: theme.colors.textSecondary }}>{t.settings.sectionPrinter}</Text>
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
                    {t.settings.noPrinter}
                  </Text>
                  <Button
                    title={scanningBt ? t.settings.searchingPrinter : t.settings.scanPrinter}
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
                    {t.settings.printersFound}
                  </Text>
                  {btDevices.map((dev, i) => {
                    const mac = dev.inner_mac_address as string;
                    const isConnecting = connectingMac === mac;
                    return (
                      <Pressable
                        key={i}
                        onPress={() => connectToPrinter(mac, dev.device_name)}
                        disabled={!!connectingMac}
                        style={{
                          padding: 12,
                          borderBottomWidth: 1,
                          borderBottomColor: theme.colors.border,
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          opacity: connectingMac && !isConnecting ? 0.5 : 1,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{dev.device_name}</Text>
                          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{mac}</Text>
                          {isConnecting ? (
                            <Text style={{ color: theme.colors.accent, fontSize: 12, marginTop: 4 }}>
                              {t.settings.connecting}
                            </Text>
                          ) : null}
                        </View>
                        {isConnecting ? (
                          <ActivityIndicator size="small" color={theme.colors.accent} />
                        ) : (
                          <Ionicons name="link" size={20} color={theme.colors.primary} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Card>
          </>
        )}

        <Text style={{ ...sectionBase, color: theme.colors.textSecondary }}>{t.settings.sectionAppearance}</Text>
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
                {isDarkMode ? t.settings.darkMode : t.settings.lightMode}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                {isDarkMode ? t.settings.darkModeDesc : t.settings.lightModeDesc}
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

        <Text style={{ ...sectionBase, color: theme.colors.textSecondary }}>{t.settings.sectionData}</Text>
        <Card style={{ marginBottom: 12 }}>
          <Button
            title={t.settings.backupDatabase}
            variant="secondary"
            onPress={doBackup}
            loading={busy}
            icon={<Ionicons name="cloud-upload-outline" size={18} color="#fff" />}
            fullWidth
          />
          <View style={{ height: 8 }} />
          <Button
            title={t.settings.restoreDatabase}
            variant="outline"
            onPress={doRestore}
            loading={busy}
            icon={<Ionicons name="cloud-download-outline" size={18} color={theme.colors.text} />}
            fullWidth
          />
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Button
            title={t.settings.deleteAllData}
            variant="danger"
            onPress={() => setConfirmClear(true)}
            loading={busy}
            icon={<Ionicons name="trash" size={18} color="#fff" />}
            fullWidth
          />
          <View style={{ height: 8 }} />
          <Button
            title={t.settings.resetDummyData}
            variant="outline"
            onPress={() => setConfirmReset(true)}
            loading={busy}
            icon={<Ionicons name="refresh" size={18} color={theme.colors.text} />}
            fullWidth
          />
        </Card>

        <Text style={{ ...sectionBase, color: theme.colors.textSecondary }}>{t.settings.sectionAbout}</Text>
        <Card>
          <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 16 }}>
            MyGarage Lite
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 }}>
            Versi 1.0.0
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
            {t.settings.appDescription} {t.settings.appTarget}
          </Text>
        </Card>
      </ScrollView>

      <ConfirmDialog
        visible={confirmReset}
        title={t.settings.resetTitle}
        message={t.settings.resetMessage}
        confirmText="Reset"
        destructive
        onConfirm={doReset}
        onCancel={() => setConfirmReset(false)}
      />
      <ConfirmDialog
        visible={confirmClear}
        title={t.settings.deleteTitle}
        message={t.settings.deleteMessage}
        confirmText={t.common.delete}
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
