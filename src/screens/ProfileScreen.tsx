import React, { useState } from 'react';
import { ScrollView, View, Pressable, TextInput, Alert, RefreshControl } from 'react-native';
import { TopBar, Text, Eyebrow, Avatar, Card, Divider, PillButton, BottomSheet } from '../components';
import { ArtemisMark, IconLock } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';
import { useEvents } from '../hooks/useEvents';
import { supabase } from '../lib/supabase';
import { pickAndUploadAvatar } from '../lib/avatar';
import { getPin, setPin, isDefaultPin } from '../lib/pin';
import { palette } from '../theme/tokens';

export function ProfileScreen() {
  const t = useTheme();
  const { profile, signOut, refreshProfile } = useAuth();
  const { events } = useEvents();
  const [editOpen, setEditOpen] = useState(false);

  const display = profile?.name?.trim() || profile?.email?.split('@')[0] || '—';
  const [uploading, setUploading] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinIsDefault, setPinIsDefault] = useState(true);
  React.useEffect(() => {
    isDefaultPin().then(setPinIsDefault);
  }, [pinOpen]);

  const onPickAvatar = async () => {
    if (!profile) return;
    setUploading(true);
    await pickAndUploadAvatar(profile.id);
    setUploading(false);
    refreshProfile();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <TopBar />
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 120 }}>
        <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 22 }}>
          <Pressable onPress={onPickAvatar} disabled={uploading} accessibilityLabel="Change photo">
            <Avatar name={display} size={92} ring photoUri={profile?.avatar_url ?? undefined} />
          </Pressable>
          <Text variant="small" weight="semibold" color={t.colors.gold700} style={{ marginTop: 12 }}>
            {uploading ? 'Uploading…' : profile?.avatar_url ? 'Change photo' : 'Add photo'}
          </Text>
          <Text
            style={{
              fontFamily: t.type.display,
              fontSize: 28,
              lineHeight: 40,
              marginTop: 18,
              textAlign: 'center',
              paddingHorizontal: 8,
            }}
            numberOfLines={2}
          >
            {display}
          </Text>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginTop: 4, textAlign: 'center' }}>
            {profile?.bio?.trim() || profile?.email}
          </Text>
          <Pressable onPress={() => setEditOpen(true)} style={{ marginTop: 10 }}>
            <Text variant="small" weight="semibold" color={t.colors.gold700}>
              Edit profile
            </Text>
          </Pressable>
        </View>

        <Eyebrow style={{ marginBottom: 8 }}>ACCOUNT</Eyebrow>
        <Card style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text variant="meta" color={t.colors.inkMute}>
                EMAIL
              </Text>
              <Text variant="body">{profile?.email}</Text>
            </View>
          </View>
          {profile?.phone ? (
            <>
              <Divider style={{ marginVertical: 10 }} />
              <View>
                <Text variant="meta" color={t.colors.inkMute}>
                  PHONE
                </Text>
                <Text variant="body">{profile.phone}</Text>
              </View>
            </>
          ) : null}
        </Card>

        <Eyebrow style={{ marginBottom: 8 }}>SAFETY PIN</Eyebrow>
        <Pressable onPress={() => setPinOpen(true)}>
          <Card style={{ marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="semibold" style={{ letterSpacing: 6 }}>
                  ••••
                </Text>
                <Text variant="meta" color={pinIsDefault ? t.colors.crimson : t.colors.inkMute}>
                  {pinIsDefault ? 'Still using demo PIN — tap to change' : 'PIN set'}
                </Text>
              </View>
              <Text variant="small" weight="semibold" color={t.colors.gold700}>
                Change
              </Text>
            </View>
          </Card>
        </Pressable>

        {events.length > 0 && (
          <>
            <Eyebrow style={{ marginBottom: 8 }}>MY UPCOMING</Eyebrow>
            <Card style={{ marginBottom: 18 }}>
              {events.slice(0, 3).map((e, i) => (
                <View key={e.id}>
                  <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
                    <View style={{ width: 3, backgroundColor: palette.gold500, borderRadius: 2, marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text variant="body" weight="semibold">
                        {e.title}
                      </Text>
                      <Text variant="meta" color={t.colors.inkMute}>
                        {e.date}
                        {e.time ? ` · ${e.time}` : ''}
                        {e.location ? ` · ${e.location}` : ''}
                      </Text>
                    </View>
                  </View>
                  {i < Math.min(events.length, 3) - 1 && <Divider />}
                </View>
              ))}
            </Card>
          </>
        )}

        <Eyebrow style={{ marginBottom: 8 }}>APPEARANCE</Eyebrow>
        <Card style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="body">Mode</Text>
            <View style={{ flexDirection: 'row', backgroundColor: t.colors.moonlight, borderRadius: 999, padding: 3 }}>
              {(['light', 'night'] as const).map((m) => {
                const active = t.mode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => t.setMode(m)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      backgroundColor: active ? t.colors.forest700 : 'transparent',
                    }}
                  >
                    <Text variant="small" weight="semibold" color={active ? palette.gold300 : t.colors.inkSoft}>
                      {m === 'light' ? 'Day' : 'Night'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Card>

        <PillButton
          variant="secondary"
          block
          onPress={() => {
            Alert.alert('Sign out?', 'You can sign back in anytime.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
            ]);
          }}
        >
          Sign out
        </PillButton>

        <PillButton
          variant="ghost"
          block
          style={{ marginTop: 8 }}
          onPress={() => {
            Alert.alert(
              'Delete account?',
              'This permanently removes your profile, circle, events and check-ins. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await supabase.rpc('delete_my_account');
                    await signOut();
                  },
                },
              ],
            );
          }}
        >
          <Text variant="small" weight="semibold" color={t.colors.crimson}>
            Delete account
          </Text>
        </PillButton>

        <View style={{ alignItems: 'center', opacity: 0.4, marginTop: 24 }}>
          <ArtemisMark size={36} moonColor={t.colors.forest700} />
          <Text style={{ fontFamily: t.type.displayItalic, fontSize: 12, marginTop: 6, color: t.colors.inkMute }}>
            Artemis · she who watches
          </Text>
        </View>
      </ScrollView>

      <EditProfileSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          refreshProfile();
          setEditOpen(false);
        }}
      />
      <ChangePinSheet open={pinOpen} onClose={() => setPinOpen(false)} />
    </View>
  );
}

function ChangePinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  React.useEffect(() => {
    if (open) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setErr(null);
      setDone(false);
    }
  }, [open]);

  const submit = async () => {
    setErr(null);
    const expected = await getPin();
    if (current !== expected) return setErr('Current PIN is wrong');
    if (!/^\d{4}$/.test(next)) return setErr('New PIN must be 4 digits');
    if (next !== confirm) return setErr("PINs don't match");
    setBusy(true);
    try {
      await setPin(next);
      setDone(true);
      setTimeout(onClose, 700);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const input = {
    backgroundColor: t.colors.moonlight,
    borderRadius: t.radii.md,
    padding: 14,
    fontFamily: t.type.body,
    color: t.colors.ink,
    marginBottom: 12,
    fontSize: 18,
    letterSpacing: 6,
  };

  return (
    <BottomSheet visible={open} onClose={onClose}>
      <Text style={{ fontFamily: t.type.display, fontSize: 24, lineHeight: 32, paddingTop: 2, marginBottom: 4 }}>
        Change PIN
      </Text>
      <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 16 }}>
        Used to confirm sensitive actions like turning off location sharing. 4 digits.
      </Text>

      <Eyebrow style={{ marginBottom: 6 }}>CURRENT PIN</Eyebrow>
      <TextInput
        value={current}
        onChangeText={(s) => setCurrent(s.replace(/[^0-9]/g, '').slice(0, 4))}
        keyboardType="number-pad"
        secureTextEntry
        style={input}
        placeholderTextColor={t.colors.inkMute}
      />
      <Eyebrow style={{ marginBottom: 6 }}>NEW PIN</Eyebrow>
      <TextInput
        value={next}
        onChangeText={(s) => setNext(s.replace(/[^0-9]/g, '').slice(0, 4))}
        keyboardType="number-pad"
        secureTextEntry
        style={input}
        placeholderTextColor={t.colors.inkMute}
      />
      <Eyebrow style={{ marginBottom: 6 }}>CONFIRM NEW PIN</Eyebrow>
      <TextInput
        value={confirm}
        onChangeText={(s) => setConfirm(s.replace(/[^0-9]/g, '').slice(0, 4))}
        keyboardType="number-pad"
        secureTextEntry
        style={input}
        placeholderTextColor={t.colors.inkMute}
      />

      {err && (
        <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 8 }}>
          {err}
        </Text>
      )}
      {done && (
        <Text variant="small" color={t.colors.statusOk} style={{ marginBottom: 8 }}>
          PIN updated ✓
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <PillButton variant="ghost" style={{ flex: 1 }} onPress={onClose}>
          Cancel
        </PillButton>
        <PillButton style={{ flex: 1 }} onPress={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Save PIN'}
        </PillButton>
      </View>
    </BottomSheet>
  );
}

function EditProfileSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const t = useTheme();
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName(profile?.name ?? '');
      setPhone(profile?.phone ?? '');
      setBio(profile?.bio ?? '');
      setErr(null);
    }
  }, [open, profile]);

  const save = async () => {
    if (!profile) return;
    if (!name.trim()) {
      setErr('Name is required');
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim(), phone: phone.trim() || null, bio: bio.trim() || null })
      .eq('id', profile.id);
    setBusy(false);
    if (error) setErr(error.message);
    else onSaved();
  };

  const inputStyle = {
    backgroundColor: t.colors.moonlight,
    borderRadius: t.radii.md,
    padding: 14,
    fontFamily: t.type.body,
    color: t.colors.ink,
    marginBottom: 12,
  };

  return (
    <BottomSheet visible={open} onClose={onClose}>
      <Text style={{ fontFamily: t.type.display, fontSize: 24, marginBottom: 16 }}>Edit profile</Text>
      <Eyebrow style={{ marginBottom: 6 }}>NAME</Eyebrow>
      <TextInput value={name} onChangeText={setName} style={inputStyle} placeholderTextColor={t.colors.inkMute} />
      <Eyebrow style={{ marginBottom: 6 }}>PHONE</Eyebrow>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={inputStyle}
        placeholderTextColor={t.colors.inkMute}
      />
      <Eyebrow style={{ marginBottom: 6 }}>BIO</Eyebrow>
      <TextInput
        value={bio}
        onChangeText={setBio}
        multiline
        style={[inputStyle, { minHeight: 80 }]}
        placeholderTextColor={t.colors.inkMute}
      />
      {err && (
        <Text variant="small" color={t.colors.crimson} style={{ marginBottom: 8 }}>
          {err}
        </Text>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <PillButton variant="ghost" style={{ flex: 1 }} onPress={onClose}>
          Cancel
        </PillButton>
        <PillButton style={{ flex: 1 }} onPress={save} disabled={busy || !name.trim()}>
          {busy ? 'Saving…' : 'Save'}
        </PillButton>
      </View>
    </BottomSheet>
  );
}
