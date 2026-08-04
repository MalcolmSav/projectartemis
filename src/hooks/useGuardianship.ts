import { useCallback, useEffect, useState } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../state/Auth';

export interface GuardianRequest {
  id: string;
  guardianId: string;
  childId: string;
  createdAt: string;
  /** The other party — the would-be guardian, or the account being asked for. */
  guardian: Profile | null;
  child: Profile | null;
}

/**
 * Child accounts and the people who manage them.
 *
 * An account is a "child account" if at least one guardian is linked to it. That
 * link is what locks its circle down to those guardians — enforced in the
 * database (triggers on `circles` and `invites`), so everything here is about
 * showing the right UI, never about being the thing that stops a write.
 *
 * The first guardian is accepted by the account itself. Every later request is
 * approved by an EXISTING guardian, so a managed account can't quietly let
 * someone new into its circle by calling them a guardian.
 */
export function useGuardianship() {
  const { user } = useAuth();
  const [guardians, setGuardians] = useState<Profile[]>([]);
  const [children, setChildren] = useState<Profile[]>([]);
  /** Requests waiting on ME — to accept a guardian, or to approve one for a child I manage. */
  const [incoming, setIncoming] = useState<GuardianRequest[]>([]);
  /** Requests I've sent that nobody has answered yet. */
  const [outgoing, setOutgoing] = useState<GuardianRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [{ data: links, error: linkErr }, { data: reqs }] = await Promise.all([
      supabase
        .from('guardians')
        .select('child_id, guardian_id, child:profiles!guardians_child_id_fkey(*), guardian:profiles!guardians_guardian_id_fkey(*)')
        .or(`child_id.eq.${user.id},guardian_id.eq.${user.id}`),
      supabase
        .from('guardian_requests')
        .select('*, child:profiles!guardian_requests_child_id_fkey(*), guardian:profiles!guardian_requests_guardian_id_fkey(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);

    // The tables don't exist until the migration runs. Treat that as "nobody is
    // managed" rather than an error the user can do anything about.
    if (linkErr) {
      setGuardians([]);
      setChildren([]);
      setIncoming([]);
      setOutgoing([]);
      setError(null);
      setLoading(false);
      return;
    }

    const mine = (links ?? []) as any[];
    setGuardians(mine.filter((l) => l.child_id === user.id).map((l) => l.guardian as Profile).filter(Boolean));
    const myChildren = mine.filter((l) => l.guardian_id === user.id).map((l) => l.child as Profile).filter(Boolean);
    setChildren(myChildren);

    const childIds = new Set(myChildren.map((c) => c.id));
    const rows: GuardianRequest[] = ((reqs ?? []) as any[]).map((r) => ({
      id: r.id,
      guardianId: r.guardian_id,
      childId: r.child_id,
      createdAt: r.created_at,
      guardian: (r.guardian as Profile) ?? null,
      child: (r.child as Profile) ?? null,
    }));

    setOutgoing(rows.filter((r) => r.guardianId === user.id));
    setIncoming(
      rows.filter(
        (r) =>
          r.guardianId !== user.id &&
          // Mine to answer only if it's about me and I'm unmanaged, or about a
          // child I already manage. RLS allows the read either way.
          ((r.childId === user.id && mine.every((l) => l.child_id !== user.id)) || childIds.has(r.childId)),
      ),
    );
    setError(null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const topic = `guardianship:${user.id}:${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(topic);
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'guardians' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guardian_requests' }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, refresh]);

  const requestGuardianship = useCallback(
    async (childId: string) => {
      const { error: err } = await supabase.rpc('request_guardianship', { child: childId });
      if (err) return { error: err.message };
      await refresh();
      return {};
    },
    [refresh],
  );

  const respondGuardianship = useCallback(
    async (requestId: string, accept: boolean) => {
      const { error: err } = await supabase.rpc('respond_guardianship', { request_id: requestId, accept });
      if (err) return { error: err.message };
      await refresh();
      return {};
    },
    [refresh],
  );

  const endGuardianship = useCallback(
    async (childId: string) => {
      const { error: err } = await supabase.rpc('end_guardianship', { child: childId });
      if (err) return { error: err.message };
      await refresh();
      return {};
    },
    [refresh],
  );

  return {
    guardians,
    children,
    incoming,
    outgoing,
    loading,
    error,
    /** This account is managed — its circle is locked to `guardians`. */
    isChild: guardians.length > 0,
    refresh,
    requestGuardianship,
    respondGuardianship,
    endGuardianship,
  };
}
