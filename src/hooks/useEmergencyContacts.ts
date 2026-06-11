import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface EmergencyContact {
  id: string;
  user_id: string;
  name: string;
  contact_info: string;
  priority: number;
  created_at: string;
}

export function useEmergencyContacts(userId?: string) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setContacts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', userId)
        .order('priority', { ascending: true });
      if (!cancelled) {
        setContacts((data ?? []) as EmergencyContact[]);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [userId, refresh]);

  return { contacts, loading, refresh };
}
