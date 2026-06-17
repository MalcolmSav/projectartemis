import * as SMS from 'expo-sms';
import * as Location from 'expo-location';

export interface SosSmsResult {
  sent?: boolean;
  cancelled?: boolean;
  error?: string;
}

/**
 * Opens the native SMS composer prefilled with an emergency message + a Google
 * Maps link to the current location, addressed to the given phone numbers.
 *
 * This is the offline fallback for SOS: SMS works without a data connection, so
 * even if Supabase/push can't reach anyone, a text still goes out. The user taps
 * "send" in their own messaging app (the OS does not allow silent sending).
 */
export async function sendSosSms(numbers: string[]): Promise<SosSmsResult> {
  const available = await SMS.isAvailableAsync();
  if (!available) return { error: 'This device can’t send SMS.' };

  const clean = numbers.map((n) => n.replace(/[^\d+]/g, '')).filter(Boolean);
  if (clean.length === 0) return { error: 'No emergency contact numbers saved.' };

  let locationLine = '';
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      locationLine = `\nMy location: https://maps.google.com/?q=${loc.coords.latitude},${loc.coords.longitude}`;
    }
  } catch {
    // best-effort — still send the text without a link
  }

  const body = `🚨 I need help — this is an emergency alert sent from Artemis.${locationLine}`;

  try {
    const { result } = await SMS.sendSMSAsync(clean, body);
    if (result === 'sent') return { sent: true };
    return { cancelled: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
