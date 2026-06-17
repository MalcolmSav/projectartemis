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

// Reports expire after this long. The DB purges them on a schedule, but we also
// filter on read so stale reports never appear even before the purge runs.
const REPORT_TTL_MS = 24 * 60 * 60 * 1000;

export function useReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<DBReport[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const cutoff = new Date(Date.now() - REPORT_TTL_MS).toISOString();
    const { data } = await supabase
      .from('reports')
      .select('*')
      .gte('created_at', cutoff)
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
    ch
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, refresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reports' }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  const addReport = useCallback(
    async (r: { kind: 'yellow' | 'red' | 'green'; label: string; notes?: string; lat: number; lng: number; anon?: boolean }) => {
      const { error } = await supabase.from('reports').insert({
        user_id: r.anon ? null : user?.id ?? null,
        kind: r.kind,
        label: r.label,
        area: r.notes ?? null,
        lat: r.lat,
        lng: r.lng,
        anon: !!r.anon,
      });
      return error ? { error: error.message } : {};
    },
    [user],
  );

  const deleteReport = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('reports').delete().eq('id', id);
      if (!error) setReports((prev) => prev.filter((r) => r.id !== id));
      return error ? { error: error.message } : {};
    },
    [],
  );

  return { reports, loading, refresh, addReport, deleteReport };
}
