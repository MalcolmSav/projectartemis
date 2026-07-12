import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';

/** Returns the number of consecutive calendar days (ending today) where the user had at least one 'ok' check-in. */
export function useStreak() {
  const { user } = useAuth();
  const [streak, setStreak] = useState(0);

  const compute = useCallback(async () => {
    if (!user) return;
    // Fetch last 90 ok check-ins — plenty to compute a realistic streak.
    const { data } = await supabase
      .from('check_ins')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('kind', 'ok')
      .order('created_at', { ascending: false })
      .limit(90);

    if (!data || data.length === 0) { setStreak(0); return; }

    // Build a Set of unique YYYY-MM-DD dates (local time).
    const days = new Set<string>(
      data.map((c: { created_at: string }) => {
        const d = new Date(c.created_at);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      }),
    );

    // Walk backwards from today, counting consecutive days.
    let count = 0;
    const now = new Date();
    for (let i = 0; i < 90; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (days.has(key)) {
        count++;
      } else {
        // Allow today to be empty (user hasn't checked in yet today).
        if (i === 0) continue;
        break;
      }
    }
    setStreak(count);
  }, [user]);

  useEffect(() => { compute(); }, [compute]);

  return streak;
}
