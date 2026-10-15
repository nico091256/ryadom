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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { mobileApi } from '../../services/api';
import { ArrowLeft, ArrowRight, ShieldCheck, Phone, Store, Globe } from 'lucide-react-native';
import LanguageSelectorModal from '../../components/LanguageSelectorModal';

export default function CustomerLoginScreen() {
  const { t, i18n } = useTranslation();
  const [langModalVisible, setLangModalVisible] = useState(false);
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const afterLogin = (next || '/(customer)') as any;
  const { setUser } = useAuthStore();

  const [step, setStep] = useState<'phone' | 'code' | 'name'>('phone');
  const [phone, setPhone] = useState('+998901234567');
  const [code, setCode] = useState('123456');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<any>(null);

  const handleSendCode = async () => {
    setError(null);
    if (!phone || phone.length < 9) {
      setError(t('authUi.login.phoneIncomplete'));
      return;
    }

    setLoading(true);
    try {
      await mobileApi.sendCode(phone);
      setStep('code');
    } catch (err: any) {
      setError(err.message || t('authUi.login.sendCodeFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError(null);
    if (!code || code.length !== 6) {
      setError(t('authUi.login.codeRequired'));
      return;
    }

    setLoading(true);
    try {
      const res = await mobileApi.verifyCode(phone, code);
      if (res.isNewUser && !res.user?.name) {
        setPendingUser(res.user);
        setStep('name');
      } else {
        setUser(res.user);
        router.replace(afterLogin);
      }
    } catch (err: any) {
      setError(err.message || t('authUi.login.codeInvalid'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!name.trim()) {
      setError(t('authUi.login.nameRequired'));
      return;
    }

    setLoading(true);
    try {
      const updated = await mobileApi.updateProfile({ name: name.trim() });
      setUser(updated);
      router.replace(afterLogin);
    } catch (err: any) {
      setError(err.message || t('common.error'));
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
        {/* Top Bar */}
        <View style={styles.header}>
          {step !== 'phone' ? (
            <TouchableOpacity
              onPress={() => setStep(step === 'name' ? 'code' : 'phone')}
              style={styles.backBtn}
              accessibilityLabel={t('common.back')}
            >
              <ArrowLeft size={20} color="#0f172a" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(customer)'))}
              style={styles.backBtn}
              accessibilityLabel={t('common.back')}
            >
              <ArrowLeft size={20} color="#0f172a" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>{t('common.appName')}</Text>
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
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {step === 'phone' && (
            <View style={styles.stepContainer}>
              <View style={styles.iconCircle}>
                <Phone size={28} color="#16a34a" />
              </View>
              <Text style={styles.title}>{t('auth.phoneTitle')}</Text>
              <Text style={styles.subtitle}>{t('auth.phoneSubtitle')}</Text>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="+998 90 123 45 67"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSendCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>{t('auth.sendCode')}</Text>
                    <ArrowRight size={18} color="#ffffff" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.mockNote}>
                <Text style={styles.mockText}>{t('authUi.login.testModeNote', { code: '123456' })}</Text>
              </View>
            </View>
          )}

          {step === 'code' && (
            <View style={styles.stepContainer}>
              <View style={styles.iconCircle}>
                <ShieldCheck size={28} color="#16a34a" />
              </View>
              <Text style={styles.title}>{t('auth.smsTitle')}</Text>
              <Text style={styles.subtitle}>
                {t('auth.smsSubtitle', { phone })}
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="123456"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleVerifyCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.buttonText}>{t('auth.verify')}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSendCode} style={styles.resendBtn}>
                <Text style={styles.resendText}>{t('auth.resendCode')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'name' && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>{t('auth.namePrompt')}</Text>
              <Text style={styles.subtitle}>
                {t('authUi.login.nameSubtitle')}
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('authUi.login.namePlaceholder')}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSaveName}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.buttonText}>{t('auth.saveName')}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Footer: Link to Shopkeeper Login */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.shopLoginLink}
            onPress={() => router.push('/(auth)/seller-login')}
          >
            <Store size={18} color="#16a34a" />
            <Text style={styles.shopLoginText}>{t('auth.shopLoginLink')}</Text>
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
  },
  stepContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 52,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    fontWeight: '600',
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 10,
    fontSize: 24,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  primaryButton: {
    flexDirection: 'row',
    width: '100%',
    height: 52,
    backgroundColor: '#16a34a',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#e11d48',
    fontSize: 12,
    textAlign: 'center',
  },
  resendBtn: {
    marginTop: 20,
    padding: 8,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
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
  shopLoginLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
  },
  shopLoginText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
});
