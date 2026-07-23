import React from 'react';
import { ScrollView, View, Pressable, Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { Text, Eyebrow, Avatar, Card, Toggle, Divider } from '../components';
import { IconChevron, IconLocate } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAppState } from '../state/AppState';
import { useCircle } from '../hooks/useCircle';
import { usePresence } from '../hooks/usePresence';
import { personName } from '../lib/person';
import { useT } from '../i18n';
import { ShareMode } from '../data/demo';

const MODES: { id: ShareMode; label: string; sub: string }[] = [
  { id: 'always', label: 'Always on', sub: 'Until you turn it off' },
  { id: 'timed', label: 'Timed', sub: '2hr auto-off' },
  { id: 'event', label: 'Event-based', sub: 'Only during calendar events' },
];

export function LocationShareScreen() {
  const t = useTheme();
  const tr = useT();
  const nav = useNavigation();
  const { sharing, shareStartedAt, setSharing, shareMode, setShareMode, visibleTo, setVisibleTo } = useAppState();
  const { members } = useCircle();
  const { byUser: presenceByUser } = usePresence();

  const onMasterToggle = async (next: boolean) => {
    if (next === sharing) return;
    if (next) {
      // Don't show "Sharing live location" unless we can actually share.
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          tr('Location permission needed'),
          tr('Artemis needs location access to share your position with your circle.'),
          canAskAgain || Platform.OS === 'web'
            ? undefined
            : [
                { text: tr('Cancel'), style: 'cancel' },
                { text: tr('Open Settings'), onPress: () => Linking.openSettings() },
              ],
        );
        return;
      }
    }
    setSharing(next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 22, paddingBottom: 12 }}>
        <Pressable onPress={() => nav.goBack()} style={{ padding: 6, marginRight: 6 }}>
          <IconChevron dir="left" color={t.colors.inkSoft} />
        </Pressable>
        <Text variant="large" weight="semibold">
          {tr('Location sharing')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.pageH, paddingBottom: 120 }}>
        <Card style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                backgroundColor: sharing ? t.colors.forest700 : t.colors.moonlight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconLocate color={sharing ? t.colors.gold300 : t.colors.inkMute} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="semibold">
                {sharing ? tr('Sharing live location') : tr('Not sharing')}
              </Text>
              {sharing && shareStartedAt && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Text variant="meta" color={t.colors.inkMute}>
                    {tr('Since {time}', { time: new Date(shareStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
                  </Text>
                </View>
              )}
            </View>
            <Toggle on={sharing} onChange={onMasterToggle} />
          </View>
        </Card>

        <Eyebrow style={{ marginBottom: 8 }}>{tr('MODE')}</Eyebrow>
        <View style={{ gap: 10, marginBottom: 22 }}>
          {MODES.map((m) => {
            const active = shareMode === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setShareMode(m.id)}
                style={[
                  {
                    padding: 16,
                    borderRadius: t.radii.lg,
                    backgroundColor: active ? t.colors.forest700 : t.colors.parchment,
                    flexDirection: 'row',
                    alignItems: 'center',
                  },
                  t.shadows.soft,
                ]}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    borderWidth: 2,
                    borderColor: active ? t.colors.gold300 : t.colors.hairline,
                    marginRight: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {active && (
                    <View
                      style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: t.colors.gold300 }}
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="semibold" color={active ? t.colors.gold300 : t.colors.ink}>
                    {tr(m.label)}
                  </Text>
                  <Text variant="meta" color={active ? 'rgba(242,226,187,0.7)' : t.colors.inkMute}>
                    {tr(m.sub)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Eyebrow style={{ marginBottom: 8 }}>{tr('CURRENTLY VISIBLE TO')}</Eyebrow>
        {members.length === 0 ? (
          <Card>
            <Text variant="small" color={t.colors.inkSoft} style={{ textAlign: 'center', paddingVertical: 8 }}>
              {tr('No one in your circle yet. Add people on the Circle tab to share your location with them.')}
            </Text>
          </Card>
        ) : (
          <Card padding={4}>
            {members.map((m, i) => {
              // Default to visible unless the user explicitly hid this person.
              const isVisible = visibleTo[m.profile.id] !== false;
              const theirPresence = presenceByUser[m.profile.id];
              const theyShareBack =
                theirPresence && Date.now() - new Date(theirPresence.updated_at).getTime() < 5 * 60_000;
              const name = personName(m.profile);
              return (
                <View key={m.edgeId}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
                    <Avatar
                      name={name}
                      size={40}
                      status={theyShareBack ? 'ok' : 'warn'}
                      photoUri={m.profile.avatar_url ?? undefined}
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="body" weight="semibold">
                        {name}
                      </Text>
                      <Text variant="meta" color={t.colors.inkMute}>
                        {isVisible && sharing ? tr('Can see you · Live') : tr('Hidden from them')}
                        {theyShareBack ? tr(' · sharing back') : ''}
                      </Text>
                    </View>
                    <Toggle on={isVisible} onChange={(b) => setVisibleTo(m.profile.id, b)} disabled={!sharing} />
                  </View>
                  {i < members.length - 1 && <Divider />}
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
