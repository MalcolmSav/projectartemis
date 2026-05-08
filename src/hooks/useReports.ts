import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';

export interface DBReport {
  id: string;
  user_id: string | null;
  kind: 'yellow' | 'red' | 'green';
  label: string;
  area: string | null;
  lat: number;
  lng: number;
  anon: boolean;
  created_at: string;
}

export function useReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<DBReport[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setReports((data ?? []) as DBReport[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    const topic = `reports:${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(topic);
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, refresh).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  const addReport = useCallback(
    async (r: { kind: 'yellow' | 'red' | 'green'; label: string; area?: string; lat: number; lng: number; anon?: boolean }) => {
      const { error } = await supabase.from('reports').insert({
        user_id: r.anon ? null : user?.id ?? null,
        kind: r.kind,
        label: r.label,
        area: r.area ?? null,
        lat: r.lat,
        lng: r.lng,
        anon: !!r.anon,
      });
      return error ? { error: error.message } : {};
    },
    [user],
  );

  return { reports, loading, refresh, addReport };
}
