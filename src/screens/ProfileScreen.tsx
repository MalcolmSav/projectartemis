import React, { useState } from 'react';
import { ScrollView, View, Pressable, TextInput, Alert } from 'react-native';
import { TopBar, Text, Eyebrow, Avatar, Card, Divider, PillButton, BottomSheet } from '../components';
import { ArtemisMark } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';
import { useEvents } from '../hooks/useEvents';
import { supabase } from '../lib/supabase';
import { pickAndUploadAvatar } from '../lib/avatar';
import { palette } from '../theme/tokens';

export function ProfileScreen() {
  const t = useTheme();
  const { profile, signOut, refreshProfile } = useAuth();
  const { events } = useEvents();
  const [editOpen, setEditOpen] = useState(false);

  const display = profile?.name?.trim() || profile?.email?.split('@')[0] || '—';
  const [uploading, setUploading] = useState(false);

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
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 22 }}>
          <Pressable onPress={onPickAvatar} disabled={uploading}>
            <Avatar name={display} size={84} ring photoUri={profile?.avatar_url ?? undefined} />
          </Pressable>
          <Text variant="small" weight="semibold" color={t.colors.gold700} style={{ marginTop: 8 }}>
            {uploading ? 'Uploading…' : profile?.avatar_url ? 'Change photo' : 'Add photo'}
          </Text>
          <Text
            style={{
              fontFamily: t.type.display,
              fontSize: 26,
              lineHeight: 34,
              marginTop: 14,
              paddingTop: 4,
              textAlign: 'center',
            }}
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
        <Card style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text variant="body" weight="semibold" style={{ letterSpacing: 6 }}>
                ••••
              </Text>
              <Text variant="meta" color={t.colors.inkMute}>
                Demo: 4729 (PIN management coming with secure storage)
              </Text>
            </View>
          </View>
        </Card>

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
    </View>
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
