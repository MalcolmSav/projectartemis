import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  ArtemisEvent,
  CalendarAccess,
  CIRCLE,
  INITIAL_EVENTS,
  INITIAL_REPORTS,
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

interface PinAsk {
  reason: string;
  onOk: () => void;
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
  events: ArtemisEvent[];
  calendarShares: Record<string, CalendarAccess>;

  // Trip
  trip: TripState | null;

  // Fake call
  fakeCallScheduledAt: number | null; // ms epoch
  fakeCallActive: boolean;
  fakeCallCallerName: string;

  // PIN modal
  pinAsk: PinAsk | null;
}

interface Actions {
  setSharing: (b: boolean) => void;
  setShareMode: (m: ShareMode) => void;
  setVisibleTo: (id: string, on: boolean) => void;

  addReport: (r: Omit<MapReport, 'id'>) => void;

  addEvent: (e: Omit<ArtemisEvent, 'id'>) => void;
  setCalendarShare: (id: string, level: CalendarAccess) => void;

  startTrip: (t: TripState) => void;
  endTrip: () => void;

  scheduleFakeCall: (delaySec: number) => void;
  cancelFakeCallSchedule: () => void;
  setFakeCallActive: (b: boolean) => void;
  setFakeCallCallerName: (name: string) => void;

  askPin: (reason: string, onOk: () => void) => void;
  clearPinAsk: () => void;
}

let _idSeq = 0;
function nextId(prefix: string) {
  return `${prefix}${Date.now()}_${++_idSeq}`;
}

const Ctx = createContext<(State & Actions) | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [sharing, setSharing] = useState(true);
  const [shareStartedAt, setShareStartedAt] = useState<number | null>(Date.now());
  const [shareMode, setShareMode] = useState<ShareMode>('always');
  const [visibleTo, setVisibleToMap] = useState<Record<string, boolean>>(
    Object.fromEntries(CIRCLE.map((p) => [p.id, true])),
  );
  const [reports, setReports] = useState<MapReport[]>(INITIAL_REPORTS);
  const [events, setEvents] = useState<ArtemisEvent[]>(INITIAL_EVENTS);
  const [calendarShares, setCalendarShares] = useState<Record<string, CalendarAccess>>(
    Object.fromEntries(CIRCLE.map((p) => [p.id, p.calendarAccess])),
  );
  const [trip, setTrip] = useState<TripState | null>(null);
  const [fakeCallScheduledAt, setFakeCallScheduledAt] = useState<number | null>(null);
  const [fakeCallActive, setFakeCallActive] = useState(false);
  const [fakeCallCallerName, setFakeCallCallerName] = useState('Mamma');
  const [pinAsk, setPinAsk] = useState<PinAsk | null>(null);

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

  const addEvent: Actions['addEvent'] = useCallback((e) => {
    setEvents((es) => [...es, { ...e, id: nextId('e') }]);
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

  const askPin: Actions['askPin'] = useCallback((reason, onOk) => {
    setPinAsk({ reason, onOk });
  }, []);
  const clearPinAsk = useCallback(() => setPinAsk(null), []);

  const value = useMemo<State & Actions>(
    () => ({
      sharing,
      shareStartedAt,
      shareMode,
      visibleTo,
      reports,
      events,
      calendarShares,
      trip,
      fakeCallScheduledAt,
      fakeCallActive,
      fakeCallCallerName,
      pinAsk,
      setSharing: handleSetSharing,
      setShareMode,
      setVisibleTo,
      addReport,
      addEvent,
      setCalendarShare,
      startTrip,
      endTrip,
      scheduleFakeCall,
      cancelFakeCallSchedule,
      setFakeCallActive,
      setFakeCallCallerName,
      askPin,
      clearPinAsk,
    }),
    [
      sharing,
      shareStartedAt,
      shareMode,
      visibleTo,
      reports,
      events,
      calendarShares,
      trip,
      fakeCallScheduledAt,
      fakeCallActive,
      fakeCallCallerName,
      pinAsk,
      handleSetSharing,
      setVisibleTo,
      addReport,
      addEvent,
      setCalendarShare,
      startTrip,
      endTrip,
      scheduleFakeCall,
      cancelFakeCallSchedule,
      askPin,
      clearPinAsk,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppState must be used inside <AppStateProvider>');
  return ctx;
}
