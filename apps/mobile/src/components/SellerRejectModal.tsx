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
import { useTranslation } from 'react-i18next';
import { XCircle } from 'lucide-react-native';

// Translation keys of the quick-pick reasons; resolved at render time so they follow the current language
const QUICK_REASON_KEYS = [
  'sellerUi.reject.reasons.outOfStock',
  'sellerUi.reject.reasons.closing',
  'sellerUi.reject.reasons.cantDeliver',
  'sellerUi.reject.reasons.tooFar',
];

interface Props {
  visible: boolean;
  title: string;
  placeholder: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onSubmit: (reason: string) => Promise<void> | void;
}

export default function SellerRejectModal({
  visible,
  title,
  placeholder,
  cancelLabel,
  confirmLabel,
  onCancel,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const quickReasons = QUICK_REASON_KEYS.map((key) => t(key));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setReason('');
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(t('sellerUi.reject.reasonRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch (err: any) {
      setError(err?.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <XCircle size={20} color="#e11d48" />
            <Text style={styles.title}>{title}</Text>
          </View>

          <View style={styles.chips}>
            {quickReasons.map((r) => {
              const selected = reason.trim() === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => {
                    setReason(r);
                    setError(null);
                  }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{r}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={reason}
            onChangeText={(text) => {
              setReason(text);
              if (error) setError(null);
            }}
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            multiline
            maxLength={300}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={onCancel}
              disabled={submitting}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.rejectBtn]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.rejectText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#fff1f2',
    borderColor: '#e11d48',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#e11d48',
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#e11d48',
  },
  errorText: {
    fontSize: 12,
    color: '#e11d48',
    marginTop: 6,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#f1f5f9',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  rejectBtn: {
    backgroundColor: '#e11d48',
  },
  rejectText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
