import React, { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
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
  useFeatureIntro,
  FeatureIntroSheet,
  FEATURES,
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
import { useCheckIns, WELLNESS_TIMEOUT_MS, SentCheck, ReceivedCheck } from '../hooks/useCheckIns';
import { useSafetyTimer } from '../hooks/useSafetyTimer';
import { useFollowedTrips } from '../hooks/useFollowedTrips';
import { useTrips } from '../hooks/useTrips';
import { formatDuration } from '../lib/routing';
import { useT, TFn } from '../i18n';
import { personName } from '../lib/person';
import { callPhone } from '../lib/call';
import { useConversations } from '../hooks/useConversations';
import { usePresence } from '../hooks/usePresence';
import { useStreak } from '../hooks/useStreak';
import { useAuth } from '../state/Auth';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function relativeTime(iso: string, tr: TFn) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return tr('just now');
  if (m < 60) return tr('{m} min ago', { m });
  const h = Math.floor(m / 60);
  if (h < 24) return tr('{h} hr ago', { h });
  return tr('{d}d ago', { d: Math.floor(h / 24) });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Tonight';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Tonight';
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function HomeScreen() {
  const t = useTheme();
  const tr = useT();
  const nav = useNavigation<Nav>();
  const { profile } = useAuth();
  const { members, pendingInvites, refresh: refreshCircle } = useCircle();
  const { latestByUser, myLastOkAt, pendingForMe, sentChecks, friendNeedHelp, clearFriendNeedHelp, recordOk, recordAlarm, sendWellnessRequest, respondWellness, refresh: refreshChecks } = useCheckIns();
  const { unreadTotal } = useConversations();
  const { byUser: presenceByUser } = usePresence();
  const { expiresAt: timerExpiresAt, expired: timerExpired, start: startTimer, clear: clearTimer } = useSafetyTimer();
  const { trips: followedTrips } = useFollowedTrips();
  const { activeTrip } = useTrips();
  const streak = useStreak();
  const featureIntro = useFeatureIntro();
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const timerFiredRef = React.useRef(false);
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
  const shownWellnessRef = React.useRef<Set<string>>(new Set());

  // Live countdown for an active safety timer.
  useEffect(() => {
    if (!timerExpiresAt) return;
    if (Date.now() < timerExpiresAt.getTime()) timerFiredRef.current = false;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timerExpiresAt]);

  // Dead-man's-switch: when the safety timer expires without a "I'm safe"
  // confirmation, automatically raise the alarm.
  useEffect(() => {
    if (!timerExpired || timerFiredRef.current) return;
    timerFiredRef.current = true;
    (async () => {
      await recordAlarm('Safety timer expired — auto-alarm');
      await clearTimer();
      nav.navigate('AlarmActive');
    })();
  }, [timerExpired]);

  // Navigate to WellnessIncoming when a new wellness check arrives
  useEffect(() => {
    if (!pendingForMe) return;
    if (shownWellnessRef.current.has(pendingForMe.id)) return;
    shownWellnessRef.current.add(pendingForMe.id);
    nav.navigate('WellnessIncoming', {
      fromName: pendingForMe.from?.name ?? pendingForMe.from?.email ?? 'Someone',
      fromId: pendingForMe.user_id,
      checkInId: pendingForMe.id,
    });
  }, [pendingForMe]);

  // Friend responded "need help" to my wellness check
  useEffect(() => {
    if (!friendNeedHelp) return;
    const name = friendNeedHelp.profile?.name ?? friendNeedHelp.profile?.email ?? 'Your friend';
    Alert.alert(
      `⚠️ ${name} needs help`,
      `${name} responded to your wellness check saying they need help. Check on them now.`,
      [
        {
          text: 'Call them',
          onPress: () => {
            clearFriendNeedHelp();
            callPhone(friendNeedHelp.profile?.phone, name, tr);
          },
        },
        {
          text: 'Go to profile',
          onPress: () => {
            clearFriendNeedHelp();
            if (friendNeedHelp.profile?.id) nav.navigate('CirclePerson', { id: friendNeedHelp.profile.id });
          },
        },
        { text: 'Dismiss', style: 'cancel', onPress: clearFriendNeedHelp },
      ],
      { cancelable: false },
    );
  }, [friendNeedHelp]);

  // A circle member raising a full alarm (the red button) is handled globally
  // by IncomingAlarmWatcher → FriendAlarmScreen, so we deliberately do NOT show
  // a second Alert popup here. The milder wellness "I need help" (friendNeedHelp
  // above) keeps its lightweight prompt, since it isn't a whole-circle emergency.

  const lastOkLabel = myLastOkAt ? relativeTime(myLastOkAt, tr) : tr('no check-in yet');

  const pulseScale = useSharedValue(0.5);
  const pulseOpacity = useSharedValue(0);

  const handleOk = async () => {
    setOkSent(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    pulseScale.value = 0.5;
    pulseOpacity.value = 0.9;
    pulseScale.value = withTiming(1.6, { duration: t.motion.okPulse, easing: Easing.out(Easing.ease) });
    pulseOpacity.value = withTiming(0, { duration: t.motion.okPulse, easing: Easing.out(Easing.ease) });
    if (pendingForMe) {
      // Targeted reply so the requester sees that I specifically answered them.
      await respondWellness('ok', `Responded to ${pendingForMe.from?.name ?? 'wellness check'}`, pendingForMe.user_id);
    } else {
      await recordOk();
    }
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
          <Eyebrow style={{ marginBottom: 8 }}>{`${tr(greeting())}, ${profile?.name ?? ''}`}</Eyebrow>
          <Text variant="displayH1" style={{ lineHeight: 38 }}>
            {tr('Your circle is')}{' '}
            <Text variant="displayH1" italic accent style={{ lineHeight: 38 }}>
              {tr('watching over you.')}
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
              onNeedHelp={async () => {
                await respondWellness('wellness_response', 'need_help', pendingForMe.user_id);
              }}
              onAlarm={async () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                await recordAlarm('Manual alarm from wellness response');
                nav.navigate('AlarmActive');
              }}
              pulseStyle={pulseStyle}
            />
          ) : (
            <SendHero
              lastOkLabel={lastOkLabel}
              streak={streak}
              onOpen={() => {
                if (members.length === 0) {
                  nav.navigate('Tabs' as any, { screen: 'Circle' } as any);
                  return;
                }
                featureIntro.run(FEATURES.wellness, () => setPickerOpen(true));
              }}
              hasFriends={members.length > 0}
            />
          )}
        </View>

        {/* Live tracker for wellness checks you sent */}
        <SentChecksTracker
          sentChecks={sentChecks}
          onOpenMap={() => nav.navigate('Tabs' as any, { screen: 'Map' } as any)}
          onOpenPerson={(id) => nav.navigate('CirclePerson', { id })}
        />

        {/* Active trip banner — always visible on Home while a trip runs */}
        {activeTrip && (
          <View style={{ paddingHorizontal: t.spacing.pageH, paddingTop: 12 }}>
            <Pressable
              onPress={() => nav.navigate('TripActive')}
              accessibilityRole="button"
              accessibilityLabel="Open your active trip"
              style={{
                backgroundColor: t.colors.forest700,
                borderRadius: t.radii.lg,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <Text style={{ fontSize: 28, lineHeight: 34 }}>🧭</Text>
              <View style={{ flex: 1 }}>
                <Eyebrow color={palette.gold300}>{tr('TRIP IN PROGRESS')}</Eyebrow>
                <Text style={{ fontFamily: t.type.display, fontSize: 19, lineHeight: 26, paddingTop: 2, color: '#fff' }} numberOfLines={1}>
                  {activeTrip.destination}
                </Text>
                <Text variant="meta" color="rgba(255,255,255,0.7)" style={{ marginTop: 2 }}>
                  {[
                    activeTrip.remaining_s != null ? tr('{time} left', { time: formatDuration(activeTrip.remaining_s) }) : activeTrip.eta ? `ETA ${activeTrip.eta}` : null,
                    activeTrip.followed_at
                      ? tr('👀 {name} is following', {
                          name: personName(members.find((m) => m.profile.id === activeTrip.buddy_id)?.profile ?? null) || tr('your buddy'),
                        })
                      : tr('sharing live location'),
                  ].filter(Boolean).join('  ·  ')}
                </Text>
              </View>
              <IconChevron color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>
        )}

        {/* Active safety timer banner */}
        {timerExpiresAt && !timerExpired && (
          <View style={{ paddingHorizontal: t.spacing.pageH, paddingTop: 12 }}>
            <View
              style={{
                backgroundColor: t.colors.forest700,
                borderRadius: t.radii.lg,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <View style={{ flex: 1 }}>
                <Eyebrow color={palette.gold300}>{tr('SAFETY TIMER RUNNING')}</Eyebrow>
                <Text style={{ fontFamily: t.type.display, fontSize: 30, lineHeight: 38, paddingTop: 2, color: '#fff', marginTop: 2 }}>
                  {formatCountdown(timerExpiresAt.getTime() - nowTick)}
                </Text>
                <Text variant="meta" color="rgba(255,255,255,0.7)" style={{ marginTop: 2 }}>
                  {tr("Your circle is alerted if you don't confirm.")}
                </Text>
              </View>
              <Pressable
                onPress={async () => {
                  await recordOk('Confirmed safe — safety timer');
                  await clearTimer();
                }}
                accessibilityRole="button"
                accessibilityLabel="I'm safe, cancel the safety timer"
                style={{
                  backgroundColor: palette.gold500,
                  borderRadius: 999,
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                }}
              >
                <Text style={{ fontFamily: t.type.bodyBold, color: palette.forest900, fontSize: 15 }}>
                  {tr("I'm safe")}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Someone wants you to follow their trip */}
        {followedTrips.map((ft) => {
          const travelerName = ft.traveler?.name ?? ft.traveler?.email ?? 'A friend';
          return (
            <View key={ft.id} style={{ paddingHorizontal: t.spacing.pageH, paddingTop: 12 }}>
              <Pressable
                onPress={() => nav.navigate('TripFollow', { tripId: ft.id })}
                accessibilityRole="button"
                accessibilityLabel={`Follow ${travelerName}'s trip`}
                style={{
                  backgroundColor: t.colors.gold100,
                  borderRadius: t.radii.lg,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Avatar name={travelerName} size={44} photoUri={ft.traveler?.avatar_url ?? undefined} />
                <View style={{ flex: 1 }}>
                  <Eyebrow color={t.colors.gold700}>{tr('FOLLOW THEIR TRIP 👀')}</Eyebrow>
                  <Text variant="body" weight="semibold" style={{ marginTop: 2 }}>
                    {tr('{name} is heading to {dest}', { name: travelerName, dest: ft.destination })}
                  </Text>
                  <Text variant="meta" color={t.colors.inkSoft}>
                    {tr('Tap to watch their live location')}
                  </Text>
                </View>
                <IconChevron color={t.colors.inkMute} />
              </Pressable>
            </View>
          );
        })}

        {/* My Circle */}
        <View style={{ paddingHorizontal: t.spacing.pageH, paddingTop: 24, paddingBottom: 8 }}>
          <SectionTitle
            right={
              <Pressable
                onPress={() => nav.navigate('Tabs' as any, { screen: 'Circle' } as any)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Text variant="small" color={t.colors.inkSoft}>
                  {tr('See all')}
                </Text>
                <IconChevron size={12} color={t.colors.inkSoft} />
              </Pressable>
            }
          >
            {tr('My Circle')}
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
                {tr('Your circle is empty.')}
                {'\n'}{tr('Go to the Circle tab below to add someone by username.')}
              </Text>
              <PillButton size="md" onPress={() => nav.navigate('Tabs' as any, { screen: 'Circle' } as any)}>
                {tr('Open Circle')}
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
                ? tr('Active now')
                : last
                  ? relativeTime(last.created_at, tr)
                  : tr('no check-in');
              return (
                <CircleCard
                  key={m.edgeId}
                  photoUri={m.profile.avatar_url}
                  person={{
                    id: m.profile.id,
                    name: personName(m.profile),
                    relation: m.relation ?? tr('Friend'),
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
          <SectionTitle
            right={
              <Pressable
                onPress={() => nav.navigate('Activity')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Text variant="small" color={t.colors.inkSoft}>{tr('Activity')}</Text>
                <IconChevron size={12} color={t.colors.inkSoft} />
              </Pressable>
            }
          >
            {tr('Right now')}
          </SectionTitle>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <QuickAction
                icon={<IconLocate color={t.colors.forest700} />}
                label={tr('Trip Mode')}
                sub={tr('Track me home')}
                onPress={() => featureIntro.run(FEATURES.trip, () => nav.navigate('Trip'))}
              />
              <QuickAction
                icon={<IconMap color={t.colors.forest700} />}
                label={tr('Open map')}
                sub={tr('Reports near you')}
                onPress={() => featureIntro.run(FEATURES.map, () => nav.navigate('Tabs' as any, { screen: 'Map' } as any))}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <QuickAction
                icon={<IconPhone size={18} color={t.colors.forest700} />}
                label={tr('Fake call')}
                sub={tr('Way out')}
                onPress={() => featureIntro.run(FEATURES.fakecall, () => nav.navigate('FakeCall'))}
              />
              <QuickAction
                icon={<IconShare color={t.colors.forest700} />}
                label={tr('Share location')}
                sub={tr('Sharing with your circle')}
                onPress={() => featureIntro.run(FEATURES.locshare, () => nav.navigate('LocationShare'))}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <QuickAction
                icon={<IconCal color={t.colors.forest700} />}
                label={tr('Calendar')}
                sub={tr('Upcoming')}
                onPress={() => nav.navigate('Tabs' as any, { screen: 'Calendar' } as any)}
              />
              <QuickAction
                icon={<IconClock size={18} color={timerExpiresAt ? palette.gold500 : t.colors.forest700} />}
                label={timerExpiresAt ? tr('Check-in running') : tr('Check on me')}
                sub={
                  timerExpiresAt
                    ? tr('ends {time}', { time: timerExpiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
                    : tr('Alert if I go quiet')
                }
                accent={!!timerExpiresAt}
                onPress={() =>
                  timerExpiresAt
                    ? setSafetyOpen(true)
                    : featureIntro.run(FEATURES.safetytimer, () => setSafetyOpen(true))
                }
              />
            </View>
            <Pressable
              onPress={() => nav.navigate('EmergencyCall')}
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 14,
                  borderRadius: t.radii.lg,
                  backgroundColor: 'rgba(192,57,43,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(192,57,43,0.2)',
                },
              ]}
            >
              <Text style={{ fontFamily: t.type.bodySemibold, fontSize: 15, color: palette.crimson }}>
                {tr('📞  Call 112 — emergency instructions')}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <FriendPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={async (friendId) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const friendName = personName(members.find((m) => m.profile.id === friendId)?.profile ?? null) || tr('your friend');
          const res = await sendWellnessRequest(friendId);
          setPickerOpen(false);
          if (res.error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(
              tr('Give them a moment 🌙'),
              res.cooldownMins
                ? tr('You already checked on {name} recently. You can send another check in {m} min.', {
                    name: friendName,
                    m: res.cooldownMins,
                  })
                : res.error,
            );
          } else {
            Alert.alert(
              tr('Wellness check sent 🏹'),
              tr('{name} has 30 minutes to respond — you’ll be notified.', { name: friendName }),
            );
          }
        }}
      />

      <NotificationsSheet
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onOpenCircle={() => {
          setNotifOpen(false);
          nav.navigate('Tabs' as any, { screen: 'Circle' } as any);
        }}
        onOpenMap={() => {
          setNotifOpen(false);
          nav.navigate('Tabs' as any, { screen: 'Map' } as any);
        }}
        onOpenWellness={(rc) => {
          setNotifOpen(false);
          nav.navigate('WellnessIncoming', {
            fromName: personName(rc.from),
            fromId: rc.fromId,
            checkInId: rc.id,
          });
        }}
      />

      <CheckOnMeSheet
        open={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        active={timerExpiresAt}
        onStart={async (ms) => {
          await startTimer(ms);
          setSafetyOpen(false);
        }}
        onCancel={async () => {
          await clearTimer();
          setSafetyOpen(false);
        }}
      />

      <FeatureIntroSheet controller={featureIntro} />
    </View>
  );
}

function CheckOnMeSheet({
  open,
  onClose,
  active,
  onStart,
  onCancel,
}: {
  open: boolean;
  onClose: () => void;
  active: Date | null;
  onStart: (durationMs: number) => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const tr = useT();
  const [mode, setMode] = useState<'in' | 'at'>('in');
  const now = new Date();
  const [hour, setHour] = useState(now.getHours());
  const [minute, setMinute] = useState((Math.ceil(now.getMinutes() / 5) * 5) % 60);
  const DURATIONS = [15, 30, 45, 60, 90, 120];

  const bump = (setter: (v: number) => void, val: number, mod: number, step: number) =>
    setter((((val + step) % mod) + mod) % mod);
  const fmt2 = (n: number) => String(n).padStart(2, '0');

  const startAtTime = () => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); // next day if already passed
    onStart(d.getTime() - Date.now());
  };

  return (
    <BottomSheet visible={open} onClose={onClose}>
      <Text style={{ fontFamily: t.type.display, fontSize: 24, lineHeight: 32, paddingTop: 2, marginBottom: 4 }}>
        {tr('Check on me')}
      </Text>
      <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 16 }}>
        {tr('If you don\'t tap "I\'m safe" in time, your circle is alerted automatically and your live location is shared. Good for a walk, a date, or a late shift.')}
      </Text>

      {active ? (
        <>
          <View
            style={{
              backgroundColor: t.colors.gold100,
              borderRadius: t.radii.md,
              padding: 14,
              marginBottom: 14,
            }}
          >
            <Eyebrow color={t.colors.gold700}>{tr('RUNNING')}</Eyebrow>
            <Text variant="body" weight="semibold" style={{ marginTop: 2 }}>
              {tr('Alerts your circle at {time}', { time: active.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
            </Text>
          </View>
          <PillButton variant="danger" block style={{ marginBottom: 8 }} onPress={onCancel}>
            {tr('Cancel check-in')}
          </PillButton>
          <PillButton variant="ghost" block onPress={onClose}>
            {tr('Close')}
          </PillButton>
        </>
      ) : (
        <>
          {/* Mode switch: In (duration) vs At (clock time) */}
          <View style={{ flexDirection: 'row', backgroundColor: t.colors.moonlight, borderRadius: 999, padding: 3, marginBottom: 18 }}>
            {(['in', 'at'] as const).map((m) => {
              const activeMode = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 999,
                    alignItems: 'center',
                    backgroundColor: activeMode ? t.colors.forest700 : 'transparent',
                  }}
                >
                  <Text variant="small" weight="semibold" color={activeMode ? palette.gold300 : t.colors.inkSoft}>
                    {m === 'in' ? tr('In…') : tr('At a time')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {mode === 'in' ? (
            <>
              <Eyebrow style={{ marginBottom: 8 }}>{tr("ALERT MY CIRCLE IF I'M SILENT FOR")}</Eyebrow>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                {DURATIONS.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => onStart(m * 60 * 1000)}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 18,
                      borderRadius: t.radii.md,
                      backgroundColor: t.colors.moonlight,
                    }}
                  >
                    <Text variant="body" weight="semibold">
                      {m < 60 ? tr('{m} min', { m }) : tr('{h} hr', { h: m / 60 })}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <Eyebrow style={{ marginBottom: 8 }}>{tr('CHECK ON ME AT')}</Eyebrow>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Pressable onPress={() => bump(setHour, hour, 24, 1)} style={stepBtn(t)}>
                    <Text style={{ fontFamily: t.type.bodyBold, fontSize: 18, color: t.colors.ink, lineHeight: 22 }}>▲</Text>
                  </Pressable>
                  <View style={timeBox(t)}>
                    <Text style={timeTxt(t)}>{fmt2(hour)}</Text>
                  </View>
                  <Pressable onPress={() => bump(setHour, hour, 24, -1)} style={stepBtn(t)}>
                    <Text style={{ fontFamily: t.type.bodyBold, fontSize: 18, color: t.colors.ink, lineHeight: 22 }}>▼</Text>
                  </Pressable>
                </View>
                <Text style={{ fontFamily: t.type.bodyBold, fontSize: 28, color: t.colors.ink, lineHeight: 34 }}>:</Text>
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Pressable onPress={() => bump(setMinute, minute, 60, 5)} style={stepBtn(t)}>
                    <Text style={{ fontFamily: t.type.bodyBold, fontSize: 18, color: t.colors.ink, lineHeight: 22 }}>▲</Text>
                  </Pressable>
                  <View style={timeBox(t)}>
                    <Text style={timeTxt(t)}>{fmt2(minute)}</Text>
                  </View>
                  <Pressable onPress={() => bump(setMinute, minute, 60, -5)} style={stepBtn(t)}>
                    <Text style={{ fontFamily: t.type.bodyBold, fontSize: 18, color: t.colors.ink, lineHeight: 22 }}>▼</Text>
                  </Pressable>
                </View>
              </View>
              <PillButton block style={{ marginBottom: 8 }} onPress={startAtTime}>
                {tr('Check on me at {time}', { time: `${fmt2(hour)}:${fmt2(minute)}` })}
              </PillButton>
            </>
          )}

          <PillButton variant="ghost" block onPress={onClose}>
            {tr('Cancel')}
          </PillButton>
        </>
      )}
    </BottomSheet>
  );
}

function stepBtn(t: ReturnType<typeof useTheme>) {
  return { width: 48, height: 48, borderRadius: t.radii.md, backgroundColor: t.colors.moonlight, alignItems: 'center', justifyContent: 'center' } as const;
}
function timeBox(t: ReturnType<typeof useTheme>) {
  return { width: 70, height: 64, borderRadius: t.radii.md, backgroundColor: t.colors.forest700, alignItems: 'center', justifyContent: 'center' } as const;
}
function timeTxt(t: ReturnType<typeof useTheme>) {
  return { fontFamily: t.type.display, fontSize: 28, color: '#fff', paddingTop: 4, includeFontPadding: false as any, lineHeight: 34 } as const;
}

function NotificationsSheet({
  open,
  onClose,
  onOpenCircle,
  onOpenMap,
  onOpenWellness,
}: {
  open: boolean;
  onClose: () => void;
  onOpenCircle: () => void;
  onOpenMap: () => void;
  onOpenWellness: (rc: ReceivedCheck) => void;
}) {
  const t = useTheme();
  const tr = useT();
  const { pendingInvites } = useCircle();
  const { receivedChecks, sentChecks } = useCheckIns();
  const empty = pendingInvites.length === 0 && receivedChecks.length === 0 && sentChecks.length === 0;

  const statusFor = (s: (typeof sentChecks)[number]['status']) => {
    switch (s) {
      case 'ok':
        return { label: tr('✓ All good'), color: palette.statusOk };
      case 'need_help':
        return { label: tr('⚠️ Needs help'), color: palette.statusWarn };
      case 'alarm':
        return { label: tr('🚨 Alarm'), color: palette.crimson };
      default:
        return { label: tr('Awaiting reply'), color: t.colors.inkMute };
    }
  };

  return (
    <BottomSheet visible={open} onClose={onClose}>
      <Text style={{ fontFamily: t.type.display, fontSize: 24, lineHeight: 32, paddingTop: 2, marginBottom: 6 }}>
        {tr('Notifications')}
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
            {tr("All quiet.\nYou'll see invites and wellness checks here.")}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {/* Wellness checks sent TO me — persisted here so a check missed as
              a push notification is still discoverable in the app. */}
          {receivedChecks.length > 0 && (
            <>
              <Eyebrow style={{ marginBottom: 2 }}>{tr('CHECKS ON YOU')}</Eyebrow>
              {receivedChecks.map((rc) => {
                const name = personName(rc.from);
                const pendingRc = rc.status === 'pending';
                const st =
                  rc.status === 'answered'
                    ? { label: tr('You responded ✓'), color: palette.statusOk }
                    : pendingRc
                      ? { label: tr('Respond'), color: t.colors.gold700 }
                      : { label: tr('Missed · reply anyway'), color: palette.statusWarn };
                return (
                  <Pressable
                    key={rc.id}
                    onPress={rc.status !== 'answered' ? () => onOpenWellness(rc) : undefined}
                    style={{
                      backgroundColor: pendingRc ? t.colors.gold100 : t.colors.moonlight,
                      borderRadius: t.radii.md,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <Avatar name={name} size={40} photoUri={rc.from?.avatar_url ?? undefined} />
                    <View style={{ flex: 1 }}>
                      <Text variant="body" weight="semibold">
                        {name}
                      </Text>
                      <Text variant="meta" color={t.colors.inkMute}>
                        {tr('checked on you · {time}', { time: relativeTime(rc.createdAt, tr) })}
                      </Text>
                    </View>
                    <Text variant="small" weight="semibold" color={st.color}>
                      {st.label}
                    </Text>
                  </Pressable>
                );
              })}
            </>
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
                  {tr('wants to add you to their circle')}
                </Text>
              </View>
              <IconChevron color={t.colors.inkMute} />
            </Pressable>
          ))}

          {sentChecks.length > 0 && (
            <>
              <Eyebrow style={{ marginTop: 6, marginBottom: 2 }}>{tr('CHECKS YOU SENT')}</Eyebrow>
              {sentChecks.map((sc) => {
                const st = statusFor(sc.status);
                const name = personName(sc.to);
                const responded = sc.status !== 'pending';
                return (
                  <Pressable
                    key={sc.id}
                    onPress={responded ? onOpenMap : undefined}
                    accessibilityLabel={responded ? `See ${name} on the map` : undefined}
                    style={{
                      backgroundColor: t.colors.moonlight,
                      borderRadius: t.radii.md,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <Avatar name={name} size={40} photoUri={sc.to?.avatar_url ?? undefined} />
                    <View style={{ flex: 1 }}>
                      <Text variant="body" weight="semibold">
                        {name}
                      </Text>
                      <Text variant="meta" color={t.colors.inkMute}>
                        {tr('You checked in · {time}', { time: relativeTime(sc.createdAt, tr) })}
                        {sc.seenAt && sc.status === 'pending'
                          ? `  ·  👁 ${relativeTime(sc.seenAt, tr)}`
                          : ''}
                        {responded ? `  ·  ${tr('📍 View on map')}` : ''}
                      </Text>
                    </View>
                    <Text variant="small" weight="semibold" color={st.color}>
                      {st.label}
                    </Text>
                  </Pressable>
                );
              })}
            </>
          )}
        </View>
      )}

      <PillButton variant="ghost" block style={{ marginTop: 14 }} onPress={onClose}>
        {tr('Close')}
      </PillButton>
    </BottomSheet>
  );
}

/**
 * Live tracker for wellness checks the user has sent — shown directly on Home
 * so nobody has to dig through the bell sheet to know how a check is going.
 * States per row: awaiting (countdown + seen receipt + draining progress bar),
 * answered (how, and when), or expired with no reply (a safety signal).
 */
function SentChecksTracker({
  sentChecks,
  onOpenMap,
  onOpenPerson,
}: {
  sentChecks: SentCheck[];
  onOpenMap: () => void;
  onOpenPerson: (id: string) => void;
}) {
  const t = useTheme();
  const tr = useT();
  const [now, setNow] = useState(Date.now());

  // Only track recent activity here — full history lives in the bell sheet.
  const visible = sentChecks.filter((sc) => now - new Date(sc.createdAt).getTime() < 2 * 60 * 60 * 1000);
  const anyPending = visible.some(
    (sc) => sc.status === 'pending' && now - new Date(sc.createdAt).getTime() < WELLNESS_TIMEOUT_MS,
  );

  // Tick the countdowns while something is awaiting a reply.
  useEffect(() => {
    if (!anyPending) return;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [anyPending]);

  if (visible.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: t.spacing.pageH, paddingTop: 12 }}>
      <Card>
        <Eyebrow style={{ marginBottom: 4 }}>{tr('CHECKS YOU SENT')}</Eyebrow>
        {visible.map((sc, i) => {
          const name = personName(sc.to);
          const ageMs = now - new Date(sc.createdAt).getTime();
          const expired = sc.status === 'pending' && ageMs >= WELLNESS_TIMEOUT_MS;
          const pending = sc.status === 'pending' && !expired;
          const minsLeft = Math.max(0, Math.ceil((WELLNESS_TIMEOUT_MS - ageMs) / 60_000));
          const pct = Math.max(0, Math.min(1, 1 - ageMs / WELLNESS_TIMEOUT_MS));

          const statusEl = pending
            ? { label: tr('Awaiting reply'), color: t.colors.inkMute }
            : expired
              ? { label: tr('⏱ No reply'), color: palette.statusWarn }
              : sc.status === 'ok'
                ? { label: tr('✓ All good'), color: palette.statusOk }
                : sc.status === 'need_help'
                  ? { label: tr('⚠️ Needs help'), color: palette.statusWarn }
                  : { label: tr('🚨 Alarm'), color: palette.crimson };

          const sub = pending
            ? [
                sc.seenAt ? `👁 ${tr('Seen')} ${relativeTime(sc.seenAt, tr)}` : tr('Sent {time}', { time: relativeTime(sc.createdAt, tr) }),
                tr('{m} min left', { m: minsLeft }),
              ].join('  ·  ')
            : expired
              ? tr('No reply — reach out to them')
              : [
                  sc.respondedAt ? tr('Answered {time}', { time: relativeTime(sc.respondedAt, tr) }) : '',
                  tr('📍 View on map'),
                ].filter(Boolean).join('  ·  ');

          return (
            <View key={sc.id}>
              <Pressable
                onPress={
                  expired
                    ? () => sc.to?.id && onOpenPerson(sc.to.id)
                    : !pending
                      ? onOpenMap
                      : undefined
                }
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}
              >
                <Avatar name={name} size={38} photoUri={sc.to?.avatar_url ?? undefined} />
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="semibold">{name}</Text>
                  <Text variant="meta" color={expired ? palette.statusWarn : t.colors.inkMute} style={{ marginTop: 1 }}>
                    {sub}
                  </Text>
                  {pending && (
                    <View style={{ height: 3, backgroundColor: t.colors.hairline, borderRadius: 999, overflow: 'hidden', marginTop: 6 }}>
                      <View style={{ height: 3, width: `${pct * 100}%` as any, backgroundColor: palette.gold500, borderRadius: 999 }} />
                    </View>
                  )}
                </View>
                <Text variant="small" weight="semibold" color={statusEl.color}>
                  {statusEl.label}
                </Text>
              </Pressable>
              {i < visible.length - 1 && <View style={{ height: 1, backgroundColor: t.colors.hairline }} />}
            </View>
          );
        })}
      </Card>
    </View>
  );
}

function SendHero({
  lastOkLabel,
  onOpen,
  hasFriends,
  streak,
}: {
  lastOkLabel: string;
  onOpen: () => void;
  hasFriends: boolean;
  streak: number;
}) {
  const t = useTheme();
  const tr = useT();
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
        <View>
          <Eyebrow>{tr('Your last check-in')}</Eyebrow>
          <Text style={{ fontFamily: t.type.display, fontSize: 18, lineHeight: 26, paddingTop: 2 }}>
            {lastOkLabel}
          </Text>
          {streak >= 2 && (
            <Text variant="meta" color={t.colors.gold700} style={{ marginTop: 2 }}>
              🔥 {streak} {tr('day streak')}
            </Text>
          )}
        </View>
        <StatusPill status="ok" label={tr('All clear')} />
      </View>

      <PillButton
        size="lg"
        block
        iconLeft={<IconShield size={18} color={palette.gold300} />}
        onPress={onOpen}
      >
        {hasFriends ? tr('Send wellness check') : tr('Add a friend first')}
      </PillButton>
      <Text variant="meta" color={t.colors.inkMute} style={{ textAlign: 'center', marginTop: 8 }}>
        {tr("Pick a friend. They'll get the check-in prompt.")}
      </Text>
    </Card>
  );
}

function PendingHero({
  fromName,
  fromAvatar,
  okSent,
  onOk,
  onNeedHelp,
  onAlarm,
  pulseStyle,
}: {
  fromName: string;
  fromAvatar?: string;
  okSent: boolean;
  onOk: () => void;
  onNeedHelp: () => void;
  onAlarm: () => void;
  pulseStyle: any;
}) {
  const t = useTheme();
  const tr = useT();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Avatar name={fromName} size={44} photoUri={fromAvatar} />
        <View style={{ flex: 1 }}>
          <Eyebrow color={t.colors.gold700}>{tr('WELLNESS CHECK 🏹')}</Eyebrow>
          <Text style={{ fontFamily: t.type.display, fontSize: 18, lineHeight: 26, paddingTop: 2 }}>
            <Text style={{ fontFamily: t.type.displayItalic, color: t.colors.forest700 }}>{fromName}</Text>{' '}
            {tr('is checking in on you.')}
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
              {okSent ? tr('Sent to circle') : tr("I'm OK 🌙")}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>

      <PillButton
        variant="secondary"
        size="lg"
        block
        style={{ marginTop: 10, backgroundColor: '#FFF8E1' }}
        onPress={onNeedHelp}
      >
        {tr('⚠️  I need help · let {name} know', { name: fromName })}
      </PillButton>
      <PillButton variant="danger" size="lg" block style={{ marginTop: 8 }} onPress={onAlarm}>
        {tr('🚨  ALARM · alert entire circle')}
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
  const tr = useT();
  const { members } = useCircle();
  return (
    <BottomSheet visible={open} onClose={onClose}>
      <Text style={{ fontFamily: t.type.display, fontSize: 24, lineHeight: 32, paddingTop: 2, marginBottom: 6 }}>
        {tr('Send wellness check')}
      </Text>
      <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 16 }}>
        {tr("Pick a friend. They'll see the prompt and have 30 minutes to respond.")}
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
              name={personName(m.profile)}
              size={44}
              photoUri={m.profile.avatar_url ?? undefined}
            />
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="semibold">
                {personName(m.profile)}
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
        {tr('Cancel')}
      </PillButton>
    </BottomSheet>
  );
}
