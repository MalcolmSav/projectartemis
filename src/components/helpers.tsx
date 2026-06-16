import React from 'react';
import { Pressable, View, ViewStyle, GestureResponderEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, Eyebrow } from './Text';
import { Avatar } from './Avatar';
import { BowArrow, IconChevron } from './icons';
import { useTheme } from '../theme/ThemeProvider';
import { palette } from '../theme/tokens';
import { CirclePerson, ArtemisEvent } from '../data/demo';

export function SectionTitle({
  children,
  right,
  style,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
        style,
      ]}
    >
      <Text variant="section" weight="medium">
        {children}
      </Text>
      {right}
    </View>
  );
}

export function Divider({ style }: { style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[{ height: 1, backgroundColor: t.colors.hairline }, style]} />;
}

export function StatusPill({ status, label }: { status: 'ok' | 'warn' | 'alarm'; label: string }) {
  const t = useTheme();
  const colorMap = {
    ok: { bg: t.colors.moonlight, text: t.colors.forest700, dot: t.colors.statusOk },
    warn: { bg: t.colors.gold100, text: t.colors.gold700, dot: t.colors.statusWarn },
    alarm: { bg: 'rgba(192,57,43,0.12)', text: t.colors.crimson, dot: t.colors.statusAlarm },
  }[status];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colorMap.bg,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: colorMap.dot }} />
      <Text variant="small" weight="semibold" color={colorMap.text}>
        {label}
      </Text>
    </View>
  );
}

export function CircleCard({
  person,
  photoUri,
  onPress,
}: {
  person: CirclePerson;
  photoUri?: string | null;
  onPress?: (e: GestureResponderEvent) => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          flexShrink: 0,
          width: 168,
          backgroundColor: t.colors.parchment,
          borderRadius: t.radii.lg,
          padding: 16,
        },
        t.shadows.card,
      ]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <Avatar name={person.name} size={48} status={person.status} photoUri={photoUri ?? undefined} />
        {person.verified && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <BowArrow size={12} />
            <Text variant="eyebrow" weight="semibold" color={t.colors.gold700}>
              VERIFIED
            </Text>
          </View>
        )}
      </View>
      <Text variant="large" weight="medium" style={{ fontSize: 19 }}>
        {person.name}
      </Text>
      <Text variant="meta" color={t.colors.inkMute}>
        {person.relation}
      </Text>
      <Divider style={{ marginVertical: 10 }} />
      <Eyebrow>Last seen</Eyebrow>
      <Text variant="small" color={t.colors.inkSoft}>
        {person.lastSeen} · {person.lastLocation}
      </Text>
    </Pressable>
  );
}

export function QuickAction({
  icon,
  label,
  sub,
  onPress,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onPress?: () => void;
  accent?: boolean;
}) {
  const t = useTheme();
  const inner = (
    <>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
          backgroundColor: accent ? 'rgba(226,189,110,0.2)' : t.colors.moonlight,
        }}
      >
        {icon}
      </View>
      <Text
        variant="body"
        weight="medium"
        style={{ fontFamily: t.type.display, fontSize: 16 }}
        color={accent ? palette.gold300 : t.colors.ink}
      >
        {label}
      </Text>
      <Text
        variant="eyebrow"
        weight="regular"
        style={{ marginTop: 2, letterSpacing: 0 }}
        color={accent ? 'rgba(242,226,187,0.7)' : t.colors.inkMute}
      >
        {sub}
      </Text>
    </>
  );

  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      {accent ? (
        <LinearGradient
          colors={[t.colors.forest700, t.colors.forest500]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            {
              borderRadius: t.radii.lg,
              padding: 16,
            },
            t.shadows.card,
          ]}
        >
          {inner}
        </LinearGradient>
      ) : (
        <View
          style={[
            {
              backgroundColor: t.colors.parchment,
              borderRadius: t.radii.lg,
              padding: 16,
            },
            t.shadows.card,
          ]}
        >
          {inner}
        </View>
      )}
    </Pressable>
  );
}

export function EventCard({ event }: { event: ArtemisEvent }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.colors.parchment, borderRadius: t.radii.lg, padding: 14 }, t.shadows.card]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
          <View
            style={{
              width: 46,
              paddingVertical: 6,
              borderRadius: 12,
              backgroundColor: t.colors.moonlight,
              alignItems: 'center',
            }}
          >
            <Text variant="eyebrow" color={t.colors.inkMute}>
              MAY
            </Text>
            <Text
              style={{
                fontFamily: t.type.display,
                fontSize: 22,
                color: t.colors.forest700,
                lineHeight: 22,
              }}
            >
              {event.day}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="large" weight="medium" style={{ fontFamily: t.type.display, fontSize: 18 }}>
              {event.title}
            </Text>
            <Text variant="small" color={t.colors.inkMute} style={{ marginTop: 2 }}>
              {event.time} · {event.location}
            </Text>
            {event.notes ? (
              <Text variant="meta" color={t.colors.inkSoft} style={{ marginTop: 6 }}>
                {event.notes}
              </Text>
            ) : null}
          </View>
        </View>
        {event.checkIn && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: t.colors.gold100,
              paddingVertical: 4,
              paddingHorizontal: 9,
              borderRadius: 999,
            }}
          >
            <Text variant="eyebrow" weight="semibold" color={t.colors.gold700} style={{ letterSpacing: 0.4 }}>
              🛡 CHECK-IN
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function Row({
  label,
  value,
  right,
  onPress,
}: {
  label: string;
  value?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Eyebrow>{label}</Eyebrow>
        {typeof value === 'string' ? <Text variant="body">{value}</Text> : value}
      </View>
      {right ?? (onPress ? <IconChevron color={t.colors.inkMute} /> : null)}
    </Pressable>
  );
}
