import { Alert, Linking } from 'react-native';
import type { TFn } from '../i18n';

/**
 * Dial a phone number, or explain why we can't.
 * Every "Call" button in the app should go through this so a missing
 * number never turns into a silent no-op.
 */
export function callPhone(phone: string | null | undefined, name: string, tr: TFn) {
  if (!phone?.trim()) {
    Alert.alert(
      tr('No phone number'),
      tr("{name} hasn't added a phone number yet. Ask them to add it in their profile.", { name }),
    );
    return;
  }
  Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
}
