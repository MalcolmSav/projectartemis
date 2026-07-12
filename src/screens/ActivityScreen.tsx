import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TopBar, Text, Eyebrow, Avatar, EmptyState } from '../components';
import { IconChevron } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { palette } from '../theme/tokens';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { useCircle } from '../hooks/useCircle';
import { useT } from '../i18n';
import { personName } from '../lib/person';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type EventKind = 'ok' | 'wellness_request' | 'wellness_response' | 'alarm' | 'trip_start' | 'trip_arrived' | 'trip_cancelled';

interface ActivityItem {
  id: string;
  kind: EventKind;
  actorId: string;
  actor: Profile | null;
  createdAt: string;
  isMe: boolean;
  extra?: string; // destination for trips, etc.
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function kindLabel(kind: EventKind, isMe: boolean, tr: (k: string) => string): string {
  switch (kind) {
    case 'ok': return tr('checked in OK');
    case 'wellness_request': return tr('sent a wellness check');
    case 'wellness_response': return tr('responded to a wellness check');
    case 'alarm': return tr('raised an alarm');
    case 'trip_start': return tr('started a trip');
    case 'trip_arrived': return tr('arrived safely');
    case 'trip_cancelled': return tr('cancelled their trip');
    default: return '';
  }
}

function kindEmoji(kind: EventKind): string {
  switch (kind) {
    case 'ok': return '✅';
    case 'wellness_request': return '🏹';
    case 'wellness_response': return '💬';
    case 'alarm': return '🚨';
    case 'trip_start': return '🧭';
    case 'trip_arrived': return '🏠';
    case 'trip_cancelled': return '✕';
    default: return '·';
  }
}

function kindColor(kind: EventKind, t: ReturnType<typeof useTheme>): string {
  switch (kind) {
    case 'alarm': return palette.crimson;
    case 'ok': return palette.statusOk ?? '#2e7d47';
    case 'trip_arrived': return '#2e7d47';
    default: return t.colors.inkSoft;
  }
}

export function ActivityScreen() {
  const t = useTheme();
  const tr = useT();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { members } = useCircle();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const circleIds = members.map((m) => m.profile.id);

  const load = useCallback(async () => {
    if (!user) return;
    const allIds = [user.id, ...circleIds];

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: checkIns }, { data: trips }] = await Promise.all([
      supabase
        .from('check_ins')
        .select('id, user_id, kind, created_at')
        .in('user_id', allIds)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(60),
      supabase
        .from('trips')
        .select('id, user_id, status, destination, created_at, updated_at')
        .in('user_id', allIds)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    // Fetch profiles for all actor IDs.
    const actorIdSet = new Set<string>([
      ...(checkIns ?? []).map((c: any) => c.user_id),
      ...(trips ?? []).map((tr: any) => tr.user_id),
    ]);
    const actorIds = Array.from(actorIdSet);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', actorIds);
    const profileMap: Record<string, Profile> = {};
    (profiles ?? []).forEach((p: Profile) => (profileMap[p.id] = p));

    const result: ActivityItem[] = [];

    // Check-ins (exclude wellness_request directed at others from feed — too noisy).
    for (const c of (checkIns ?? []) as any[]) {
      result.push({
        id: `ci-${c.id}`,
        kind: c.kind as EventKind,
        actorId: c.user_id,
        actor: profileMap[c.user_id] ?? null,
        createdAt: c.created_at,
        isMe: c.user_id === user.id,
      });
    }

    // Trips — emit one item per status: start (created_at) + completion (updated_at if status changed).
    for (const trip of (trips ?? []) as any[]) {
      result.push({
        id: `trip-start-${trip.id}`,
        kind: 'trip_start',
        actorId: trip.user_id,
        actor: profileMap[trip.user_id] ?? null,
        createdAt: trip.created_at,
        isMe: trip.user_id === user.id,
        extra: trip.destination,
      });
      if (trip.status === 'arrived') {
        result.push({
          id: `trip-end-${trip.id}`,
          kind: 'trip_arrived',
          actorId: trip.user_id,
          actor: profileMap[trip.user_id] ?? null,
          createdAt: trip.updated_at,
          isMe: trip.user_id === user.id,
          extra: trip.destination,
        });
      } else if (trip.status === 'cancelled') {
        result.push({
          id: `trip-cancel-${trip.id}`,
          kind: 'trip_cancelled',
          actorId: trip.user_id,
          actor: profileMap[trip.user_id] ?? null,
          createdAt: trip.updated_at,
          isMe: trip.user_id === user.id,
        });
      }
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setItems(result);
    setLoading(false);
  }, [user, circleIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <TopBar
        left={
          <Pressable onPress={() => nav.goBack()} accessibilityRole="button" style={{ padding: 4 }}>
            <IconChevron dir="left" color={t.colors.inkSoft} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.colors.forest700} />}
      >
        <Text variant="displayH1" style={{ marginBottom: 20 }}>
          {tr('Activity')}
        </Text>

        {loading ? (
          <ActivityIndicator color={t.colors.forest700} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <EmptyState
            title={tr('No recent activity')}
            subtitle={tr('Nothing from your circle yet.')}
          />
        ) : (
          <View>
            {items.map((item, i) => {
              const name = item.isMe ? 'You' : personName(item.actor);
              const color = kindColor(item.kind, t);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => item.actor?.id && !item.isMe && nav.navigate('CirclePerson', { id: item.actor.id })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 12,
                    borderBottomWidth: i < items.length - 1 ? 1 : 0,
                    borderBottomColor: t.colors.hairline,
                  }}
                >
                  {/* Avatar with emoji badge */}
                  <View style={{ position: 'relative' }}>
                    <Avatar name={name} size={44} photoUri={item.actor?.avatar_url ?? undefined} />
                    <View
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: t.colors.parchment,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 11, lineHeight: 14 }}>{kindEmoji(item.kind)}</Text>
                    </View>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text variant="body">
                      <Text variant="body" weight="semibold">{name}</Text>
                      {' '}
                      <Text variant="body" color={color}>{kindLabel(item.kind, item.isMe, tr)}</Text>
                      {item.extra ? ` · ${item.extra}` : ''}
                    </Text>
                    <Text variant="meta" color={t.colors.inkMute}>
                      {relativeTime(item.createdAt)}
                    </Text>
                  </View>

                  {!item.isMe && <IconChevron color={t.colors.inkMute} />}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
