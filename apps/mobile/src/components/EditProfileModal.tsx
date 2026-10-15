import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { mobileApi } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function EditProfileModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(user?.name || '');
      setError(null);
    }
  }, [visible]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(t('customer.editProfile.nameTooShort'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await mobileApi.updateProfile({ name: trimmed });
      setUser({ ...user!, ...updated });
      hapticFeedback('success');
      onClose();
    } catch (e: any) {
      setError(e.message || t('customer.editProfile.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('customer.editProfile.title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color="#0f172a" />
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>{t('customer.editProfile.name')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('customer.editProfile.namePlaceholder')}
            placeholderTextColor="#94a3b8"
            autoFocus
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <Text style={styles.label}>{t('customer.editProfile.phone')}</Text>
          <View style={[styles.input, styles.inputDisabled]}>
            <Text style={styles.disabledText}>{user?.phone || '—'}</Text>
            <Lock size={14} color="#94a3b8" />
          </View>
          <Text style={styles.hint}>{t('customer.editProfile.phoneHint')}</Text>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveText}>{t('common.save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginBottom: 14,
  },
  inputDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    marginBottom: 4,
  },
  disabledText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  hint: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#e11d48',
    fontSize: 12,
    textAlign: 'center',
  },
  saveBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
