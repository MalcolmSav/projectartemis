import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleLocalNotification, cancelLocalNotification } from '../lib/notifications';
import { DBEvent } from './useEvents';

const KEY = 'artemis.event_reminders';

/** Resolve an event's date + time into a concrete Date (defaults to 09:00). */
function eventDateTime(e: DBEvent): Date | null {
  if (!e.date) return null;
  const parts = e.date.split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  let h = 9;
  let m = 0;
  if (e.time) {
    const match = e.time.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      h = parseInt(match[1], 10);
      m = parseInt(match[2], 10);
    }
  }
  const d = new Date(parts[0], parts[1] - 1, parts[2], h, m, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

type ReminderMap = Record<string, { notifId: string; fireAt: string }>;

/**
 * Schedules a local check-in notification for every upcoming event flagged
 * `check_in`, and keeps them in sync as events are added/edited/removed.
 * Drives off the events array; call once from an authenticated top-level view.
 */
export function useEventCheckinReminders(events: DBEvent[]) {
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (running.current) return;
      running.current = true;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const existing: ReminderMap = raw ? JSON.parse(raw) : {};
        const next: ReminderMap = { ...existing };

        // What we *want* scheduled: future, check-in-flagged events.
        const wanted = new Map<string, Date>();
        for (const e of events) {
          if (!e.check_in) continue;
          const dt = eventDateTime(e);
          if (!dt || dt.getTime() <= Date.now()) continue;
          wanted.set(e.id, dt);
        }

        // Cancel reminders that are no longer wanted or whose time changed.
        for (const id of Object.keys(existing)) {
          const want = wanted.get(id);
          if (!want || want.toISOString() !== existing[id].fireAt) {
            await cancelLocalNotification(existing[id].notifId);
            delete next[id];
          }
        }

        // Schedule any new/rescheduled reminders.
        for (const [id, dt] of wanted) {
          if (next[id]) continue;
          const e = events.find((ev) => ev.id === id);
          if (!e) continue;
          const notifId = await scheduleLocalNotification({
            title: '🏹 Time to check in',
            body: `${e.title}${e.location ? ` · ${e.location}` : ''} — open Artemis and tap I'm OK when you're safe.`,
            date: dt,
            data: { type: 'event_checkin', eventId: id },
          });
          if (notifId) next[id] = { notifId, fireAt: dt.toISOString() };
        }

        if (!cancelled) await AsyncStorage.setItem(KEY, JSON.stringify(next));
      } finally {
        running.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [events]);
}
