import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { Check, Globe, X } from 'lucide-react-native';
import { hapticFeedback } from '../utils/haptics';

interface LanguageSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LanguageSelectorModal({
  visible,
  onClose,
}: LanguageSelectorModalProps) {
  const { t, i18n } = useTranslation();
  const { setLanguage } = useAuthStore();

  const languages = [
    { code: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
  ];

  const handleSelect = async (code: string) => {
    hapticFeedback.selection();
    await setLanguage(code);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Globe size={20} color="#059669" />
              <Text style={styles.title}>{t('customer.language.title')}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.list}>
            {languages.map((lang) => {
              const isSelected = i18n.language === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langItem, isSelected && styles.langItemSelected]}
                  onPress={() => handleSelect(lang.code)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.flag}>{lang.flag}</Text>
                  <Text style={[styles.langLabel, isSelected && styles.langLabelSelected]}>
                    {lang.label}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkCircle}>
                      <Check size={14} color="#ffffff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: 10,
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  langItemSelected: {
    backgroundColor: '#ecfdf5',
    borderColor: '#059669',
  },
  flag: {
    fontSize: 24,
    marginRight: 12,
  },
  langLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  langLabelSelected: {
    color: '#059669',
    fontWeight: '700',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
