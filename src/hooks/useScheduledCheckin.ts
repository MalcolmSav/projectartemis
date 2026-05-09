import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'artemis.scheduled_checkin';

export function useScheduledCheckin() {
  const [scheduledFor, setScheduledForState] = useState<Date | null>(null);
  const [triggered, setTriggered] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load persisted time on mount
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (!v) return;
      const d = new Date(v);
      if (!isNaN(d.getTime())) setScheduledForState(d);
    });
  }, []);

  // Poll every 30s to check if the time has passed
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const check = () => {
      if (!scheduledFor) return;
      if (Date.now() >= scheduledFor.getTime()) setTriggered(true);
    };
    check();
    intervalRef.current = setInterval(check, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [scheduledFor]);

  const schedule = useCallback(async (time: Date) => {
    await AsyncStorage.setItem(KEY, time.toISOString());
    setScheduledForState(time);
    setTriggered(false);
  }, []);

  const cancel = useCallback(async () => {
    await AsyncStorage.removeItem(KEY);
    setScheduledForState(null);
    setTriggered(false);
  }, []);

  return { scheduledFor, triggered, schedule, cancel };
}
