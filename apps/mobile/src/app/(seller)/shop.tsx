import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { mobileApi } from '../../services/api';
import { Store, Clock, Phone, MapPin, LogOut, Check, Globe, ChevronRight } from 'lucide-react-native';
import SellerImagePicker from '../../components/SellerImagePicker';
import LanguageSelectorModal from '../../components/LanguageSelectorModal';

const LANGUAGE_NAMES: Record<string, string> = { uz: "O'zbekcha", ru: 'Русский', en: 'English' };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const notify = (title: string, msg: string) => {
  if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
  else Alert.alert(title, msg);
};

export default function SellerShopScreen() {
  const { t, i18n: i18nInstance } = useTranslation();
  const router = useRouter();
  const { logout } = useAuthStore();
  const [langModalVisible, setLangModalVisible] = useState(false);
  const currentLangCode = (i18nInstance.language || 'uz').slice(0, 2);

  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressText, setAddressText] = useState('');
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('23:00');
  const [isOpen, setIsOpen] = useState(true);
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    mobileApi
      .getSellerShop()
      .then((data) => {
        setShop(data);
        setName(data.name);
        setPhone(data.phone);
        setAddressText(data.address_text);
        setOpenTime(data.open_time);
        setCloseTime(data.close_time);
        setIsOpen(data.is_open);
        setLogoUrl(data.logo_url || '');
      })
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  const handleToggleOpen = async (val: boolean) => {
    setIsOpen(val);
    try {
      await mobileApi.updateSellerShop({ is_open: val });
    } catch (err: any) {
      setIsOpen(!val);
      notify(t('sellerUi.common.error'), err.message);
    }
  };

  const handleSave = async () => {
    const open = openTime.trim();
    const close = closeTime.trim();
    if (!TIME_RE.test(open) || !TIME_RE.test(close)) {
      notify(t('sellerUi.common.error'), t('sellerUi.shop.timeFormatError'));
      return;
    }
    if (!name.trim()) {
      notify(t('sellerUi.common.error'), t('sellerUi.shop.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      await mobileApi.updateSellerShop({
        name,
        phone,
        address_text: addressText,
        open_time: open,
        close_time: close,
        is_open: isOpen,
        logo_url: logoUrl,
      });
      setOpenTime(open);
      setCloseTime(close);
      notify(t('sellerUi.shop.savedTitle'), t('sellerUi.shop.savedMessage'));
    } catch (err: any) {
      notify(t('sellerUi.common.error'), err.message);
    } finally {
      setSaving(false);
    }
  };

  const doLogout = async () => {
    await logout();
    router.replace('/(auth)/seller-login');
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(t('sellerUi.shop.logoutConfirm'))) doLogout();
      return;
    }
    Alert.alert(t('sellerUi.shop.logoutTitle'), t('sellerUi.shop.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sellerUi.shop.logoutTitle'),
        style: 'destructive',
        onPress: doLogout,
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('sellerUi.shop.title')}</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          <Check size={18} color="#ffffff" />
          <Text style={styles.saveBtnText}>{t('common.save')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Prominent Open / Closed Toggle Switch Card (Section 5) */}
        <View style={[styles.openClosedCard, isOpen ? styles.cardOpen : styles.cardClosed]}>
          <View style={styles.openClosedLeft}>
            <View style={[styles.statusDot, isOpen ? styles.dotOpen : styles.dotClosed]} />
            <View>
              <Text style={styles.openClosedTitle}>
                {t('sellerUi.shop.statusTitle', {
                  status: isOpen ? t('sellerUi.shop.statusOpen') : t('sellerUi.shop.statusClosed'),
                })}
              </Text>
              <Text style={styles.openClosedSubtitle}>
                {isOpen ? t('sellerUi.shop.statusOpenHint') : t('sellerUi.shop.statusClosedHint')}
              </Text>
            </View>
          </View>
          <Switch
            value={isOpen}
            onValueChange={handleToggleOpen}
            accessibilityLabel={t('seller.openClosedToggle')}
            trackColor={{ false: '#fecdd3', true: '#86efac' }}
            thumbColor={isOpen ? '#16a34a' : '#e11d48'}
          />
        </View>

        {/* Shop Logo */}
        <View style={styles.card}>
          <View style={styles.labelRow}>
            <Store size={14} color="#475569" />
            <Text style={styles.labelInline}>{t('sellerUi.shop.logo')}</Text>
          </View>
          <SellerImagePicker
            value={logoUrl}
            onChange={setLogoUrl}
            size={110}
            rounded
            placeholderText={t('sellerUi.shop.noLogo')}
          />
          <Text style={styles.hint}>{t('sellerUi.shop.saveHint')}</Text>
        </View>

        {/* Shop Form Card */}
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Store size={13} color="#475569" />
              <Text style={styles.labelInline}>{t('sellerUi.shop.name')}</Text>
            </View>
            <TextInput style={styles.input} value={name} onChangeText={setName} />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Phone size={13} color="#475569" />
              <Text style={styles.labelInline}>{t('sellerUi.shop.phone')}</Text>
            </View>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <MapPin size={13} color="#475569" />
              <Text style={styles.labelInline}>{t('sellerUi.shop.address')}</Text>
            </View>
            <TextInput style={styles.input} value={addressText} onChangeText={setAddressText} />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <View style={styles.labelRow}>
                <Clock size={13} color="#475569" />
                <Text style={styles.labelInline}>{t('sellerUi.shop.openTime')}</Text>
              </View>
              <TextInput
                style={[styles.input, !TIME_RE.test(openTime.trim()) && styles.inputError]}
                value={openTime}
                onChangeText={setOpenTime}
                placeholder="08:00"
                maxLength={5}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <View style={styles.labelRow}>
                <Clock size={13} color="#475569" />
                <Text style={styles.labelInline}>{t('sellerUi.shop.closeTime')}</Text>
              </View>
              <TextInput
                style={[styles.input, !TIME_RE.test(closeTime.trim()) && styles.inputError]}
                value={closeTime}
                onChangeText={setCloseTime}
                placeholder="23:00"
                maxLength={5}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
        </View>

        {/* App language */}
        <TouchableOpacity
          style={[styles.card, styles.langRow]}
          onPress={() => setLangModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t('authUi.changeLanguage')}
        >
          <View style={styles.labelRow}>
            <Globe size={14} color="#475569" />
            <Text style={styles.labelInline}>{t('sellerUi.shop.language')}</Text>
          </View>
          <View style={styles.langValue}>
            <Text style={styles.langValueText}>
              {LANGUAGE_NAMES[currentLangCode] || currentLangCode}
            </Text>
            <ChevronRight size={16} color="#94a3b8" />
          </View>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color="#e11d48" />
          <Text style={styles.logoutText}>{t('sellerUi.shop.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <LanguageSelectorModal visible={langModalVisible} onClose={() => setLangModalVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  openClosedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  cardOpen: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  cardClosed: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  openClosedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotOpen: {
    backgroundColor: '#16a34a',
  },
  dotClosed: {
    backgroundColor: '#e11d48',
  },
  openClosedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  openClosedSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  row: {
    flexDirection: 'row',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  labelInline: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  inputError: {
    borderColor: '#e11d48',
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  langValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  langValueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  hint: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff1f2',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecdd3',
    marginTop: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e11d48',
  },
});
