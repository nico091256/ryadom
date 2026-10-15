import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import i18n from '../locales/i18n';
import { Camera, Image as ImageIcon, Trash2 } from 'lucide-react-native';
import { mobileApi } from '../services/api';

interface Props {
  value: string;
  onChange: (url: string) => void;
  size?: number;
  rounded?: boolean;
  placeholderText?: string;
}

const showError = (msg: string) => {
  if (Platform.OS === 'web') window.alert(msg);
  else Alert.alert(i18n.t('sellerUi.common.error'), msg);
};

export default function SellerImagePicker({
  value,
  onChange,
  size = 140,
  rounded = false,
  placeholderText,
}: Props) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);

  const pick = async (source: 'library' | 'camera') => {
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showError(
          source === 'camera'
            ? t('sellerUi.imagePicker.cameraDenied')
            : t('sellerUi.imagePicker.galleryDenied'),
        );
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        // iOS: hand back JPEG instead of HEIC so the server accepts it and browsers can show it
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      setUploading(true);
      const url = await mobileApi.uploadImage(asset.uri, asset.mimeType ?? undefined);
      onChange(url);
    } catch (err: any) {
      showError(err?.message || t('sellerUi.imagePicker.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const radius = rounded ? size / 2 : 16;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.preview, { width: size, height: size, borderRadius: radius }]}>
        {value ? (
          <Image
            source={{ uri: value }}
            style={{ width: size, height: size, borderRadius: radius }}
          />
        ) : (
          <View style={styles.placeholder}>
            <ImageIcon size={28} color="#cbd5e1" />
            <Text style={styles.placeholderText}>{placeholderText ?? t('sellerUi.imagePicker.noImage')}</Text>
          </View>
        )}
        {uploading && (
          <View style={[styles.overlay, { borderRadius: radius }]}>
            <ActivityIndicator color="#ffffff" />
            <Text style={styles.overlayText}>{t('sellerUi.imagePicker.uploading')}</Text>
          </View>
        )}
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => pick('library')}
          disabled={uploading}
        >
          <ImageIcon size={16} color="#16a34a" />
          <Text style={styles.btnText}>{t('sellerUi.imagePicker.gallery')}</Text>
        </TouchableOpacity>
        {Platform.OS !== 'web' && (
          <TouchableOpacity
            style={styles.btn}
            onPress={() => pick('camera')}
            disabled={uploading}
          >
            <Camera size={16} color="#16a34a" />
            <Text style={styles.btnText}>{t('sellerUi.imagePicker.camera')}</Text>
          </TouchableOpacity>
        )}
        {value ? (
          <TouchableOpacity
            style={[styles.btn, styles.removeBtn]}
            onPress={() => onChange('')}
            disabled={uploading}
          >
            <Trash2 size={16} color="#e11d48" />
            <Text style={[styles.btnText, { color: '#e11d48' }]}>{t('sellerUi.common.delete')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  preview: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  placeholder: {
    alignItems: 'center',
    padding: 8,
  },
  placeholderText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  removeBtn: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  btnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
});
