import React, { useState } from 'react';
import { ScrollView, View, Pressable, TextInput, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TopBar, Text, Eyebrow, Avatar, Card, PillButton, BottomSheet } from '../components';
import { IconPlus, IconChevron, BowArrow } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { palette } from '../theme/tokens';
import { useCircle } from '../hooks/useCircle';
import { useCheckIns } from '../hooks/useCheckIns';
import { useAuth } from '../state/Auth';
import { RootStackParamList } from '../navigation/types';
import { CHECKIN_STALE_MS } from '../lib/constants';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function CircleScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { signOut } = useAuth();
  const { members, pendingInvites, loading, invite, accept, decline, remove, refresh } = useCircle();
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
    if (!c) return 'No check-in yet';
    const ms = Date.now() - new Date(c.created_at).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hr ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <TopBar
        right={
          <>
            <Pressable
              onPress={signOut}
              style={[
                { paddingHorizontal: 12, height: 40, borderRadius: 999, backgroundColor: t.colors.parchment, alignItems: 'center', justifyContent: 'center' },
                t.shadows.soft,
              ]}
            >
              <Text variant="small" color={t.colors.inkSoft} weight="semibold">
                Sign out
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAddOpen(true)}
              style={[
                { width: 40, height: 40, borderRadius: 999, backgroundColor: t.colors.parchment, alignItems: 'center', justifyContent: 'center' },
                t.shadows.soft,
              ]}
            >
              <IconPlus color={t.colors.inkSoft} />
            </Pressable>
          </>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={t.colors.forest700} />}
      >
        <Text variant="displayH1" style={{ marginBottom: 14 }}>
          My{' '}
          <Text variant="displayH1" italic accent>
            circle
          </Text>
        </Text>

        {pendingInvites.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Eyebrow style={{ marginBottom: 8 }}>PENDING INVITES</Eyebrow>
            {pendingInvites.map((inv) => (
              <Card key={inv.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <Avatar name={inv.from?.name ?? '?'} size={40} photoUri={inv.from?.avatar_url ?? undefined} />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="semibold">
                      {inv.from?.name ?? inv.from?.email ?? 'Someone'}
                    </Text>
                    <Text variant="meta" color={t.colors.inkMute}>
                      wants to add you to their circle
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <PillButton style={{ flex: 1 }} onPress={() => accept(inv)}>
                    Accept
                  </PillButton>
                  <PillButton variant="ghost" style={{ flex: 1 }} onPress={() => decline(inv)}>
                    Decline
                  </PillButton>
                </View>
              </Card>
            ))}
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={t.colors.forest700} style={{ marginTop: 40 }} />
        ) : members.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text variant="body" color={t.colors.inkSoft} style={{ textAlign: 'center', marginBottom: 18 }}>
              Your circle is empty.
              {'\n'}Invite someone you trust by sending an email invite.
            </Text>
            <PillButton onPress={() => setAddOpen(true)}>+ Invite by email</PillButton>
          </View>
        ) : (
          <View style={{ gap: 4 }}>
            {members.map((m) => (
              <Pressable
                key={m.edgeId}
                onPress={() => nav.navigate('CirclePerson', { id: m.profile.id })}
                onLongPress={() => confirmRemove(m.edgeId, m.profile.name ?? m.profile.email)}
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
                  name={m.profile.name ?? m.profile.email}
                  size={52}
                  status={statusFor(m.profile.id)}
                  photoUri={m.profile.avatar_url ?? undefined}
                />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text variant="body" weight="semibold">
                      {m.profile.name ?? m.profile.email}
                    </Text>
                    {m.verified && <BowArrow size={12} />}
                  </View>
                  {m.relation && (
                    <Eyebrow color={t.colors.gold700} style={{ marginTop: 2 }}>
                      {m.relation}
                    </Eyebrow>
                  )}
                  <Text variant="meta" color={t.colors.inkMute} style={{ marginTop: 2 }}>
                    {lastSeenFor(m.profile.id)}
                  </Text>
                </View>
                <IconChevron color={t.colors.inkMute} />
              </Pressable>
            ))}
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
            + Invite someone
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
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const res = await onSubmit(email, relation || null);
    setBusy(false);
    if (res.error) setErr(res.error);
    else {
      setDone(true);
      setTimeout(() => {
        setDone(false);
        setEmail('');
        setRelation('');
        onClose();
      }, 1200);
    }
  };

  return (
    <BottomSheet visible={open} onClose={onClose}>
      <Text style={{ fontFamily: t.type.display, fontSize: 24, marginBottom: 4 }}>Invite to circle</Text>
      <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 16 }}>
        They'll see your invite when they sign in. Once accepted, you'll see each other's check-ins.
      </Text>

      <Eyebrow style={{ marginBottom: 6 }}>EMAIL</Eyebrow>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="them@example.com"
        placeholderTextColor={t.colors.inkMute}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          backgroundColor: t.colors.moonlight,
          borderRadius: t.radii.md,
          padding: 14,
          fontFamily: t.type.body,
          color: t.colors.ink,
          marginBottom: 14,
        }}
      />

      <Eyebrow style={{ marginBottom: 6 }}>RELATION (OPTIONAL)</Eyebrow>
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
          Invite sent ✓
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <PillButton variant="ghost" style={{ flex: 1 }} onPress={onClose}>
          Cancel
        </PillButton>
        <PillButton style={{ flex: 1 }} onPress={submit} disabled={busy || !email}>
          {busy ? 'Sending…' : 'Send invite'}
        </PillButton>
      </View>
    </BottomSheet>
  );
}
