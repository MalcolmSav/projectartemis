import { useCallback, useEffect, useState } from 'react';
import { supabase, Profile, InviteRow } from '../lib/supabase';
import { useAuth } from '../state/Auth';

export interface CircleMember {
  edgeId: string;
  profile: Profile;
  relation: string | null;
  verified: boolean;
}

export function useCircle() {
  const { user } = useAuth();
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<(InviteRow & { from: Profile | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setError(null);
    // Fetch circle edges + the linked member profile
    const { data: edges, error: e1 } = await supabase
      .from('circles')
      .select('id, relation, verified, member:profiles!circles_member_id_fkey(*)')
      .eq('owner_id', user.id);

    if (e1) setError(e1.message);
    else
      setMembers(
        (edges ?? [])
          .filter((e: any) => e.member)
          .map((e: any) => ({
            edgeId: e.id,
            profile: e.member as Profile,
            relation: e.relation,
            verified: e.verified,
          })),
      );

    // Pending invites addressed to my email (lower-case to match how we store them)
    const email = user.email?.toLowerCase();
    if (email) {
      const { data: inv } = await supabase
        .from('invites')
        .select('*, from:profiles!invites_from_user_fkey(*)')
        .eq('to_email', email)
        .eq('status', 'pending');
      setPendingInvites((inv ?? []) as any);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // Realtime subscriptions: refresh on changes to my circle/invites.
  useEffect(() => {
    if (!user) return;
    const topic = `circle:${user.id}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(topic);
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'circles', filter: `owner_id=eq.${user.id}` },
        refresh,
      )
      // No filter on invites — RLS already restricts what Phone A receives,
      // and email-based filters don't survive Realtime's filter parser.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invites' }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  /** Send an invite to add a friend by email. */
  const invite = useCallback(
    async (toEmail: string, relation: string | null) => {
      if (!user) return { error: 'Not signed in' };
      const email = toEmail.trim().toLowerCase();
      if (!email) return { error: 'Enter an email' };
      if (email === user.email?.toLowerCase()) return { error: "You can't invite yourself" };

      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .maybeSingle();

      const { error } = await supabase
        .from('invites')
        .insert({ from_user: user.id, to_email: email, relation });
      if (error) return { error: error.message };

      // Fire-and-forget — email failure doesn't block the invite
      supabase.functions.invoke('send-invite-email', {
        body: {
          to_email: email,
          from_name: senderProfile?.name ?? user.email ?? 'Someone',
          relation,
        },
      }).catch(() => {});

      return {};
    },
    [user],
  );

  /** Accept an invite addressed to me. Creates both reciprocal circles rows
   * via a security-definer RPC (RLS would otherwise block the friend's row). */
  const accept = useCallback(
    async (inv: InviteRow) => {
      if (!user) return { error: 'Not signed in' };
      const { error } = await supabase.rpc('accept_invite', { invite_id: inv.id });
      if (error) return { error: error.message };
      await refresh();
      return {};
    },
    [user, refresh],
  );

  const decline = useCallback(
    async (inv: InviteRow) => {
      const { error } = await supabase.from('invites').update({ status: 'declined' }).eq('id', inv.id);
      if (error) return { error: error.message };
      await refresh();
      return {};
    },
    [refresh],
  );

  const remove = useCallback(
    async (edgeId: string) => {
      // Symmetric removal via RPC (RLS would otherwise leave the friend's mirror row)
      const edge = members.find((m) => m.edgeId === edgeId);
      if (!edge) return { error: 'Edge not found' };
      const { error } = await supabase.rpc('remove_circle', { other_id: edge.profile.id });
      if (error) return { error: error.message };
      await refresh();
      return {};
    },
    [refresh, members],
  );

  return { members, pendingInvites, loading, error, refresh, invite, accept, decline, remove };
}
