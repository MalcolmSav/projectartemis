import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, View, Pressable, RefreshControl } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CHECKIN_STALE_MS } from '../lib/constants';
import {
  TopBar,
  Text,
  Eyebrow,
  Card,
  PillButton,
  StatusPill,
  SectionTitle,
  CircleCard,
  QuickAction,
  Avatar,
  BottomSheet,
} from '../components';
import {
  IconBell,
  IconShield,
  IconLocate,
  IconMap,
  IconPhone,
  IconShare,
  IconCal,
  IconChevron,
  IconMessage,
  IconClock,
} from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { palette } from '../theme/tokens';
import { useCircle } from '../hooks/useCircle';
import { useCheckIns } from '../hooks/useCheckIns';
import { useConversations } from '../hooks/useConversations';
import { usePresence } from '../hooks/usePresence';
import { useScheduledCheckin } from '../hooks/useScheduledCheckin';
import { useAuth } from '../state/Auth';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Tonight';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Tonight';
}

export function HomeScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { profile } = useAuth();
  const { members, pendingInvites, refresh: refreshCircle } = useCircle();
  const { latestByUser, pendingForMe, friendAlarm, clearFriendAlarm, recordOk, recordAlarm, sendWellnessRequest, refresh: refreshChecks } = useCheckIns();
  const { unreadTotal } = useConversations();
  const { byUser: presenceByUser } = usePresence();
  const { scheduledFor, triggered, schedule, cancel: cancelSchedule } = useScheduledCheckin();
  const totalPending = pendingInvites.length + (pendingForMe ? 1 : 0);
  const [refreshing, setRefreshing] = useState(false);
  const onPullRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshCircle(), refreshChecks()]);
    setRefreshing(false);
  };
  const [okSent, setOkSent] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Friend responded to my wellness check with an alarm
  useEffect(() => {
    if (!friendAlarm) return;
    const name = friendAlarm.profile?.name ?? friendAlarm.profile?.email ?? 'Your friend';
    Alert.alert(
      '🚨 Alarm from ' + name,
      `${name} responded to your wellness check with an alarm. They may need help.`,
      [
        {
          text: 'Call them',
          onPress: () => {
            clearFriendAlarm();
            if (friendAlarm.profile?.phone) {
              const { Linking } = require('react-native');
              Linking.openURL(`tel:${friendAlarm.profile.phone}`);
            }
          },
        },
        {
          text: 'Go to profile',
          onPress: () => {
            clearFriendAlarm();
            nav.navigate('CirclePerson', { id: friendAlarm.profile?.id ?? '' });
          },
        },
        { text: 'Dismiss', style: 'cancel', onPress: clearFriendAlarm },
      ],
      { cancelable: false },
    );
  }, [friendAlarm]);

  // When the scheduled check-in time passes, prompt the user in-app
  useEffect(() => {
    if (!triggered) return;
    Alert.alert(
      '⏰ Check-in time',
      `Your scheduled check-in has arrived. Are you OK?`,
      [
        {
          text: "I'm OK 🌙",
          onPress: async () => {
            await recordOk('Responded to scheduled check-in');
            await cancelSchedule();
          },
        },
        {
          text: '🚨 Send alarm',
          style: 'destructive',
          onPress: async () => {
            await recordAlarm('Missed scheduled check-in — alarm triggered');
            await cancelSchedule();
            nav.navigate('AlarmActive');
          },
        },
      ],
      { cancelable: false },
    );
  }, [triggered]);

  const lastOk = profile ? latestByUser[profile.id] : undefined;
  const lastOkLabel = lastOk ? relativeTime(lastOk.created_at) : 'no check-in yet';

  const pulseScale = useSharedValue(0.5);
  const pulseOpacity = useSharedValue(0);

  const handleOk = async () => {
    setOkSent(true);
    pulseScale.value = 0.5;
    pulseOpacity.value = 0.9;
    pulseScale.value = withTiming(1.6, { duration: t.motion.okPulse, easing: Easing.out(Easing.ease) });
    pulseOpacity.value = withTiming(0, { duration: t.motion.okPulse, easing: Easing.out(Easing.ease) });
    await recordOk(pendingForMe ? `Responded to ${pendingForMe.from?.name ?? 'wellness check'}` : undefined);
    setTimeout(() => setOkSent(false), 2400);
  };

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <TopBar
        right={
          <>
            <Pressable
              onPress={() => nav.navigate('Conversations')}
              accessibilityLabel="Messages"
              style={[
                {
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
              <IconMessage color={t.colors.inkSoft} />
              {unreadTotal > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    borderRadius: 999,
                    backgroundColor: palette.gold500,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: palette.forest900, fontFamily: t.type.bodyBold, fontSize: 10, lineHeight: 14 }}>
                    {unreadTotal > 9 ? '9+' : unreadTotal}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => setNotifOpen(true)}
              accessibilityLabel="Notifications"
              style={[
                {
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
              <IconBell color={t.colors.inkSoft} />
              {totalPending > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    borderRadius: 999,
                    backgroundColor: palette.crimson,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontFamily: t.type.bodyBold, fontSize: 10, lineHeight: 14 }}>
                    {totalPending}
                  </Text>
                </View>
              )}
            </Pressable>
          </>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={t.colors.forest700} />}
      >
        <View style={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 16 }}>
          <Eyebrow style={{ marginBottom: 8 }}>{`${greeting()}, ${profile?.name ?? ''}`}</Eyebrow>
          <Text variant="displayH1" style={{ lineHeight: 38 }}>
            Your circle is{' '}
            <Text variant="displayH1" italic accent style={{ lineHeight: 38 }}>
              watching over you.
            </Text>
          </Text>
        </View>

        {/* Hero card adapts: response if pending, otherwise send-check */}
        <View style={{ paddingHorizontal: t.spacing.pageH }}>
          {pendingForMe ? (
            <PendingHero
              fromName={pendingForMe.from?.name ?? pendingForMe.from?.email ?? 'A friend'}
              fromAvatar={pendingForMe.from?.avatar_url ?? undefined}
              okSent={okSent}
              onOk={handleOk}
              onAlarm={async () => {
                await recordAlarm('Manual alarm from wellness response');
                nav.navigate('AlarmActive');
              }}
              pulseStyle={pulseStyle}
            />
          ) : (
            <SendHero
              lastOkLabel={lastOkLabel}
              onOpen={() => {
                if (members.length === 0) {
                  nav.navigate('Tabs' as any, { screen: 'Circle' } as any);
                  return;
                }
                setPickerOpen(true);
              }}
              hasFriends={members.length > 0}
            />
          )}
        </View>

        {/* My Circle */}
        <View style={{ paddingHorizontal: t.spacing.pageH, paddingTop: 24, paddingBottom: 8 }}>
          <SectionTitle
            right={
              <Pressable
                onPress={() => nav.navigate('Tabs' as any, { screen: 'Circle' } as any)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Text variant="small" color={t.colors.inkSoft}>
                  See all
                </Text>
                <IconChevron size={12} color={t.colors.inkSoft} />
              </Pressable>
            }
          >
            My Circle
          </SectionTitle>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingHorizontal: t.spacing.pageH, paddingBottom: 6 }}
        >
          {members.length === 0 ? (
            <View
              style={{
                width: 280,
                padding: 16,
                borderRadius: t.radii.lg,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: t.colors.hairline,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="small" color={t.colors.inkSoft} style={{ textAlign: 'center', marginBottom: 12 }}>
                Your circle is empty.
                {'\n'}Go to the Circle tab below to invite someone by email.
              </Text>
              <PillButton size="md" onPress={() => nav.navigate('Tabs' as any, { screen: 'Circle' } as any)}>
                Open Circle
              </PillButton>
            </View>
          ) : (
            members.map((m) => {
              const last = latestByUser[m.profile.id];
              const presence = presenceByUser[m.profile.id];
              const recentPresence = presence && Date.now() - new Date(presence.updated_at).getTime() < 5 * 60_000;
              const status: 'ok' | 'warn' | 'alarm' = last && last.kind === 'alarm'
                ? 'alarm'
                : recentPresence
                  ? 'ok'
                  : last && Date.now() - new Date(last.created_at).getTime() < CHECKIN_STALE_MS
                    ? 'ok'
                    : 'warn';
              const lastSeenText = recentPresence
                ? 'Active now'
                : last
                  ? relativeTime(last.created_at)
                  : 'no check-in';
              return (
                <CircleCard
                  key={m.edgeId}
                  photoUri={m.profile.avatar_url}
                  person={{
                    id: m.profile.id,
                    name: m.profile.name ?? m.profile.email,
                    relation: m.relation ?? 'Friend',
                    lastSeen: lastSeenText,
                    lastLocation: '—',
                    status,
                    verified: m.verified,
                    phone: m.profile.phone ?? '',
                    avatarTone: 'gold' as const,
                    secondary: { label: '', name: '', phone: '', note: '' },
                    calendarAccess: 'none' as const,
                  }}
                  onPress={() => nav.navigate('CirclePerson', { id: m.profile.id })}
                />
              );
            })
          )}
        </ScrollView>

        {/* Quick actions */}
        <View style={{ paddingHorizontal: t.spacing.pageH, paddingTop: 20 }}>
          <SectionTitle>Right now</SectionTitle>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <QuickAction
                icon={<IconLocate color={t.colors.forest700} />}
                label="Trip Mode"
                sub="Track me home"
                onPress={() => nav.navigate('Trip')}
              />
              <QuickAction
                icon={<IconMap color={t.colors.forest700} />}
                label="Open map"
                sub="Reports near you"
                onPress={() => nav.navigate('Tabs' as any, { screen: 'Map' } as any)}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <QuickAction
                icon={<IconPhone size={18} color={t.colors.forest700} />}
                label="Fake call"
                sub="Way out"
                onPress={() => nav.navigate('FakeCall')}
              />
              <QuickAction
                icon={<IconShare color={t.colors.forest700} />}
                label="Share location"
                sub="Sharing with your circle"
                onPress={() => nav.navigate('LocationShare')}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <QuickAction
                icon={<IconCal color={t.colors.forest700} />}
                label="Calendar"
                sub="Upcoming"
                onPress={() => nav.navigate('Tabs' as any, { screen: 'Calendar' } as any)}
              />
              <QuickAction
                icon={<IconClock size={18} color={scheduledFor ? palette.gold500 : t.colors.forest700} />}
                label={scheduledFor ? 'Check-in set' : 'Check on me at…'}
                sub={
                  scheduledFor
                    ? scheduledFor.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Schedule a time'
                }
                accent={!!scheduledFor}
                onPress={() => setScheduleOpen(true)}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <FriendPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={async (friendId) => {
          await sendWellnessRequest(friendId);
          setPickerOpen(false);
        }}
      />

      <NotificationsSheet
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onOpenCircle={() => {
          setNotifOpen(false);
          nav.navigate('Tabs' as any, { screen: 'Circle' } as any);
        }}
      />

      <ScheduleCheckinSheet
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        current={scheduledFor}
        onSchedule={async (d) => {
          await schedule(d);
          setScheduleOpen(false);
        }}
        onCancel={async () => {
          await cancelSchedule();
          setScheduleOpen(false);
        }}
      />
    </View>
  );
}

function NotificationsSheet({
  open,
  onClose,
  onOpenCircle,
}: {
  open: boolean;
  onClose: () => void;
  onOpenCircle: () => void;
}) {
  const t = useTheme();
  const { pendingInvites } = useCircle();
  const { pendingForMe } = useCheckIns();
  const empty = pendingInvites.length === 0 && !pendingForMe;

  return (
    <BottomSheet visible={open} onClose={onClose}>
      <Text style={{ fontFamily: t.type.display, fontSize: 24, lineHeight: 32, paddingTop: 2, marginBottom: 6 }}>
        Notifications
      </Text>

      {empty ? (
        <View style={{ alignItems: 'center', paddingVertical: 30 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              backgroundColor: t.colors.moonlight,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <IconBell color={t.colors.inkMute} />
          </View>
          <Text variant="body" color={t.colors.inkSoft} style={{ textAlign: 'center' }}>
            All quiet.{'\n'}You'll see invites and wellness checks here.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {pendingForMe && (
            <View
              style={{ backgroundColor: t.colors.gold100, borderRadius: t.radii.md, padding: 14, gap: 6 }}
            >
              <Eyebrow color={t.colors.gold700}>WELLNESS CHECK</Eyebrow>
              <Text variant="body" weight="semibold">
                {pendingForMe.from?.name ?? pendingForMe.from?.email ?? 'Someone'} is checking in on you.
              </Text>
              <Text variant="meta" color={t.colors.inkSoft}>
                Respond from the Home card.
              </Text>
            </View>
          )}
          {pendingInvites.map((inv) => (
            <Pressable
              key={inv.id}
              onPress={onOpenCircle}
              style={{
                backgroundColor: t.colors.moonlight,
                borderRadius: t.radii.md,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Avatar
                name={inv.from?.name ?? '?'}
                size={40}
                photoUri={inv.from?.avatar_url ?? undefined}
              />
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="semibold">
                  {inv.from?.name ?? inv.from?.email ?? 'Someone'}
                </Text>
                <Text variant="meta" color={t.colors.inkMute}>
                  wants to add you to their circle
                </Text>
              </View>
              <IconChevron color={t.colors.inkMute} />
            </Pressable>
          ))}
        </View>
      )}

      <PillButton variant="ghost" block style={{ marginTop: 14 }} onPress={onClose}>
        Close
      </PillButton>
    </BottomSheet>
  );
}

function SendHero({
  lastOkLabel,
  onOpen,
  hasFriends,
}: {
  lastOkLabel: string;
  onOpen: () => void;
  hasFriends: boolean;
}) {
  const t = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
        <View>
          <Eyebrow>Your last check-in</Eyebrow>
          <Text style={{ fontFamily: t.type.display, fontSize: 18, lineHeight: 26, paddingTop: 2 }}>
            {lastOkLabel}
          </Text>
        </View>
        <StatusPill status="ok" label="All clear" />
      </View>

      <PillButton
        size="lg"
        block
        iconLeft={<IconShield size={18} color={palette.gold300} />}
        onPress={onOpen}
      >
        {hasFriends ? 'Send wellness check' : 'Add a friend first'}
      </PillButton>
      <Text variant="meta" color={t.colors.inkMute} style={{ textAlign: 'center', marginTop: 8 }}>
        Pick a friend. They'll get the check-in prompt.
      </Text>
    </Card>
  );
}

function PendingHero({
  fromName,
  fromAvatar,
  okSent,
  onOk,
  onAlarm,
  pulseStyle,
}: {
  fromName: string;
  fromAvatar?: string;
  okSent: boolean;
  onOk: () => void;
  onAlarm: () => void;
  pulseStyle: any;
}) {
  const t = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Avatar name={fromName} size={44} photoUri={fromAvatar} />
        <View style={{ flex: 1 }}>
          <Eyebrow color={t.colors.gold700}>WELLNESS CHECK 🏹</Eyebrow>
          <Text style={{ fontFamily: t.type.display, fontSize: 18, lineHeight: 26, paddingTop: 2 }}>
            <Text style={{ fontFamily: t.type.displayItalic, color: t.colors.forest700 }}>{fromName}</Text> is
            checking in on you.
          </Text>
        </View>
      </View>

      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: 999,
              backgroundColor: palette.gold500,
            },
            pulseStyle,
          ]}
        />
        <Pressable onPress={onOk} style={{ width: '100%' }}>
          <LinearGradient
            colors={[t.colors.forest700, t.colors.forest900]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              {
                borderRadius: 999,
                paddingVertical: t.layout.imOkPadV,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              },
              t.shadows.primaryBtn,
            ]}
          >
            <Text
              style={{
                fontFamily: t.type.display,
                fontSize: 22,
                lineHeight: 30,
                paddingTop: 2,
                color: palette.gold300,
              }}
            >
              {okSent ? 'Sent to circle' : "I'm OK 🌙"}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>

      <PillButton variant="danger" size="lg" block style={{ marginTop: 10 }} onPress={onAlarm}>
        🚨  Need help · alert circle
      </PillButton>
    </Card>
  );
}

function FriendPickerSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (friendId: string) => void;
}) {
  const t = useTheme();
  const { members } = useCircle();
  return (
    <BottomSheet visible={open} onClose={onClose}>
      <Text style={{ fontFamily: t.type.display, fontSize: 24, lineHeight: 32, paddingTop: 2, marginBottom: 6 }}>
        Send wellness check
      </Text>
      <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 16 }}>
        Pick a friend. They'll see the prompt and have 30 minutes to respond.
      </Text>

      <View style={{ gap: 8 }}>
        {members.map((m) => (
          <Pressable
            key={m.edgeId}
            onPress={() => onPick(m.profile.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: t.radii.md,
              backgroundColor: t.colors.moonlight,
            }}
          >
            <Avatar
              name={m.profile.name ?? m.profile.email}
              size={44}
              photoUri={m.profile.avatar_url ?? undefined}
            />
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="semibold">
                {m.profile.name ?? m.profile.email}
              </Text>
              {m.relation && (
                <Eyebrow color={t.colors.gold700} style={{ marginTop: 2 }}>
                  {m.relation}
                </Eyebrow>
              )}
            </View>
            <IconChevron color={t.colors.inkMute} />
          </Pressable>
        ))}
      </View>

      <PillButton variant="ghost" block style={{ marginTop: 14 }} onPress={onClose}>
        Cancel
      </PillButton>
    </BottomSheet>
  );
}

function ScheduleCheckinSheet({
  open,
  onClose,
  current,
  onSchedule,
  onCancel,
}: {
  open: boolean;
  onClose: () => void;
  current: Date | null;
  onSchedule: (d: Date) => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const now = new Date();
  const [hour, setHour] = useState(now.getHours());
  const [minute, setMinute] = useState(Math.ceil(now.getMinutes() / 5) * 5 % 60);

  const bump = (setter: (v: number) => void, val: number, mod: number, step: number) =>
    setter(((val + step) % mod + mod) % mod);

  const buildDate = () => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    // If the time has already passed today, schedule for tomorrow
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d;
  };

  const fmt2 = (n: number) => String(n).padStart(2, '0');

  return (
    <BottomSheet visible={open} onClose={onClose}>
      <Text style={{ fontFamily: t.type.display, fontSize: 24, lineHeight: 32, paddingTop: 2, marginBottom: 4 }}>
        Check on me at…
      </Text>
      <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 20 }}>
        If you don't respond when the time comes, your circle is alerted.
      </Text>

      {/* Time picker */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
        {/* Hour */}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => bump(setHour, hour, 24, 1)}
            style={{ width: 48, height: 48, borderRadius: t.radii.md, backgroundColor: t.colors.moonlight, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: t.type.bodyBold, fontSize: 18, color: t.colors.ink, lineHeight: 22 }}>▲</Text>
          </Pressable>
          <View style={{ width: 70, height: 64, borderRadius: t.radii.md, backgroundColor: t.colors.forest700, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: t.type.display, fontSize: 28, color: '#fff', paddingTop: 4, includeFontPadding: false, lineHeight: 34 }}>{fmt2(hour)}</Text>
          </View>
          <Pressable
            onPress={() => bump(setHour, hour, 24, -1)}
            style={{ width: 48, height: 48, borderRadius: t.radii.md, backgroundColor: t.colors.moonlight, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: t.type.bodyBold, fontSize: 18, color: t.colors.ink, lineHeight: 22 }}>▼</Text>
          </Pressable>
        </View>

        <Text style={{ fontFamily: t.type.bodyBold, fontSize: 28, color: t.colors.ink, lineHeight: 34 }}>:</Text>

        {/* Minute */}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => bump(setMinute, minute, 60, 5)}
            style={{ width: 48, height: 48, borderRadius: t.radii.md, backgroundColor: t.colors.moonlight, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: t.type.bodyBold, fontSize: 18, color: t.colors.ink, lineHeight: 22 }}>▲</Text>
          </Pressable>
          <View style={{ width: 70, height: 64, borderRadius: t.radii.md, backgroundColor: t.colors.forest700, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: t.type.display, fontSize: 28, color: '#fff', paddingTop: 4, includeFontPadding: false, lineHeight: 34 }}>{fmt2(minute)}</Text>
          </View>
          <Pressable
            onPress={() => bump(setMinute, minute, 60, -5)}
            style={{ width: 48, height: 48, borderRadius: t.radii.md, backgroundColor: t.colors.moonlight, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: t.type.bodyBold, fontSize: 18, color: t.colors.ink, lineHeight: 22 }}>▼</Text>
          </Pressable>
        </View>
      </View>

      <PillButton block onPress={() => onSchedule(buildDate())} style={{ marginBottom: 8 }}>
        Set check-in for {fmt2(hour)}:{fmt2(minute)}
      </PillButton>

      {current && (
        <PillButton variant="danger" block onPress={onCancel} style={{ marginBottom: 8 }}>
          Cancel scheduled check-in
        </PillButton>
      )}

      <PillButton variant="ghost" block onPress={onClose}>
        Close
      </PillButton>
    </BottomSheet>
  );
}
