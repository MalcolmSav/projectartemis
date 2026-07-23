import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';

export interface CircleGroup {
  id: string;
  name: string;
  memberIds: string[];
}

/** The current user's circle groups (owner side), with their member ids. */
export function useGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<CircleGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setGroups([]); setLoading(false); return; }
    const { data: gs } = await supabase
      .from('circle_groups')
      .select('id, name')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true });
    const ids = (gs ?? []).map((g: any) => g.id);
    let membersByGroup: Record<string, string[]> = {};
    if (ids.length > 0) {
      const { data: gm } = await supabase
        .from('circle_group_members')
        .select('group_id, member_id')
        .in('group_id', ids);
      (gm ?? []).forEach((r: any) => {
        (membersByGroup[r.group_id] ||= []).push(r.member_id);
      });
    }
    setGroups((gs ?? []).map((g: any) => ({ id: g.id, name: g.name, memberIds: membersByGroup[g.id] ?? [] })));
    setLoading(false);
  }, [user]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);

  const createGroup = useCallback(
    async (name: string, memberIds: string[]) => {
      if (!user) return { error: 'Not signed in' };
      const { data, error } = await supabase
        .from('circle_groups')
        .insert({ owner_id: user.id, name: name.trim() })
        .select('id')
        .single();
      if (error || !data) return { error: error?.message ?? 'Failed' };
      if (memberIds.length > 0) {
        await supabase
          .from('circle_group_members')
          .insert(memberIds.map((m) => ({ group_id: data.id, member_id: m })));
      }
      await refresh();
      return {};
    },
    [user, refresh],
  );

  const setMembers = useCallback(
    async (groupId: string, memberIds: string[]) => {
      // Replace the group's membership with the given set.
      await supabase.from('circle_group_members').delete().eq('group_id', groupId);
      if (memberIds.length > 0) {
        await supabase
          .from('circle_group_members')
          .insert(memberIds.map((m) => ({ group_id: groupId, member_id: m })));
      }
      await refresh();
      return {};
    },
    [refresh],
  );

  const renameGroup = useCallback(
    async (groupId: string, name: string) => {
      await supabase.from('circle_groups').update({ name: name.trim() }).eq('id', groupId);
      await refresh();
    },
    [refresh],
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      await supabase.from('circle_groups').delete().eq('id', groupId);
      await refresh();
    },
    [refresh],
  );

  return { groups, loading, refresh, createGroup, setMembers, renameGroup, deleteGroup };
}
