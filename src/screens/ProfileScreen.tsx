import React, { useState } from 'react';
import { ScrollView, View, Pressable, TextInput, Alert, RefreshControl, Linking } from 'react-native';
import { TopBar, Text, Eyebrow, Avatar, Card, Divider, PillButton, BottomSheet } from '../components';
import { ArtemisMark } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../state/Auth';
import { useEvents } from '../hooks/useEvents';
import { useEmergencyContacts } from '../hooks/useEmergencyContacts';
import { useHomePlace } from '../hooks/useHomePlace';
import { useT, useLang } from '../i18n';
import { supabase } from '../lib/supabase';
import { pickAndUploadAvatar } from '../lib/avatar';
import { palette } from '../theme/tokens';

export function ProfileScreen() {
  const t = useTheme();
  const tr = useT();
  const { lang, setLang } = useLang();
  const { profile, signOut, refreshProfile } = useAuth();
  const { events } = useEvents();
  const { contacts } = useEmergencyContacts(profile?.id);
  const { home, setFromCurrentLocation, clearHome } = useHomePlace();
  const [homeBusy, setHomeBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const onSetHome = async () => {
    setHomeBusy(true);
    const res = await setFromCurrentLocation();
    setHomeBusy(false);
    if (res.error) Alert.alert(tr('Could not set home'), res.error);
  };

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
        <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 22 }}>
          <Pressable onPress={onPickAvatar} disabled={uploading} accessibilityLabel="Change photo">
            <Avatar name={display} size={92} ring photoUri={profile?.avatar_url ?? undefined} />
          </Pressable>
          <Text variant="small" weight="semibold" color={t.colors.gold700} style={{ marginTop: 12 }}>
            {uploading ? tr('Uploading…') : profile?.avatar_url ? tr('Change photo') : tr('Add photo')}
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
          {profile?.username && (
            <Text variant="small" color={t.colors.inkMute} style={{ marginTop: 2 }}>
              @{profile.username}
            </Text>
          )}
          <Text variant="small" color={t.colors.inkSoft} style={{ marginTop: 4, textAlign: 'center' }}>
            {profile?.bio?.trim() || profile?.email}
          </Text>
          <Pressable onPress={() => setEditOpen(true)} style={{ marginTop: 10 }}>
            <Text variant="small" weight="semibold" color={t.colors.gold700}>
              {tr('Edit profile')}
            </Text>
          </Pressable>
        </View>

        <Eyebrow style={{ marginBottom: 8 }}>{tr('ACCOUNT')}</Eyebrow>
        <Card style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text variant="meta" color={t.colors.inkMute}>
                {tr('EMAIL')}
              </Text>
              <Text variant="body">{profile?.email}</Text>
            </View>
          </View>
          {profile?.phone ? (
            <>
              <Divider style={{ marginVertical: 10 }} />
              <View>
                <Text variant="meta" color={t.colors.inkMute}>
                  {tr('PHONE')}
                </Text>
                <Text variant="body">{profile.phone}</Text>
              </View>
            </>
          ) : null}
        </Card>

        <Eyebrow style={{ marginBottom: 8 }}>{tr('HOME · AUTO CHECK-IN')}</Eyebrow>
        <Card style={{ marginBottom: 18 }}>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 10 }}>
            {tr('When a trip reaches your home, Artemis marks you arrived safe automatically — no tapping needed.')}
          </Text>
          {home ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="semibold">🏡 {home.label}</Text>
                <Text variant="meta" color={t.colors.inkMute}>
                  {home.lat.toFixed(4)}, {home.lng.toFixed(4)}
                </Text>
              </View>
              <Pressable onPress={onSetHome} disabled={homeBusy} hitSlop={8}>
                <Text variant="small" weight="semibold" color={t.colors.gold700}>
                  {homeBusy ? tr('Updating…') : tr('Update')}
                </Text>
              </Pressable>
              <Pressable onPress={clearHome} hitSlop={8}>
                <Text variant="small" weight="semibold" color={t.colors.crimson}>
                  {tr('Clear')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <PillButton variant="secondary" block disabled={homeBusy} onPress={onSetHome}>
              {homeBusy ? tr('Getting location…') : tr('Set home to my current location')}
            </PillButton>
          )}
        </Card>

        {contacts.length > 0 && (
          <>
            <Eyebrow style={{ marginBottom: 8 }}>{tr('EMERGENCY CONTACTS')}</Eyebrow>
            <Card style={{ marginBottom: 18 }}>
              {contacts.map((contact, i) => (
                <View key={contact.id}>
                  <View>
                    <Text variant="meta" color={t.colors.inkMute}>
                      {contact.priority === 1 ? '🚨 CALL FIRST' : `CONTACT ${contact.priority}`}
                    </Text>
                    <Text variant="body" weight="semibold" style={{ marginTop: 4 }}>
                      {contact.name}
                    </Text>
                    <Pressable onPress={() => Linking.openURL(`tel:${contact.contact_info}`)}>
                      <Text variant="small" color={t.colors.gold700}>
                        {contact.contact_info}
                      </Text>
                    </Pressable>
                  </View>
                  {i < contacts.length - 1 && <Divider style={{ marginVertical: 10 }} />}
                </View>
              ))}
            </Card>
          </>
        )}

        {events.length > 0 && (
          <>
            <Eyebrow style={{ marginBottom: 8 }}>{tr('MY UPCOMING')}</Eyebrow>
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

        <Eyebrow style={{ marginBottom: 8 }}>{tr('APPEARANCE')}</Eyebrow>
        <Card style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="body">{tr('Mode')}</Text>
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
                      {m === 'light' ? tr('Day') : tr('Night')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Divider style={{ marginVertical: 12 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="body">{tr('Language')}</Text>
            <View style={{ flexDirection: 'row', backgroundColor: t.colors.moonlight, borderRadius: 999, padding: 3 }}>
              {(['en', 'sv'] as const).map((l) => {
                const active = lang === l;
                return (
                  <Pressable
                    key={l}
                    onPress={() => setLang(l)}
                    accessibilityRole="button"
                    accessibilityLabel={l === 'en' ? 'English' : 'Svenska'}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      backgroundColor: active ? t.colors.forest700 : 'transparent',
                    }}
                  >
                    <Text variant="small" weight="semibold" color={active ? palette.gold300 : t.colors.inkSoft}>
                      {l === 'en' ? 'English' : 'Svenska'}
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
            Alert.alert(tr('Sign out?'), tr('You can sign back in anytime.'), [
              { text: tr('Cancel'), style: 'cancel' },
              { text: tr('Sign out'), style: 'destructive', onPress: () => signOut() },
            ]);
          }}
        >
          {tr('Sign out')}
        </PillButton>

        <PillButton
          variant="ghost"
          block
          style={{ marginTop: 8 }}
          onPress={() => {
            Alert.alert(
              tr('Delete account?'),
              tr('This permanently removes your profile, circle, events and check-ins. This cannot be undone.'),
              [
                { text: tr('Cancel'), style: 'cancel' },
                {
                  text: tr('Delete'),
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { error } = await supabase.rpc('delete_my_account');
                      if (error) {
                        Alert.alert(tr('Delete failed'), error.message);
                        return;
                      }
                      await signOut();
                    } catch (err: any) {
                      Alert.alert(tr('Delete failed'), err?.message ?? String(err));
                    }
                  },
                },
              ],
            );
          }}
        >
          <Text variant="small" weight="semibold" color={t.colors.crimson}>
            {tr('Delete account')}
          </Text>
        </PillButton>

        <View style={{ alignItems: 'center', opacity: 0.4, marginTop: 24 }}>
          <ArtemisMark size={36} moonColor={t.colors.forest700} />
          <Text style={{ fontFamily: t.type.displayItalic, fontSize: 12, marginTop: 6, color: t.colors.inkMute }}>
            {tr('Artemis · she who watches')}
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
  const tr = useT();
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
      setErr(tr('Name is required'));
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
      <Text style={{ fontFamily: t.type.display, fontSize: 24, marginBottom: 16 }}>{tr('Edit profile')}</Text>
      <Eyebrow style={{ marginBottom: 6 }}>{tr('NAME')}</Eyebrow>
      <TextInput value={name} onChangeText={setName} style={inputStyle} placeholderTextColor={t.colors.inkMute} />
      <Eyebrow style={{ marginBottom: 6 }}>{tr('PHONE')}</Eyebrow>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={inputStyle}
        placeholderTextColor={t.colors.inkMute}
      />
      <Eyebrow style={{ marginBottom: 6 }}>{tr('BIO')}</Eyebrow>
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
          {tr('Cancel')}
        </PillButton>
        <PillButton style={{ flex: 1 }} onPress={save} disabled={busy || !name.trim()}>
          {busy ? tr('Saving…') : tr('Save')}
        </PillButton>
      </View>
    </BottomSheet>
  );
}
