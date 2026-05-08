import React from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text, Eyebrow, Avatar, Card, Toggle, Divider } from '../components';
import { IconChevron, IconLocate, IconLock } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAppState } from '../state/AppState';
import { CIRCLE, ShareMode } from '../data/demo';

const MODES: { id: ShareMode; label: string; sub: string }[] = [
  { id: 'always', label: 'Always on', sub: 'Until you turn it off' },
  { id: 'timed', label: 'Timed', sub: '2hr auto-off' },
  { id: 'event', label: 'Event-based', sub: 'Only during calendar events' },
];

export function LocationShareScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const { sharing, setSharing, shareMode, setShareMode, visibleTo, setVisibleTo, askPin } = useAppState();

  const onMasterToggle = (next: boolean) => {
    if (next === sharing) return;
    if (sharing && !next) {
      askPin('Stop sharing location?', () => setSharing(false));
    } else {
      setSharing(next);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 22, paddingBottom: 12 }}>
        <Pressable onPress={() => nav.goBack()} style={{ padding: 6, marginRight: 6 }}>
          <IconChevron dir="left" color={t.colors.inkSoft} />
        </Pressable>
        <Text variant="large" weight="semibold">
          Location sharing
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
                {sharing ? 'Sharing live location' : 'Not sharing'}
              </Text>
              {sharing && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <IconLock size={11} gold />
                  <Text variant="meta" color={t.colors.inkMute}>
                    PIN-protected · since 14:32
                  </Text>
                </View>
              )}
            </View>
            <Toggle on={sharing} onChange={onMasterToggle} />
          </View>
        </Card>

        <Eyebrow style={{ marginBottom: 8 }}>MODE</Eyebrow>
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
                    {m.label}
                  </Text>
                  <Text variant="meta" color={active ? 'rgba(242,226,187,0.7)' : t.colors.inkMute}>
                    {m.sub}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Eyebrow style={{ marginBottom: 8 }}>CURRENTLY VISIBLE TO</Eyebrow>
        <Card padding={4}>
          {CIRCLE.map((p, i) => (
            <View key={p.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
                <Avatar name={p.name} size={40} status={p.status} />
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="semibold">
                    {p.name}
                  </Text>
                  <Text variant="meta" color={t.colors.inkMute}>
                    {visibleTo[p.id] && sharing ? 'Live · synced 12s ago' : 'Hidden'}
                  </Text>
                </View>
                <Toggle on={!!visibleTo[p.id]} onChange={(b) => setVisibleTo(p.id, b)} disabled={!sharing} />
              </View>
              {i < CIRCLE.length - 1 && <Divider />}
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
