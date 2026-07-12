import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Text, Avatar, Eyebrow } from '../components';
import { IconChevron, IconPin } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { useT } from '../i18n';
import { useAuth } from '../state/Auth';
import { useChat } from '../hooks/useChat';
import { useCheckIns } from '../hooks/useCheckIns';
import { supabase, Profile } from '../lib/supabase';
import { palette } from '../theme/tokens';
import { RootStackParamList } from '../navigation/types';

const LOC_PREFIX = '__LOC__:';

function parseLocation(body: string): { lat: number; lng: number } | null {
  if (!body.startsWith(LOC_PREFIX)) return null;
  try {
    return JSON.parse(body.slice(LOC_PREFIX.length));
  } catch {
    return null;
  }
}

export function ChatScreen() {
  const t = useTheme();
  const tr = useT();
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
  const otherId = route.params.userId;
  const { user } = useAuth();
  const { messages, loading, send, sending } = useChat(otherId);
  const { recordAlarm } = useCheckIns();
  const [draft, setDraft] = useState('');
  const [other, setOther] = useState<Profile | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', otherId).maybeSingle();
      if (!cancelled) setOther(data ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [otherId]);

  useEffect(() => {
    // scroll to bottom on new message
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const submit = async () => {
    if (!draft.trim() || sending) return;
    const body = draft;
    const trimmed = body.trim().toLowerCase();
    setDraft('');
    const safetyPhrases = ['alarm me', 'artemis alarm', '🚨'];
    if (safetyPhrases.some((p) => trimmed.includes(p))) {
      await recordAlarm(`Safety phrase from chat with ${otherName}: "${body}"`);
    }
    const res = await send(body);
    if (res.error) setDraft(body);
  };

  const sendLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location permission needed', 'Allow location access to share your position.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const body = `${LOC_PREFIX}${JSON.stringify({ lat: loc.coords.latitude, lng: loc.coords.longitude })}`;
    await send(body);
  };

  const otherName = other?.name?.trim() || other?.email?.split('@')[0] || '…';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: t.colors.ivoryBg }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 56,
          paddingHorizontal: t.spacing.pageH,
          paddingBottom: 12,
          backgroundColor: t.colors.parchment,
          borderBottomWidth: 1,
          borderBottomColor: t.colors.hairline,
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => (nav.canGoBack() ? nav.goBack() : (nav as any).navigate('Tabs'))}
          hitSlop={16}
          accessibilityLabel="Back"
        >
          <IconChevron dir="left" color={t.colors.inkSoft} />
        </Pressable>
        <Avatar name={otherName} size={36} photoUri={other?.avatar_url ?? undefined} />
        <View style={{ flex: 1 }}>
          <Text variant="body" weight="semibold">
            {otherName}
          </Text>
          {other?.email && (
            <Text variant="meta" color={t.colors.inkMute}>
              {other.email}
            </Text>
          )}
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.colors.forest700} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 14, paddingBottom: 20, gap: 6 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 && (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Eyebrow color={t.colors.inkMute}>{tr('NEW CONVERSATION')}</Eyebrow>
              <Text variant="small" color={t.colors.inkSoft} style={{ marginTop: 6, textAlign: 'center' }}>
                Say hi to {otherName}.
              </Text>
            </View>
          )}
          {messages.map((m, i) => {
            const mine = m.sender_id === user?.id;
            const prev = messages[i - 1];
            const showStamp =
              !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;
            return (
              <View key={m.id} style={{ width: '100%' }}>
                {showStamp && (
                  <Text
                    variant="meta"
                    color={t.colors.inkMute}
                    style={{ textAlign: 'center', marginVertical: 8 }}
                  >
                    {new Date(m.created_at).toLocaleString()}
                  </Text>
                )}
                {(() => {
                  const loc = parseLocation(m.body);
                  if (loc) {
                    return (
                      <Pressable
                        onPress={() =>
                          Linking.openURL(
                            `https://maps.google.com/?q=${loc.lat},${loc.lng}`,
                          )
                        }
                        style={{
                          alignSelf: mine ? 'flex-end' : 'flex-start',
                          backgroundColor: mine ? t.colors.forest700 : t.colors.parchment,
                          borderRadius: 18,
                          borderBottomRightRadius: mine ? 4 : 18,
                          borderBottomLeftRadius: mine ? 18 : 4,
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          maxWidth: '78%',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <IconPin size={16} color={mine ? palette.gold300 : t.colors.forest700} />
                        <View>
                          <Text variant="body" weight="semibold" color={mine ? palette.gold300 : t.colors.ink}>
                            {mine ? tr('My location') : `${otherName}'s location`}
                          </Text>
                          <Text variant="meta" color={mine ? palette.gold500 : t.colors.inkMute}>
                            {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)} · {tr('Tap to open')}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  }
                  return (
                    <View
                      style={{
                        alignSelf: mine ? 'flex-end' : 'flex-start',
                        backgroundColor: mine ? t.colors.forest700 : t.colors.parchment,
                        borderRadius: 18,
                        borderBottomRightRadius: mine ? 4 : 18,
                        borderBottomLeftRadius: mine ? 18 : 4,
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        maxWidth: '78%',
                      }}
                    >
                      <Text variant="body" color={mine ? palette.gold300 : t.colors.ink}>
                        {m.body}
                      </Text>
                    </View>
                  );
                })()}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Composer */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          padding: 12,
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          backgroundColor: t.colors.parchment,
          borderTopWidth: 1,
          borderTopColor: t.colors.hairline,
        }}
      >
        <Pressable
          onPress={sendLocation}
          disabled={sending}
          accessibilityLabel="Share location"
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            backgroundColor: t.colors.moonlight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconPin size={18} color={t.colors.inkSoft} />
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={tr('Message…')}
          placeholderTextColor={t.colors.inkMute}
          multiline
          style={{
            flex: 1,
            backgroundColor: t.colors.moonlight,
            borderRadius: 22,
            paddingVertical: 10,
            paddingHorizontal: 14,
            fontFamily: t.type.body,
            fontSize: 15,
            color: t.colors.ink,
            maxHeight: 120,
            minHeight: 42,
          }}
        />
        <Pressable
          onPress={submit}
          disabled={!draft.trim() || sending}
          accessibilityLabel="Send"
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            backgroundColor: draft.trim() ? t.colors.forest700 : t.colors.moonlight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: draft.trim() ? palette.gold300 : t.colors.inkMute, fontSize: 18, lineHeight: 22 }}>
            ↑
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
