import React, { useState } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
} from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { palette } from '../theme/tokens';
import { useCircle } from '../hooks/useCircle';
import { useCheckIns } from '../hooks/useCheckIns';
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
  const { members, pendingInvites } = useCircle();
  const { latestByUser, pendingForMe, recordOk, recordAlarm, sendWellnessRequest } = useCheckIns();
  const totalPending = pendingInvites.length + (pendingForMe ? 1 : 0);
  const [okSent, setOkSent] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

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
          <Pressable
            onPress={() => setNotifOpen(true)}
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
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
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
              <Text variant="small" color={t.colors.inkSoft} style={{ textAlign: 'center' }}>
                Your circle is empty.{'\n'}Tap "Circle" to invite someone.
              </Text>
            </View>
          ) : (
            members.map((m) => {
              const last = latestByUser[m.profile.id];
              const status: 'ok' | 'warn' | 'alarm' = last
                ? last.kind === 'alarm'
                  ? 'alarm'
                  : Date.now() - new Date(last.created_at).getTime() < 6 * 3600_000
                    ? 'ok'
                    : 'warn'
                : 'warn';
              return (
                <CircleCard
                  key={m.edgeId}
                  photoUri={m.profile.avatar_url}
                  person={{
                    id: m.profile.id,
                    name: m.profile.name ?? m.profile.email,
                    relation: m.relation ?? 'Friend',
                    lastSeen: last ? relativeTime(last.created_at) : 'no check-in',
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
                sub="On · 3 people"
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
                icon={<IconShield color={palette.gold300} />}
                label="Demo flow"
                sub="Receive check"
                accent
                onPress={() => nav.navigate('WellnessIncoming', { fromName: 'Demo' })}
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
