import React, { useEffect, useState } from 'react';
import { ScrollView, View, Pressable, ActivityIndicator, Linking, Alert } from 'react-native';
import { useCheckIns } from '../hooks/useCheckIns';
import { useEmergencyContacts } from '../hooks/useEmergencyContacts';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, Eyebrow, Avatar, Card, PillButton, Divider, Row } from '../components';
import { useCircle } from '../hooks/useCircle';
import { IconChevron, IconPhone, IconMessage, IconShield, BowArrow } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useT } from '../i18n';
import { palette } from '../theme/tokens';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { callPhone } from '../lib/call';
import { RootStackParamList } from '../navigation/types';

interface RecentCheckIn {
  id: string;
  kind: 'ok' | 'wellness_request' | 'wellness_response' | 'alarm';
  note: string | null;
  created_at: string;
}

export function CirclePersonScreen() {
  const t = useTheme();
  const tr = useT();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CirclePerson'>>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<RecentCheckIn[]>([]);
  const { sendWellnessRequest } = useCheckIns();
  const { contacts: emergencyContacts } = useEmergencyContacts(route.params.id);
  const { members, remove } = useCircle();
  const { user } = useAuth();
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: ci }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', route.params.id).maybeSingle(),
        // Privacy: only activity that involves ME — their circle-wide events
        // (plain check-ins, alarms: target_id null) or things aimed at me.
        // Their wellness exchanges with OTHER circle members are none of our
        // business and must not appear here.
        supabase
          .from('check_ins')
          .select('id, kind, note, created_at')
          .eq('user_id', route.params.id)
          .or(`target_id.is.null,target_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);
      if (!cancelled) {
        setProfile(prof ?? null);
        setActivity((ci ?? []) as RecentCheckIn[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route.params.id, user?.id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.colors.forest700} />
      </View>
    );
  }
  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg, padding: t.spacing.pageH, paddingTop: 80 }}>
        <Text variant="body">{tr('Profile not found.')}</Text>
      </View>
    );
  }

  // Never fall back to email here — a circle member's email stays private.
  const displayName = profile.name ?? (profile.username ? `@${profile.username}` : 'Circle member');
  // First name for the friendly button label ("Check if Emma is okay").
  const firstName = (profile.name?.trim().split(/\s+/)[0]) || displayName;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <LinearGradient colors={[t.colors.moonlight, t.colors.ivoryBg]} style={{ paddingTop: 64, paddingBottom: 22 }}>
        <Pressable
          onPress={() => (nav.canGoBack() ? nav.goBack() : (nav as any).navigate('Tabs', { screen: 'Circle' }))}
          hitSlop={16}
          accessibilityLabel="Back"
          style={{
            position: 'absolute',
            top: 56,
            left: 16,
            width: 40,
            height: 40,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.colors.parchment,
            zIndex: 10,
            ...t.shadows.soft,
          }}
        >
          <IconChevron dir="left" color={t.colors.inkSoft} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Avatar name={displayName} size={84} status="ok" ring photoUri={profile.avatar_url ?? undefined} />
          <Text style={{ fontFamily: t.type.display, fontSize: 28, lineHeight: 38, paddingTop: 4, marginTop: 10, textAlign: 'center' }}>{displayName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <BowArrow size={14} />
            <Text variant="small" color={t.colors.gold700}>
              {tr('Verified circle member')}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 120 }}>
        {/* The app's signature action — clearly labelled and explained, since
            an icon-only button here left everyone guessing what it does. */}
        <PillButton
          size="lg"
          block
          iconLeft={<IconShield size={18} color={palette.gold300} />}
          accessibilityLabel={tr('Check if {name} is okay', { name: displayName })}
          onPress={async () => {
            const res = await sendWellnessRequest(profile.id);
            if (res.error) {
              Alert.alert(
                tr('Give them a moment 🌙'),
                res.cooldownMins
                  ? tr('You already checked on {name} recently. You can send another check in {m} min.', {
                      name: displayName,
                      m: res.cooldownMins,
                    })
                  : res.error,
              );
            } else {
              Alert.alert(
                tr('Wellness check sent 🏹'),
                tr('{name} has 30 minutes to respond — you’ll be notified.', { name: displayName }),
              );
            }
          }}
        >
          {tr('Check if {name} is okay', { name: firstName })}
        </PillButton>
        <Text variant="meta" color={t.colors.inkMute} style={{ textAlign: 'center', marginTop: 6, marginBottom: 16 }}>
          {tr('Sends a gentle “you good?” — they tap once to reply.')}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
          <PillButton
            variant="secondary"
            style={{ flex: 1 }}
            iconLeft={<IconPhone size={14} color={t.colors.forest700} />}
            onPress={() => callPhone(profile.phone, displayName, tr)}
          >
            {tr('Call')}
          </PillButton>
          <PillButton
            variant="secondary"
            style={{ flex: 1 }}
            iconLeft={<IconMessage size={14} color={t.colors.forest700} />}
            onPress={() => nav.navigate('Chat', { userId: profile.id })}
          >
            {tr('Message')}
          </PillButton>
        </View>

        {(profile.phone || profile.bio) && (
          <Card>
            {profile.phone ? <Row label="Phone" value={profile.phone} /> : null}
            {profile.phone && profile.bio ? <Divider /> : null}
            {profile.bio ? <Row label="Bio" value={profile.bio} /> : null}
          </Card>
        )}

        {emergencyContacts.length > 0 && (
          <>
            <Eyebrow style={{ marginTop: 22, marginBottom: 8 }}>🚨 EMERGENCY CONTACTS</Eyebrow>
            <Card>
              {emergencyContacts.map((contact, i) => (
                <View key={contact.id}>
                  <View>
                    <Text variant="meta" color={t.colors.crimson} weight="semibold">
                      {contact.priority === 1 ? 'CALL FIRST' : `CONTACT ${contact.priority}`}
                    </Text>
                    <Text variant="body" weight="semibold" style={{ marginTop: 4 }}>
                      {contact.name}
                    </Text>
                    <Pressable onPress={() => Linking.openURL(`tel:${contact.contact_info}`)}>
                      <Text variant="small" color={t.colors.gold700} style={{ marginTop: 2 }}>
                        {contact.contact_info}
                      </Text>
                    </Pressable>
                  </View>
                  {i < emergencyContacts.length - 1 && <Divider style={{ marginVertical: 10 }} />}
                </View>
              ))}
            </Card>
          </>
        )}

        {activity.length > 0 && (
          <>
            <Eyebrow style={{ marginTop: 22, marginBottom: 8 }}>{tr('RECENT ACTIVITY')}</Eyebrow>
            <Card>
              {activity.map((c, i) => (
                <View key={c.id}>
                  <View style={{ paddingVertical: 8 }}>
                    <Text variant="body" weight="semibold">
                      {labelFor(c.kind, tr)}
                    </Text>
                    <Text variant="meta" color={t.colors.inkMute}>
                      {new Date(c.created_at).toLocaleString()}
                    </Text>
                    {c.note ? (
                      <Text variant="small" color={t.colors.inkSoft} style={{ marginTop: 4 }}>
                        {c.note}
                      </Text>
                    ) : null}
                  </View>
                  {i < activity.length - 1 && <Divider />}
                </View>
              ))}
            </Card>
          </>
        )}
        {/* Remove from circle */}
        {(() => {
          const edge = members.find((m) => m.profile.id === route.params.id);
          if (!edge) return null;
          return (
            <Pressable
              disabled={removing}
              onPress={() => {
                Alert.alert(
                  `Remove ${displayName}?`,
                  "They'll no longer see your check-ins and you won't see theirs.",
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: async () => {
                        setRemoving(true);
                        await remove(edge.edgeId);
                        if (nav.canGoBack()) nav.goBack();
                        else (nav as any).navigate('Tabs', { screen: 'Circle' });
                      },
                    },
                  ],
                );
              }}
              style={{ marginTop: 28, marginBottom: 8, alignItems: 'center', opacity: removing ? 0.5 : 1 }}
            >
              <Text variant="small" weight="semibold" color={t.colors.crimson}>
                {removing ? tr('Removing…') : tr('Remove {name} from circle', { name: displayName })}
              </Text>
            </Pressable>
          );
        })()}
      </ScrollView>
    </View>
  );
}

function labelFor(kind: RecentCheckIn['kind'], tr: (k: string) => string) {
  switch (kind) {
    case 'ok': return tr('✅ Checked in OK');
    case 'wellness_request': return tr('🏹 Sent a wellness check');
    case 'wellness_response': return tr('💬 Responded to a wellness check');
    case 'alarm': return tr('🚨 Triggered an alarm');
  }
}
