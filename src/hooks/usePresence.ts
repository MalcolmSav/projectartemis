import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';

export interface Presence {
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
  battery_level: number | null;
}

/** Live presence rows visible to me (mine + circle members'). */
export function usePresence() {
  const { user } = useAuth();
  const [byUser, setByUser] = useState<Record<string, Presence>>({});

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('presence').select('*');
    const map: Record<string, Presence> = {};
    (data ?? []).forEach((p: Presence) => (map[p.user_id] = p));
    setByUser(map);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const topic = `presence:${user.id}:${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(topic);
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'presence' }, refresh).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, refresh]);

  return { byUser, refresh };
}
