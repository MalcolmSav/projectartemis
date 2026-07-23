import React, { useEffect, useState } from 'react';
import { View, Pressable, Linking, ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Eyebrow, PillButton, Avatar, TripMap } from '../components';
import { IconChevron, IconPhone, IconMessage } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { usePresence } from '../hooks/usePresence';
import { supabase, Profile } from '../lib/supabase';
import { palette } from '../theme/tokens';
import { useT } from '../i18n';
import { personName } from '../lib/person';
import { callPhone } from '../lib/call';
import { RootStackParamList } from '../navigation/types';
import { LatLng } from '../lib/routing';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * What a circle member sees when someone else raises an SOS alarm — their
 * live location, one-tap call, and concrete guidance on what to do next.
 *
 * This is deliberately a SEPARATE screen from AlarmActiveScreen, which is
 * for the person WHO raised the alarm (and inserts a check-in as `user.id`
 * on mount) — routing a receiver there by mistake would silently broadcast
 * a second, false alarm under their own name.
 */
export function FriendAlarmScreen() {
  const t = useTheme();
  const tr = useT();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<RootStackParamList, 'FriendAlarm'>>();
  const userId = route.params.userId;
  const { byUser } = usePresence();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle().then(({ data }) => {
      if (!cancelled) { setProfile((data as Profile) ?? null); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const presence = byUser[userId];
  const position: LatLng | null = presence ? { latitude: presence.lat, longitude: presence.lng } : null;
  const presenceStale = presence ? now - new Date(presence.updated_at).getTime() > 3 * 60_000 : true;
  const name = personName(profile);
  const battery = presence?.battery_level;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.colors.forest700} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      {position ? (
        <TripMap position={position} travelerName={name} travelerPhoto={profile?.avatar_url} follow />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text variant="body" color={t.colors.inkSoft} style={{ textAlign: 'center' }}>
            {tr("No live location from {name} yet.", { name })}
          </Text>
        </View>
      )}

      {/* Back */}
      <Pressable
        onPress={() => nav.goBack()}
        accessibilityLabel="Back"
        style={[
          {
            position: 'absolute',
            top: insets.top + 8,
            left: 16,
            width: 40,
            height: 40,
            borderRadius: 999,
            backgroundColor: t.colors.parchment,
            alignItems: 'center',
            justifyContent: 'center',
          },
          t.shadows.soft,
        ]}
      >
        <IconChevron dir="left" color={t.colors.inkSoft} />
      </Pressable>

      {/* Alarm banner */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 64,
          right: 16,
          backgroundColor: palette.crimson,
          borderRadius: 999,
          paddingVertical: 10,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 14 }}>🚨</Text>
        <Text variant="small" weight="semibold" color="#fff" numberOfLines={1} style={{ flex: 1 }}>
          {tr('{name} raised an alarm', { name })}
        </Text>
      </View>

      {/* Bottom sheet */}
      <ScrollView
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: '58%',
            backgroundColor: t.colors.parchment,
            borderTopLeftRadius: t.radii.lg,
            borderTopRightRadius: t.radii.lg,
          },
          t.shadows.card,
        ]}
        contentContainerStyle={{ padding: t.spacing.pageH, paddingBottom: insets.bottom + 24 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Avatar name={name} size={52} photoUri={profile?.avatar_url ?? undefined} />
          <View style={{ flex: 1 }}>
            <Text variant="body" weight="semibold" style={{ fontSize: 18 }}>
              {name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: presenceStale ? palette.statusWarn : palette.statusOk }} />
              <Text variant="meta" color={t.colors.inkMute}>
                {presence
                  ? presenceStale
                    ? tr('Location may be out of date')
                    : tr('Live · updated {time}', { time: new Date(presence.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
                  : tr('No location shared')}
                {battery != null ? ` · 🔋${Math.round(battery * 100)}%` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* How to help */}
        <View style={{ backgroundColor: 'rgba(192,57,43,0.08)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.2)', borderRadius: t.radii.md, padding: 14, marginBottom: 16 }}>
          <Eyebrow color={palette.crimson} style={{ marginBottom: 6 }}>{tr('HOW TO HELP')}</Eyebrow>
          <Text variant="small" color={t.colors.inkSoft} style={{ lineHeight: 20 }}>
            {tr('1. Try calling {name} right now.\n2. If they don\'t answer, go to their last known location if it\'s safe to do so.\n3. If you believe they\'re in danger, call 112 and share their location with the operator.', { name })}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <PillButton
            style={{ flex: 1 }}
            size="lg"
            iconLeft={<IconPhone size={16} color={palette.gold300} />}
            onPress={() => callPhone(profile?.phone, name, tr)}
          >
            {tr('Call {name}', { name })}
          </PillButton>
          <PillButton
            variant="secondary"
            style={{ flex: 1 }}
            size="lg"
            iconLeft={<IconMessage size={16} color={t.colors.forest700} />}
            onPress={() => nav.navigate('Chat', { userId })}
          >
            {tr('Message')}
          </PillButton>
        </View>

        <PillButton
          variant="danger"
          block
          onPress={() => Linking.openURL('tel:112')}
        >
          {tr('📞 Call 112')}
        </PillButton>
      </ScrollView>
    </View>
  );
}
