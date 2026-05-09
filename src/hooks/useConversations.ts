import { useCallback, useEffect, useState } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../state/Auth';

export interface Conversation {
  otherId: string;
  other: Profile | null;
  lastBody: string;
  lastAt: string;
  lastFromMe: boolean;
  unread: number;
}

export function useConversations() {
  const { user } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const me = user.id;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
      .order('created_at', { ascending: false })
      .limit(300);

    if (!data) {
      setItems([]);
      setUnreadTotal(0);
      setLoading(false);
      return;
    }

    const byOther = new Map<string, Conversation>();
    for (const m of data as any[]) {
      const otherId = m.sender_id === me ? m.recipient_id : m.sender_id;
      if (!byOther.has(otherId)) {
        byOther.set(otherId, {
          otherId,
          other: null,
          lastBody: m.body,
          lastAt: m.created_at,
          lastFromMe: m.sender_id === me,
          unread: 0,
        });
      }
      if (m.recipient_id === me && !m.read_at) {
        byOther.get(otherId)!.unread += 1;
      }
    }

    // Fetch all profiles in one query
    const ids = Array.from(byOther.keys());
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('*').in('id', ids);
      (profs ?? []).forEach((p: Profile) => {
        const conv = byOther.get(p.id);
        if (conv) conv.other = p;
      });
    }

    const list = Array.from(byOther.values()).sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
    );
    setItems(list);
    setUnreadTotal(list.reduce((sum, c) => sum + c.unread, 0));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const topic = `conversations:${user.id}:${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(topic);
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, refresh).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, refresh]);

  return { items, unreadTotal, loading, refresh };
}
