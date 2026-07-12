import React, { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { ScrollView, View, Pressable, TextInput, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TopBar, Text, Eyebrow, Avatar, Card, PillButton, BottomSheet, Divider, EmptyState } from '../components';
import { IconPlus, IconChevron, BowArrow } from '../components/icons';
import { supabase, Profile } from '../lib/supabase';
import { personName } from '../lib/person';
import { useTheme } from '../theme/ThemeProvider';
import { palette } from '../theme/tokens';
import { useT } from '../i18n';
import { useCircle } from '../hooks/useCircle';
import { useCheckIns } from '../hooks/useCheckIns';
import { usePresence } from '../hooks/usePresence';
import { useAuth } from '../state/Auth';
import { RootStackParamList } from '../navigation/types';
import { CHECKIN_STALE_MS } from '../lib/constants';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function CircleScreen() {
  const t = useTheme();
  const tr = useT();
  const nav = useNavigation<Nav>();
  const { members, pendingInvites, loading, error, invite, accept, decline, remove, refresh } = useCircle();
  const [refreshing, setRefreshing] = useState(false);
  const onPullRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };
  const confirmRemove = (edgeId: string, name: string) => {
    Alert.alert('Remove from circle?', `${name} will no longer see your check-ins.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove(edgeId) },
    ]);
  };
  const { latestByUser } = useCheckIns();
  const { byUser: presenceByUser } = usePresence();
  const [addOpen, setAddOpen] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const statusFor = (id: string): 'ok' | 'warn' | 'alarm' => {
    const c = latestByUser[id];
    if (!c) return 'warn';
    if (c.kind === 'alarm') return 'alarm';
    return Date.now() - new Date(c.created_at).getTime() < CHECKIN_STALE_MS ? 'ok' : 'warn';
  };
  const lastSeenFor = (id: string) => {
    const c = latestByUser[id];
    if (!c) return tr('No check-in yet');
    const ms = Date.now() - new Date(c.created_at).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return tr('Just now');
    if (m < 60) return tr('{m} min ago', { m });
    const h = Math.floor(m / 60);
    if (h < 24) return tr('{h} hr ago', { h });
    return tr('{d}d ago', { d: Math.floor(h / 24) });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <TopBar
        right={
          <Pressable
            onPress={() => setAddOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Add someone to your circle"
            style={[
              { width: 40, height: 40, borderRadius: 999, backgroundColor: t.colors.parchment, alignItems: 'center', justifyContent: 'center' },
              t.shadows.soft,
            ]}
          >
            <IconPlus color={t.colors.inkSoft} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={t.colors.forest700} />}
      >
        <Text variant="displayH1" style={{ marginBottom: 14 }}>
          {tr('My')}{' '}
          <Text variant="displayH1" italic accent>
            {tr('circle')}
          </Text>
        </Text>

        {error && (
          <Pressable
            onPress={refresh}
            style={{
              backgroundColor: 'rgba(192,57,43,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(192,57,43,0.25)',
              borderRadius: t.radii.md,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <Text variant="small" weight="semibold" color={palette.crimson}>
              {tr("Couldn't load your circle")}
            </Text>
            <Text variant="meta" color={t.colors.inkSoft} style={{ marginTop: 2 }}>
              {error} · {tr('Tap to retry')}
            </Text>
          </Pressable>
        )}

        {pendingInvites.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Eyebrow style={{ marginBottom: 8 }}>{tr('PENDING INVITES')}</Eyebrow>
            {pendingInvites.map((inv) => (
              <Card key={inv.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <Avatar name={inv.from?.name ?? '?'} size={40} photoUri={inv.from?.avatar_url ?? undefined} />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="semibold">
                      {inv.from?.name ?? inv.from?.email ?? 'Someone'}
                    </Text>
                    <Text variant="meta" color={t.colors.inkMute}>
                      {tr('wants to add you to their circle')}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <PillButton style={{ flex: 1 }} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); accept(inv); }}>
                    {tr('Accept')}
                  </PillButton>
                  <PillButton variant="ghost" style={{ flex: 1 }} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); decline(inv); }}>
                    {tr('Decline')}
                  </PillButton>
                </View>
              </Card>
            ))}
          </View>
        )}

        {loading ? (
          <View style={{ gap: 1 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 }}>
                <View style={{ width: 52, height: 52, borderRadius: 999, backgroundColor: t.colors.hairline, opacity: 0.6 }} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ height: 14, width: '55%', borderRadius: 6, backgroundColor: t.colors.hairline, opacity: 0.6 }} />
                  <View style={{ height: 11, width: '35%', borderRadius: 6, backgroundColor: t.colors.hairline, opacity: 0.4 }} />
                </View>
              </View>
            ))}
          </View>
        ) : members.length === 0 ? (
          <EmptyState
            title={tr('Your circle is waiting')}
            subtitle={tr('Search for someone by their Artemis username to add them.')}
            actionLabel={tr('+ Add someone')}
            onAction={() => setAddOpen(true)}
          />
        ) : (
          <View style={{ gap: 4 }}>
            {members.map((m) => {
              const c = latestByUser[m.profile.id];
              const presence = presenceByUser[m.profile.id];
              const recentPresence = presence && Date.now() - new Date(presence.updated_at).getTime() < 5 * 60_000;
              const hoursSince = c ? (Date.now() - new Date(c.created_at).getTime()) / 3_600_000 : null;
              const safeColor = !c ? t.colors.inkMute : hoursSince! < 8 ? '#2e7d47' : hoursSince! < 48 ? '#c07c1e' : palette.crimson;
              const battery = presence?.battery_level;
              const batteryText = battery != null ? ` · 🔋${Math.round(battery * 100)}%` : '';
              return (
                <Pressable
                  key={m.edgeId}
                  onPress={() => nav.navigate('CirclePerson', { id: m.profile.id })}
                  onLongPress={() => confirmRemove(m.edgeId, personName(m.profile))}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    gap: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: t.colors.hairline,
                  }}
                >
                  <Avatar
                    name={personName(m.profile)}
                    size={52}
                    status={statusFor(m.profile.id)}
                    photoUri={m.profile.avatar_url ?? undefined}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text variant="body" weight="semibold">
                        {personName(m.profile)}
                      </Text>
                      {m.verified && <BowArrow size={12} />}
                    </View>
                    {m.relation && (
                      <Eyebrow color={t.colors.gold700} style={{ marginTop: 2 }}>
                        {m.relation}
                      </Eyebrow>
                    )}
                    <Text variant="meta" color={safeColor} style={{ marginTop: 2 }}>
                      {recentPresence ? tr('Active now') : lastSeenFor(m.profile.id)}{batteryText}
                    </Text>
                  </View>
                  <IconChevron color={t.colors.inkMute} />
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          onPress={() => setAddOpen(true)}
          style={{
            marginTop: 14,
            padding: 18,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: t.colors.hairline,
            borderRadius: t.radii.lg,
            alignItems: 'center',
          }}
        >
          <Text variant="body" color={t.colors.inkSoft}>
            {tr('+ Invite someone')}
          </Text>
        </Pressable>
      </ScrollView>

      <InviteSheet open={addOpen} onClose={() => setAddOpen(false)} onSubmit={invite} />
    </View>
  );
}

function InviteSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (email: string, relation: string | null) => Promise<{ error?: string }>;
}) {
  const t = useTheme();
  const tr = useT();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [relation, setRelation] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const search = async (q: string) => {
    const trimmed = q.trim().toLowerCase().replace(/^@/, '');
    if (trimmed.length < 2) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${trimmed}%,name.ilike.%${trimmed}%`)
      .neq('id', user?.id ?? '')
      .limit(8);
    setResults((data ?? []) as Profile[]);
    setSearching(false);
  };

  const pickUser = (p: Profile) => {
    setSelected(p);
    setQuery('');
    setResults([]);
    setErr(null);
  };

  const handleClose = () => {
    setQuery('');
    setSelected(null);
    setResults([]);
    setErr(null);
    setDone(false);
    setRelation('');
    onClose();
  };

  const submit = async () => {
    if (!selected) { setErr('Search for and select a person first.'); return; }
    setBusy(true);
    setErr(null);
    const res = await onSubmit(selected.email, relation || null);
    setBusy(false);
    if (res.error) setErr(res.error);
    else {
      setDone(true);
      setTimeout(() => {
        setDone(false);
        handleClose();
      }, 1400);
    }
  };

  return (
    <BottomSheet visible={open} onClose={handleClose}>
      <Text style={{ fontFamily: t.type.display, fontSize: 24, marginBottom: 4 }}>{tr('Add to circle')}</Text>
      <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 16 }}>
        {tr("Search by username or name. They'll get a notification and can accept your invite.")}
      </Text>

      <Eyebrow style={{ marginBottom: 6 }}>{tr('FIND BY USERNAME')}</Eyebrow>

      {selected ? (
        /* Confirmed person chip */
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: t.colors.moonlight,
            borderRadius: t.radii.md,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <Avatar name={personName(selected)} size={40} photoUri={selected.avatar_url ?? undefined} />
          <View style={{ flex: 1 }}>
            <Text variant="body" weight="semibold">{personName(selected)}</Text>
            {selected.username && (
              <Text variant="meta" color={t.colors.inkMute}>@{selected.username}</Text>
            )}
          </View>
          <Pressable onPress={() => setSelected(null)} hitSlop={10}>
            <Text variant="small" color={t.colors.crimson} weight="semibold">✕</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={{ position: 'relative', marginBottom: 6 }}>
            <TextInput
              value={query}
              onChangeText={(v) => { setQuery(v); search(v); }}
              placeholder="@username or name"
              placeholderTextColor={t.colors.inkMute}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: t.colors.moonlight,
                borderRadius: t.radii.md,
                padding: 14,
                fontFamily: t.type.body,
                color: t.colors.ink,
              }}
            />
            {searching && (
              <View style={{ position: 'absolute', right: 14, top: 14 }}>
                <ActivityIndicator size="small" color={t.colors.forest700} />
              </View>
            )}
          </View>

          {results.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              {results.map((p, i) => (
                <View key={p.id}>
                  <Pressable
                    onPress={() => pickUser(p)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}
                  >
                    <Avatar name={personName(p)} size={38} photoUri={p.avatar_url ?? undefined} />
                    <View style={{ flex: 1 }}>
                      <Text variant="body" weight="semibold">{personName(p)}</Text>
                      {p.username && (
                        <Text variant="meta" color={t.colors.inkMute}>@{p.username}</Text>
                      )}
                    </View>
                    <Text variant="small" color={t.colors.gold700} weight="semibold">{tr('Add')}</Text>
                  </Pressable>
                  {i < results.length - 1 && <Divider />}
                </View>
              ))}
            </Card>
          )}

          {query.trim().length > 1 && results.length === 0 && !searching && (
            <Text variant="small" color={t.colors.inkMute} style={{ marginBottom: 10 }}>
              {tr('No users found. Make sure you have their exact username.')}
            </Text>
          )}
        </>
      )}

      <Eyebrow style={{ marginBottom: 6, marginTop: 4 }}>{tr('RELATION (OPTIONAL)')}</Eyebrow>
      <TextInput
        value={relation}
        onChangeText={setRelation}
        placeholder="Mamma, Kompis, Syster…"
        placeholderTextColor={t.colors.inkMute}
        style={{
          backgroundColor: t.colors.moonlight,
          borderRadius: t.radii.md,
          padding: 14,
          fontFamily: t.type.body,
          color: t.colors.ink,
          marginBottom: 14,
        }}
      />

      {err && (
        <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 10 }}>
          {err}
        </Text>
      )}
      {done && (
        <Text variant="small" color={t.colors.statusOk} style={{ marginBottom: 10 }}>
          {tr("Invite sent — they'll see it in their notifications ✓")}
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <PillButton variant="ghost" style={{ flex: 1 }} onPress={handleClose} disabled={busy}>
          {tr('Cancel')}
        </PillButton>
        <PillButton style={{ flex: 1 }} onPress={submit} disabled={busy || !selected}>
          {busy ? tr('Sending…') : tr('Send invite')}
        </PillButton>
      </View>
    </BottomSheet>
  );
}
