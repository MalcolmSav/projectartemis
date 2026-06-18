import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  CalendarAccess,
  MapReport,
  ShareMode,
  Transport,
} from '../data/demo';

export interface TripState {
  destination: string;
  eta: string;
  buddyId: string;
  transport: Transport;
  startedAt: number;
}

interface State {
  // Location sharing
  sharing: boolean;
  shareStartedAt: number | null; // epoch ms when sharing was turned on
  shareMode: ShareMode;
  visibleTo: Record<string, boolean>;

  // Reports
  reports: MapReport[];

  // Calendar
  calendarShares: Record<string, CalendarAccess>;

  // Trip
  trip: TripState | null;

  // Fake call
  fakeCallScheduledAt: number | null; // ms epoch
  fakeCallActive: boolean;
  fakeCallCallerName: string;

}

interface Actions {
  setSharing: (b: boolean) => void;
  setShareMode: (m: ShareMode) => void;
  setVisibleTo: (id: string, on: boolean) => void;

  addReport: (r: Omit<MapReport, 'id'>) => void;

  setCalendarShare: (id: string, level: CalendarAccess) => void;

  startTrip: (t: TripState) => void;
  endTrip: () => void;

  scheduleFakeCall: (delaySec: number) => void;
  cancelFakeCallSchedule: () => void;
  setFakeCallActive: (b: boolean) => void;
  setFakeCallCallerName: (name: string) => void;

}

let _idSeq = 0;
function nextId(prefix: string) {
  return `${prefix}${Date.now()}_${++_idSeq}`;
}

const Ctx = createContext<(State & Actions) | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [sharing, setSharing] = useState(false);
  const [shareStartedAt, setShareStartedAt] = useState<number | null>(null);
  const [shareMode, setShareMode] = useState<ShareMode>('always');
  const [visibleTo, setVisibleToMap] = useState<Record<string, boolean>>({});
  const [reports, setReports] = useState<MapReport[]>([]);
  const [calendarShares, setCalendarShares] = useState<Record<string, CalendarAccess>>({});
  const [trip, setTrip] = useState<TripState | null>(null);
  const [fakeCallScheduledAt, setFakeCallScheduledAt] = useState<number | null>(null);
  const [fakeCallActive, setFakeCallActive] = useState(false);
  // Empty by default — screens fall back to a locale-aware default (Mom / Mamma).
  const [fakeCallCallerName, setFakeCallCallerName] = useState('');
  const handleSetSharing = useCallback((b: boolean) => {
    setSharing(b);
    if (b) setShareStartedAt(Date.now());
    else setShareStartedAt(null);
  }, []);

  const setVisibleTo = useCallback((id: string, on: boolean) => {
    setVisibleToMap((m) => ({ ...m, [id]: on }));
  }, []);

  const addReport: Actions['addReport'] = useCallback((r) => {
    setReports((rs) => [{ ...r, id: nextId('r') }, ...rs]);
  }, []);

  const setCalendarShare: Actions['setCalendarShare'] = useCallback((id, level) => {
    setCalendarShares((m) => ({ ...m, [id]: level }));
  }, []);

  const startTrip: Actions['startTrip'] = useCallback((t) => setTrip(t), []);
  const endTrip = useCallback(() => setTrip(null), []);

  const scheduleFakeCall = useCallback((delaySec: number) => {
    setFakeCallScheduledAt(Date.now() + delaySec * 1000);
  }, []);
  const cancelFakeCallSchedule = useCallback(() => setFakeCallScheduledAt(null), []);

  const value = useMemo<State & Actions>(
    () => ({
      sharing,
      shareStartedAt,
      shareMode,
      visibleTo,
      reports,
      calendarShares,
      trip,
      fakeCallScheduledAt,
      fakeCallActive,
      fakeCallCallerName,
      setSharing: handleSetSharing,
      setShareMode,
      setVisibleTo,
      addReport,
      setCalendarShare,
      startTrip,
      endTrip,
      scheduleFakeCall,
      cancelFakeCallSchedule,
      setFakeCallActive,
      setFakeCallCallerName,
    }),
    [
      sharing,
      shareStartedAt,
      shareMode,
      visibleTo,
      reports,
      calendarShares,
      trip,
      fakeCallScheduledAt,
      fakeCallActive,
      fakeCallCallerName,
      handleSetSharing,
      setVisibleTo,
      addReport,
      setCalendarShare,
      startTrip,
      endTrip,
      scheduleFakeCall,
      cancelFakeCallSchedule,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppState must be used inside <AppStateProvider>');
  return ctx;
}
