import React, { useState } from 'react';
import { View, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Text, Eyebrow } from './Text';
import { Avatar } from './Avatar';
import { useTheme } from '../theme/ThemeProvider';
import { useT } from '../i18n';
import { palette } from '../theme/tokens';
import { useAuth } from '../state/Auth';
import { useTripChat } from '../hooks/useTripChat';
import { personName } from '../lib/person';

/**
 * Group chat for one trip — traveler + everyone following, in one thread.
 * Beats DMing each follower separately, and carries the "X is now following"
 * system notices so everyone can see who's actually watching.
 */
export function TripChatSheet({
  visible,
  onClose,
  tripId,
}: {
  visible: boolean;
  onClose: () => void;
  tripId: string | null;
}) {
  const t = useTheme();
  const tr = useT();
  const { user } = useAuth();
  const { messages, people, loading, sending, send } = useTripChat(visible ? tripId : null);
  const [draft, setDraft] = useState('');

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const res = await send(text);
    if (res.error) setDraft(text); // keep it so nothing is silently lost
  };

  // Pinned to the bottom of the sheet rather than sitting at the end of the
  // scrolling message list — otherwise a busy trip pushes it under the keyboard.
  const composer = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10 }}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={tr('Message…')}
        placeholderTextColor={t.colors.inkMute}
        style={{
          flex: 1,
          backgroundColor: t.colors.moonlight,
          borderRadius: 999,
          paddingVertical: 12,
          paddingHorizontal: 16,
          fontFamily: t.type.body,
          color: t.colors.ink,
        }}
        onSubmitEditing={submit}
        returnKeyType="send"
        // Keep the keyboard up between messages — a trip chat is a back-and-forth.
        submitBehavior="submit"
      />
      <Pressable
        onPress={submit}
        disabled={sending || !draft.trim()}
        accessibilityLabel={tr('Send')}
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: draft.trim() ? t.colors.forest700 : t.colors.hairline,
        }}
      >
        <Text style={{ color: draft.trim() ? palette.gold300 : t.colors.inkMute, fontSize: 17 }}>↑</Text>
      </Pressable>
    </View>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} footer={composer}>
      <Text style={{ fontFamily: t.type.display, fontSize: 22, lineHeight: 28, marginBottom: 2 }}>
        {tr('Trip chat')}
      </Text>
      <Text variant="small" color={t.colors.inkSoft} style={{ marginBottom: 14 }}>
        {tr('Everyone following this trip can see these messages.')}
      </Text>

      {loading ? (
        <ActivityIndicator color={t.colors.forest700} style={{ paddingVertical: 24 }} />
      ) : messages.length === 0 ? (
        <Text variant="small" color={t.colors.inkMute} style={{ textAlign: 'center', paddingVertical: 24 }}>
          {tr('No messages yet — say something.')}
        </Text>
      ) : (
        <View style={{ gap: 10, marginBottom: 14 }}>
          {messages.map((m) => {
            if (m.system) {
              return (
                <Text
                  key={m.id}
                  variant="meta"
                  color={t.colors.gold700}
                  style={{ textAlign: 'center', paddingVertical: 2 }}
                >
                  👀 {m.body}
                </Text>
              );
            }
            const mine = m.sender_id === user?.id;
            const who = m.sender_id ? people[m.sender_id] : null;
            return (
              <View
                key={m.id}
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '86%',
                }}
              >
                {!mine && <Avatar name={personName(who)} size={28} photoUri={who?.avatar_url ?? undefined} />}
                <View
                  style={{
                    backgroundColor: mine ? t.colors.forest700 : t.colors.moonlight,
                    borderRadius: t.radii.md,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                  }}
                >
                  {!mine && (
                    <Text variant="meta" color={t.colors.inkMute} style={{ marginBottom: 1 }}>
                      {personName(who)}
                    </Text>
                  )}
                  <Text variant="body" color={mine ? '#fff' : t.colors.ink}>
                    {m.body}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </BottomSheet>
  );
}
