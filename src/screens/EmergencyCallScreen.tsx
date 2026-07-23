import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, Linking } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { Text, Eyebrow, PillButton } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';
import { palette } from '../theme/tokens';

const BG = '#1A0408';
const CARD = 'rgba(255,255,255,0.07)';
const SOFT = 'rgba(255,255,255,0.45)';

export function EmergencyCallScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const { profile } = useAuth();

  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [locationErr, setLocationErr] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLocationErr(false);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setLocationErr(true);
          return;
        }
        // GPS can hang far longer than a user reading a 112 script can wait —
        // fail fast into a clear "couldn't get location" state instead of
        // leaving them staring at "Getting location…" indefinitely.
        const loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
        ]);
        if (cancelled) return;
        const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setCoords(c);

        try {
          const geo = await Location.reverseGeocodeAsync(c);
          if (!cancelled && geo && geo.length > 0) {
            const g = geo[0];
            const parts = [g.street, g.streetNumber, g.city].filter(Boolean);
            if (parts.length > 0) setAddress(parts.join(' '));
          }
        } catch {
          // keep coords only — coordinates are still enough to read to a 112 operator
        }
      } catch {
        if (!cancelled) setLocationErr(true);
      }
    })();
    return () => { cancelled = true; };
  }, [attempt]);

  const coordStr = coords
    ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
    : null;

  const locationLine = address ?? coordStr ?? (locationErr ? "Couldn't get location — say your nearest street/landmark" : 'Getting location…');

  const name = profile?.name ?? 'Unknown';
  const phone = profile?.phone ?? null;

  const call112 = () => {
    Linking.openURL('tel:112');
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.pageH, paddingTop: 64, paddingBottom: 48 }}>
        {/* Header */}
        <Eyebrow color={palette.crimsonSoft} style={{ marginBottom: 6 }}>
          EMERGENCY
        </Eyebrow>
        <Text
          style={{
            fontFamily: t.type.display,
            fontSize: 32,
            color: '#F2EFE3',
            lineHeight: 38,
            marginBottom: 6,
          }}
        >
          Call{' '}
          <Text style={{ fontFamily: t.type.displayItalic, fontSize: 32, color: palette.crimson, lineHeight: 38 }}>
            112
          </Text>
        </Text>
        <Text variant="small" color={SOFT} style={{ marginBottom: 28 }}>
          112 is the European emergency number — police, ambulance, fire. Stay on the line and speak clearly.
        </Text>

        {/* Big call button */}
        <Pressable
          onPress={call112}
          style={[
            {
              backgroundColor: palette.crimson,
              borderRadius: 999,
              paddingVertical: 22,
              alignItems: 'center',
              marginBottom: 28,
            },
            t.shadows.card,
          ]}
        >
          <Text
            style={{
              fontFamily: t.type.display,
              fontSize: 28,
              color: '#fff',
              lineHeight: 34,
              letterSpacing: 2,
            }}
          >
            📞  CALL 112
          </Text>
        </Pressable>

        {/* Your location */}
        <View style={{ backgroundColor: CARD, borderRadius: t.radii.lg, padding: 16, marginBottom: 14 }}>
          <Eyebrow color={palette.crimsonSoft} style={{ marginBottom: 6 }}>
            YOUR LOCATION — TELL THIS FIRST
          </Eyebrow>
          <Text
            style={{
              fontFamily: t.type.bodySemibold,
              fontSize: 16,
              color: locationErr ? palette.crimsonSoft : '#F2EFE3',
              lineHeight: 22,
              marginBottom: coords ? 4 : 0,
            }}
          >
            {locationLine}
          </Text>
          {coords && address && (
            <Text style={{ fontFamily: t.type.body, fontSize: 13, color: SOFT }}>
              {coordStr}
            </Text>
          )}
          {locationErr && (
            <Pressable onPress={() => setAttempt((n) => n + 1)} style={{ marginTop: 8 }}>
              <Text style={{ fontFamily: t.type.bodySemibold, fontSize: 13, color: palette.crimsonSoft, textDecorationLine: 'underline' }}>
                Try again
              </Text>
            </Pressable>
          )}
        </View>

        {/* What to say script */}
        <View style={{ backgroundColor: CARD, borderRadius: t.radii.lg, padding: 16, marginBottom: 14 }}>
          <Eyebrow color={palette.crimsonSoft} style={{ marginBottom: 12 }}>
            WHAT TO SAY
          </Eyebrow>

          <ScriptLine
            label="Your location"
            value={locationLine}
            highlight
          />
          <ScriptLine
            label="Your name"
            value={name}
          />
          {phone && (
            <ScriptLine
              label="Your phone"
              value={phone}
            />
          )}
          <ScriptLine
            label="What you need"
            value="Police / Ambulance / Fire"
          />
          <ScriptLine
            label="What's happening"
            value="Describe clearly — stay calm"
            muted
          />
        </View>

        {/* Tips */}
        <View style={{ backgroundColor: CARD, borderRadius: t.radii.lg, padding: 16, marginBottom: 28 }}>
          <Eyebrow color={palette.crimsonSoft} style={{ marginBottom: 10 }}>
            IMPORTANT
          </Eyebrow>
          {[
            'Stay on the line — do not hang up',
            'Give your location first, every time',
            'Say which service you need (police, ambulance, fire)',
            'Speak slowly and clearly',
            'If you can\'t talk, press a key when prompted',
          ].map((tip, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <Text style={{ color: palette.crimsonSoft, fontFamily: t.type.body, lineHeight: 20 }}>•</Text>
              <Text style={{ flex: 1, color: SOFT, fontFamily: t.type.body, fontSize: 14, lineHeight: 20 }}>
                {tip}
              </Text>
            </View>
          ))}
        </View>

        <PillButton
          variant="ghost"
          block
          onPress={() => nav.goBack()}
          style={{ borderColor: 'rgba(255,255,255,0.15)' }}
        >
          <Text style={{ color: SOFT, fontFamily: t.type.bodySemibold }}>Go back</Text>
        </PillButton>
      </ScrollView>
    </View>
  );
}

function ScriptLine({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <View
      style={{
        borderLeftWidth: 2,
        borderLeftColor: highlight ? palette.crimson : 'rgba(255,255,255,0.15)',
        paddingLeft: 12,
        marginBottom: 12,
      }}
    >
      <Text
        style={{
          fontFamily: 'Courier',
          fontSize: 11,
          color: highlight ? palette.crimsonSoft : 'rgba(255,255,255,0.3)',
          marginBottom: 2,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: muted ? undefined : 'Courier',
          fontSize: highlight ? 17 : 15,
          color: muted ? 'rgba(255,255,255,0.3)' : '#F2EFE3',
          lineHeight: highlight ? 24 : 20,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
