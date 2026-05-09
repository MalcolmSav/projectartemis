import React from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, Eyebrow, Avatar } from '../components';
import { IconChevron } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useConversations } from '../hooks/useConversations';
import { palette } from '../theme/tokens';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export function ConversationsScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { items, loading, refresh } = useConversations();
  const [refreshing, setRefreshing] = React.useState(false);

  const onPullRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 56,
          paddingHorizontal: t.spacing.pageH,
          paddingBottom: 12,
          gap: 12,
          backgroundColor: t.colors.parchment,
          borderBottomWidth: 1,
          borderBottomColor: t.colors.hairline,
        }}
      >
        <Pressable
          onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs' as any))}
          hitSlop={16}
          accessibilityLabel="Back"
        >
          <IconChevron dir="left" color={t.colors.inkSoft} />
        </Pressable>
        <Text variant="large" weight="semibold">
          Messages
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.colors.forest700} />
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Eyebrow color={t.colors.inkMute}>NO MESSAGES YET</Eyebrow>
          <Text variant="small" color={t.colors.inkSoft} style={{ marginTop: 8, textAlign: 'center' }}>
            Open a friend's profile and tap Message to start a conversation.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={t.colors.forest700} />}
        >
          {items.map((c) => {
            const name = c.other?.name?.trim() || c.other?.email?.split('@')[0] || 'Unknown';
            const preview = (c.lastFromMe ? 'You: ' : '') + c.lastBody;
            return (
              <Pressable
                key={c.otherId}
                onPress={() => nav.navigate('Chat', { userId: c.otherId })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: t.spacing.pageH,
                  gap: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: t.colors.hairline,
                }}
              >
                <Avatar name={name} size={48} photoUri={c.other?.avatar_url ?? undefined} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text variant="body" weight={c.unread > 0 ? 'bold' : 'semibold'}>
                      {name}
                    </Text>
                    <Text variant="meta" color={t.colors.inkMute}>
                      {relTime(c.lastAt)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text
                      variant="small"
                      color={c.unread > 0 ? t.colors.ink : t.colors.inkSoft}
                      style={{ flex: 1 }}
                      numberOfLines={1}
                    >
                      {preview}
                    </Text>
                    {c.unread > 0 && (
                      <View
                        style={{
                          minWidth: 22,
                          height: 22,
                          borderRadius: 999,
                          backgroundColor: palette.gold500,
                          paddingHorizontal: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: palette.forest900, fontFamily: t.type.bodyBold, fontSize: 11 }}>
                          {c.unread > 9 ? '9+' : c.unread}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
