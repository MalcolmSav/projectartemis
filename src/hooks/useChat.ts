import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export function useChat(otherId: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`,
      )
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as Message[]);
    setLoading(false);

    // Mark messages from the other user as read
    const unread = (data ?? []).filter((m: Message) => m.recipient_id === user.id && !m.read_at).map((m: Message) => m.id);
    if (unread.length > 0) {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unread);
    }
  }, [user, otherId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // Realtime: any new message in either direction triggers refresh
  useEffect(() => {
    if (!user) return;
    const topic = `chat:${user.id}:${otherId}:${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(topic);
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const m = payload.new as Message;
      const isThisChat =
        (m.sender_id === user.id && m.recipient_id === otherId) ||
        (m.sender_id === otherId && m.recipient_id === user.id);
      if (isThisChat) refresh();
    }).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, otherId, refresh]);

  const send = useCallback(
    async (body: string) => {
      if (!user) return { error: 'Not signed in' };
      const text = body.trim();
      if (!text) return {};
      setSending(true);
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        recipient_id: otherId,
        body: text,
      });
      setSending(false);
      return error ? { error: error.message } : {};
    },
    [user, otherId],
  );

  return { messages, loading, sending, send, refresh };
}
