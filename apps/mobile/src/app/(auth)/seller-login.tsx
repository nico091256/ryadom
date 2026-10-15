import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { mobileApi } from '../../services/api';
import { ArrowLeft, ArrowRight, Store, Lock, User, ShoppingBag, Globe } from 'lucide-react-native';
import LanguageSelectorModal from '../../components/LanguageSelectorModal';

export default function SellerLoginScreen() {
  const { t, i18n } = useTranslation();
  const [langModalVisible, setLangModalVisible] = useState(false);
  const router = useRouter();
  const { setUser } = useAuthStore();

  const [login, setLogin] = useState('seller_chilonzor');
  const [password, setPassword] = useState('Shopkeeper123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (!login.trim() || !password) {
      setError(t('authUi.sellerLogin.fieldsRequired'));
      return;
    }

    setLoading(true);
    try {
      const res = await mobileApi.login(login.trim(), password);
      if (res.user?.role !== 'seller') {
        throw new Error(t('authUi.sellerLogin.notSeller'));
      }

      setUser(res.user);

      if (res.user.must_change_password) {
        router.replace('/(auth)/change-password');
      } else {
        router.replace('/(seller)/orders');
      }
    } catch (err: any) {
      setError(err.message || t('authUi.sellerLogin.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(customer)'))}
              style={styles.backBtn}
              accessibilityLabel={t('common.back')}
            >
            <ArrowLeft size={20} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('auth.shopLoginTitle')}</Text>
          <TouchableOpacity
            onPress={() => setLangModalVisible(true)}
            style={styles.langBtn}
            accessibilityRole="button"
            accessibilityLabel={t('authUi.changeLanguage')}
          >
            <Globe size={16} color="#0f172a" />
            <Text style={styles.langBtnText}>{(i18n.language || 'uz').slice(0, 2).toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        {/* Form Body */}
        <View style={styles.formContent}>
          <View style={styles.iconCircle}>
            <Store size={28} color="#16a34a" />
          </View>
          <Text style={styles.title}>{t('auth.shopLoginTitle')}</Text>
          <Text style={styles.subtitle}>
            {t('authUi.sellerLogin.subtitle')}
          </Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('auth.login')}</Text>
            <View style={styles.inputWrapper}>
              <User size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={login}
                onChangeText={setLogin}
                autoCapitalize="none"
                placeholder="seller_chilonzor"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('auth.password')}</Text>
            <View style={styles.inputWrapper}>
              <Lock size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Text style={styles.buttonText}>{t('auth.loginButton')}</Text>
                <ArrowRight size={18} color="#ffffff" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.mockNote}>
            <Text style={styles.mockText}>
              {t('authUi.sellerLogin.demoNote', {
                login: 'seller_chilonzor',
                password: 'Shopkeeper123!',
              })}
            </Text>
          </View>
        </View>

        {/* Footer: Switch back to Customer Login */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.customerLink}
            onPress={() => router.push('/(auth)/login')}
          >
            <ShoppingBag size={18} color="#64748b" />
            <Text style={styles.customerText}>{t('auth.customerLoginLink')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <LanguageSelectorModal visible={langModalVisible} onClose={() => setLangModalVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  formContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
  },
  primaryButton: {
    flexDirection: 'row',
    width: '100%',
    height: 52,
    backgroundColor: '#16a34a',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#e11d48',
    fontSize: 12,
    textAlign: 'center',
  },
  mockNote: {
    marginTop: 24,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mockText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  customerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  customerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
});
