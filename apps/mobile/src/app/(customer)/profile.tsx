import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { useAddressStore } from '../../store/useAddressStore';
import LanguageSelectorModal from '../../components/LanguageSelectorModal';
import EditProfileModal from '../../components/EditProfileModal';
import { hapticFeedback } from '../../utils/haptics';
import { mobileApi } from '../../services/api';
import {
  User,
  Globe,
  MapPin,
  LogOut,
  ChevronRight,
  ShieldCheck,
  LogIn,
  Pencil,
  FileText,
  Send,
  PhoneCall,
} from 'lucide-react-native';

export default function CustomerProfileScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuthStore();
  const { savedAddresses, setSavedAddresses } = useAddressStore();

  // Load saved addresses so the count is correct even before visiting the address picker
  useEffect(() => {
    if (!isAuthenticated) return;
    mobileApi
      .getAddresses()
      .then((list: any) => setSavedAddresses(Array.isArray(list) ? list : []))
      .catch((err: any) => console.warn('Failed to load saved addresses', err));
  }, [isAuthenticated]);

  const [langModalVisible, setLangModalVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);

  const getLanguageLabel = () => {
    switch (i18n.language) {
      case 'ru':
        return 'Русский 🇷🇺';
      case 'en':
        return 'English 🇬🇧';
      default:
        return "O'zbekcha 🇺🇿";
    }
  };

  const handleLogout = () => {
    hapticFeedback('medium');
    Alert.alert(t('customer.profile.logoutTitle'), t('customer.profile.logoutQuestion'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('customer.profile.logoutTitle'),
        style: 'destructive',
        onPress: async () => {
          hapticFeedback('success');
          await logout();
          router.replace('/(customer)');
        },
      },
    ]);
  };

  const handleSupportTelegram = () => {
    hapticFeedback('selection');
    Linking.openURL('https://t.me/localshop_uz');
  };

  const handleSupportPhone = () => {
    hapticFeedback('selection');
    Linking.openURL('tel:+998712000000');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('tabs.profile')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        {!user ? (
          <TouchableOpacity
            style={styles.userCard}
            activeOpacity={0.8}
            onPress={() => {
              hapticFeedback('selection');
              router.push({ pathname: '/(auth)/login', params: { next: '/(customer)/profile' } } as any);
            }}
          >
            <View style={styles.avatar}>
              <LogIn size={28} color="#16a34a" />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{t('customer.profile.signInTitle')}</Text>
              <Text style={styles.userPhone}>{t('customer.profile.signInSub')}</Text>
            </View>
            <ChevronRight size={18} color="#cbd5e1" />
          </TouchableOpacity>
        ) : (
        <TouchableOpacity
          style={styles.userCard}
          activeOpacity={0.8}
          onPress={() => {
            hapticFeedback('selection');
            setEditVisible(true);
          }}
        >
          <View style={styles.avatar}>
            <User size={32} color="#16a34a" />
          </View>
          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{user?.name || t('customer.profile.defaultName')}</Text>
              <View style={styles.verifiedBadge}>
                <ShieldCheck size={12} color="#166534" />
                <Text style={styles.verifiedText}>{t('customer.profile.verified')}</Text>
              </View>
            </View>
            <Text style={styles.userPhone}>{user?.phone || '+998 (--) --- -- --'}</Text>
          </View>
          <View style={styles.editBtn}>
            <Pencil size={16} color="#16a34a" />
          </View>
        </TouchableOpacity>
        )}

        {/* Quick Menu Section */}
        <View style={styles.sectionCard}>
          {/* Saved Addresses */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              hapticFeedback('selection');
              router.push('/(customer)/address-picker');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconCircle, { backgroundColor: '#f0fdf4' }]}>
                <MapPin size={18} color="#16a34a" />
              </View>
              <View>
                <Text style={styles.menuTitle}>{t('customer.profile.myAddresses')}</Text>
                <Text style={styles.menuSub}>
                  {savedAddresses.length > 0
                    ? t('customer.profile.addressesSaved', { count: savedAddresses.length })
                    : t('customer.profile.addressesEmpty')}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#cbd5e1" />
          </TouchableOpacity>

          {/* Language Selector */}
          <TouchableOpacity
            style={[styles.menuRow, styles.menuRowBorder]}
            onPress={() => {
              hapticFeedback('selection');
              setLangModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconCircle, { backgroundColor: '#eff6ff' }]}>
                <Globe size={18} color="#2563eb" />
              </View>
              <View>
                <Text style={styles.menuTitle}>{t('customer.profile.appLanguage')}</Text>
                <Text style={styles.menuSub}>{getLanguageLabel()}</Text>
              </View>
            </View>
            <View style={styles.menuRightBadge}>
              <Text style={styles.langBadgeText}>{getLanguageLabel()}</Text>
              <ChevronRight size={16} color="#cbd5e1" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <Text style={styles.sectionHeading}>{t('customer.profile.supportHeading')}</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={handleSupportTelegram}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconCircle, { backgroundColor: '#eff6ff' }]}>
                <Send size={18} color="#0284c7" />
              </View>
              <View>
                <Text style={styles.menuTitle}>{t('customer.profile.telegramSupport')}</Text>
                <Text style={styles.menuSub}>{t('customer.profile.telegramSupportSub')}</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, styles.menuRowBorder]}
            onPress={handleSupportPhone}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconCircle, { backgroundColor: '#f0fdf4' }]}>
                <PhoneCall size={18} color="#16a34a" />
              </View>
              <View>
                <Text style={styles.menuTitle}>{t('customer.profile.callCenter')}</Text>
                <Text style={styles.menuSub}>+998 71 200 00 00</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        {/* Legal & Terms */}
        <Text style={styles.sectionHeading}>{t('customer.profile.documents')}</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              hapticFeedback('selection');
              Alert.alert(t('customer.profile.offerTitle'), t('customer.profile.offerText'));
            }}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconCircle, { backgroundColor: '#f8fafc' }]}>
                <FileText size={18} color="#64748b" />
              </View>
              <Text style={styles.menuTitle}>{t('customer.profile.offerMenu')}</Text>
            </View>
            <ChevronRight size={18} color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        {user && (
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <LogOut size={18} color="#e11d48" />
            <Text style={styles.logoutText}>{t('customer.profile.logoutButton')}</Text>
          </TouchableOpacity>
        )}

        {/* App Version Info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Ryadom v1.0.0</Text>
          <Text style={styles.versionSub}>{t('customer.profile.tagline')}</Text>
        </View>
      </ScrollView>

      <EditProfileModal visible={editVisible} onClose={() => setEditVisible(false)} />

      {/* Language Selector Modal */}
      <LanguageSelectorModal
        visible={langModalVisible}
        onClose={() => setLangModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
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
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  userPhone: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 6,
    paddingHorizontal: 4,
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  menuSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  menuRightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  langBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
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
    marginTop: 6,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#e11d48',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 24,
    paddingBottom: 10,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  versionSub: {
    fontSize: 11,
    color: '#cbd5e1',
    marginTop: 2,
  },
});

