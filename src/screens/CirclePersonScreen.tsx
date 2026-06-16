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
import { palette } from '../theme/tokens';
import { supabase, Profile } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';

interface RecentCheckIn {
  id: string;
  kind: 'ok' | 'wellness_request' | 'wellness_response' | 'alarm';
  note: string | null;
  created_at: string;
}

export function CirclePersonScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CirclePerson'>>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<RecentCheckIn[]>([]);
  const { sendWellnessRequest } = useCheckIns();
  const { contacts: emergencyContacts } = useEmergencyContacts(route.params.id);
  const { members, remove } = useCircle();
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: prof }, { data: ci }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', route.params.id).maybeSingle(),
        supabase
          .from('check_ins')
          .select('id, kind, note, created_at')
          .eq('user_id', route.params.id)
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
  }, [route.params.id]);

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
        <Text variant="body">Profile not found.</Text>
      </View>
    );
  }

  const displayName = profile.name ?? profile.email;

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
          <Text style={{ fontFamily: t.type.display, fontSize: 28, marginTop: 12 }}>{displayName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <BowArrow size={14} />
            <Text variant="small" color={t.colors.gold700}>
              Verified circle member
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
          <PillButton
            style={{ flex: 1 }}
            iconLeft={<IconPhone size={14} color={palette.gold300} />}
            onPress={async () => {
              if (!profile.phone) return Alert.alert('No phone number', `${displayName} hasn't added a phone yet.`);
              const url = `tel:${profile.phone.replace(/\s+/g, '')}`;
              const ok = await Linking.canOpenURL(url);
              if (ok) Linking.openURL(url);
              else Alert.alert('Cannot place call', 'This device cannot make phone calls.');
            }}
          >
            Call
          </PillButton>
          <PillButton
            variant="secondary"
            style={{ flex: 1 }}
            iconLeft={<IconMessage size={14} color={t.colors.forest700} />}
            onPress={() => nav.navigate('Chat', { userId: profile.id })}
          >
            Message
          </PillButton>
          <PillButton
            variant="secondary"
            style={{ width: 52 }}
            accessibilityLabel="Send wellness check"
            onPress={async () => {
              const res = await sendWellnessRequest(profile.id);
              if (res.error) Alert.alert('Could not send', res.error);
              else Alert.alert('Wellness check sent', `${displayName} will see it on their Home screen.`);
            }}
          >
            <IconShield color={t.colors.forest700} />
          </PillButton>
        </View>

        <Card>
          <Row label="Email" value={profile.email} />
          <Divider />
          {profile.phone ? (
            <>
              <Row label="Phone" value={profile.phone} />
              <Divider />
            </>
          ) : null}
          {profile.bio ? <Row label="Bio" value={profile.bio} /> : null}
        </Card>

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
            <Eyebrow style={{ marginTop: 22, marginBottom: 8 }}>RECENT ACTIVITY</Eyebrow>
            <Card>
              {activity.map((c, i) => (
                <View key={c.id}>
                  <View style={{ paddingVertical: 8 }}>
                    <Text variant="body" weight="semibold">
                      {labelFor(c.kind)}
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
                {removing ? 'Removing…' : `Remove ${displayName} from circle`}
              </Text>
            </Pressable>
          );
        })()}
      </ScrollView>
    </View>
  );
}

function labelFor(kind: RecentCheckIn['kind']) {
  switch (kind) {
    case 'ok': return '✅ Checked in OK';
    case 'wellness_request': return '🏹 Sent a wellness check';
    case 'wellness_response': return '💬 Responded to a wellness check';
    case 'alarm': return '🚨 Triggered an alarm';
  }
}
