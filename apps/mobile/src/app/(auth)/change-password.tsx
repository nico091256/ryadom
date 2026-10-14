import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { mobileApi } from '../../services/api';
import { Lock, ShieldAlert, Check } from 'lucide-react-native';

export default function ForcedChangePasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('Shopkeeper123!');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!newPassword || newPassword.length < 6) {
      setError('Yangi parol kamida 6 belgidan iborat bo\'lishi shart');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Yangi parollar bir-biriga mos kelmadi');
      return;
    }

    setLoading(true);
    try {
      await mobileApi.changePassword(currentPassword, newPassword);
      if (user) {
        setUser({ ...user, must_change_password: false });
      }
      router.replace('/(seller)/orders');
    } catch (err: any) {
      setError(err.message || 'Parolni o\'zgartirishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <ShieldAlert size={32} color="#f59e0b" />
        </View>

        <Text style={styles.title}>{t('seller.changePasswordRequired')}</Text>
        <Text style={styles.subtitle}>
          Xavfsizlik maqsadida administrator bergan boshlang'ich parolni o'zingizning yangi shaxsiy parolingizga almashtiring.
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Joriy boshlang'ich parol</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Yangi maxfiy parol (kamida 6 belgi)</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="••••••••"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Yangi parolni tasdiqlang</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="••••••••"
          />
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Check size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>{t('seller.savePassword')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  primaryButton: {
    flexDirection: 'row',
    width: '100%',
    height: 52,
    backgroundColor: '#16a34a',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
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
});
