import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import {
  User,
  Globe,
  MapPin,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Check,
} from 'lucide-react-native';

export default function CustomerProfileScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, logout, setLanguage } = useAuthStore();

  const [selectedLang, setSelectedLang] = useState(i18n.language || 'uz');

  const languages = [
    { code: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
  ];

  const handleLanguageChange = async (langCode: string) => {
    setSelectedLang(langCode);
    await setLanguage(langCode);
  };

  const handleLogout = () => {
    Alert.alert('Chiqish', 'Haqiqatan ham hisobingizdan chiqmoqchimisiz?', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'Chiqish',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('tabs.profile')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <User size={32} color="#16a34a" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'Mijoz'}</Text>
            <Text style={styles.userPhone}>{user?.phone || '—'}</Text>
          </View>
        </View>

        {/* Language Selection Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Globe size={18} color="#16a34a" />
            <Text style={styles.sectionTitle}>Ilova tili / Язык приложения</Text>
          </View>

          <View style={styles.langList}>
            {languages.map((item) => {
              const isSelected = selectedLang === item.code;
              return (
                <TouchableOpacity
                  key={item.code}
                  style={[styles.langItem, isSelected && styles.langItemActive]}
                  onPress={() => handleLanguageChange(item.code)}
                >
                  <View style={styles.langLeft}>
                    <Text style={styles.flagText}>{item.flag}</Text>
                    <Text style={[styles.langText, isSelected && styles.langTextActive]}>
                      {item.label}
                    </Text>
                  </View>
                  {isSelected && <Check size={16} color="#16a34a" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Saved Addresses Button */}
        <TouchableOpacity
          style={styles.navRow}
          onPress={() => router.push('/(customer)/address-picker')}
        >
          <View style={styles.navLeft}>
            <MapPin size={18} color="#64748b" />
            <Text style={styles.navText}>Yetkazish manzillarim</Text>
          </View>
          <ChevronRight size={18} color="#cbd5e1" />
        </TouchableOpacity>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color="#e11d48" />
          <Text style={styles.logoutText}>Hisobdan chiqish</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  userPhone: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  langList: {
    gap: 8,
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  langItemActive: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  langLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flagText: {
    fontSize: 18,
  },
  langText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  langTextActive: {
    color: '#166534',
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
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
    marginTop: 10,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e11d48',
  },
});
