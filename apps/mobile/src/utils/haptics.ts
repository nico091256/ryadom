import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

type HapticType = 'selection' | 'light' | 'medium' | 'success' | 'warning';

const trigger = (type: HapticType = 'selection') => {
  if (Platform.OS === 'web') return;
  try {
    switch (type) {
      case 'selection':
        Haptics.selectionAsync();
        break;
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
    }
  } catch {}
};

// Callable as a function: hapticFeedback('selection')
export const hapticFeedback = Object.assign(trigger, {
  selection: () => trigger('selection'),
  light: () => trigger('light'),
  medium: () => trigger('medium'),
  success: () => trigger('success'),
  warning: () => trigger('warning'),
});

