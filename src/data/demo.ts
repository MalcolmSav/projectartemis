import type { Status } from '../components/StatusDot';

export type CalendarAccess = 'none' | 'checkin' | 'full';
export type ReportKind = 'yellow' | 'red' | 'green';
export type ShareMode = 'always' | 'timed' | 'event';
export type Transport = 'walk' | 'transit' | 'car' | 'taxi';
export type WellnessResponse = 'good' | 'help' | 'alarm';

export interface CirclePerson {
  id: string;
  name: string;
  relation: string;
  lastSeen: string;
  lastLocation: string;
  status: Status;
  verified: boolean;
  phone: string;
  avatarTone: 'gold' | 'forest' | 'rose';
  secondary: { label: string; name: string; phone: string; note: string };
  calendarAccess: CalendarAccess;
}

export interface ArtemisEvent {
  id: string;
  day: number;
  title: string;
  time: string;
  location: string;
  notes?: string;
  checkIn: boolean;
}

export interface MapReport {
  id: string;
  kind: ReportKind;
  x: number; // 0-100
  y: number; // 0-100
  label: string;
  when: string;
  area: string;
}

export const USER = {
  name: 'Elin',
  fullName: 'Elin Bergström',
  bio: 'Karolinska, late shifts. Runs in Djurgården.',
  phone: '070-555 23 18',
  pin: '4729',
};

export const CIRCLE: CirclePerson[] = [
  {
    id: 'mamma',
    name: 'Anna',
    relation: 'Mamma',
    lastSeen: 'Just now',
    lastLocation: 'Hemma · Vasastan',
    status: 'ok',
    verified: true,
    phone: '070-411 22 03',
    avatarTone: 'gold',
    secondary: { label: 'Pappa', name: 'Lars', phone: '070-411 22 04', note: 'Backup if Anna unreachable' },
    calendarAccess: 'full',
  },
  {
    id: 'kompis',
    name: 'Sara',
    relation: 'Kompis',
    lastSeen: '12 min ago',
    lastLocation: 'Södermalm',
    status: 'warn',
    verified: true,
    phone: '073-882 19 45',
    avatarTone: 'forest',
    secondary: {
      label: "Sara's neighbor",
      name: 'Lisa',
      phone: '070-902 33 11',
      note: 'Backup contact if Sara unreachable',
    },
    calendarAccess: 'checkin',
  },
  {
    id: 'syster',
    name: 'Lina',
    relation: 'Syster',
    lastSeen: '3 hr ago',
    lastLocation: 'Uppsala',
    status: 'ok',
    verified: true,
    phone: '076-339 70 21',
    avatarTone: 'rose',
    secondary: {
      label: "Lina's partner",
      name: 'Johan',
      phone: '070-451 88 22',
      note: 'Reach if Lina away from phone',
    },
    calendarAccess: 'none',
  },
];

export const INITIAL_EVENTS: ArtemisEvent[] = [
  { id: 'e1', day: 14, title: 'Girls night', time: '21:00', location: 'Stureplan', checkIn: true, notes: 'With Sara + colleagues.' },
  { id: 'e2', day: 16, title: 'Morning run', time: '06:30', location: 'Djurgården', checkIn: true, notes: 'Loop around Sjöhistoriska.' },
  { id: 'e3', day: 18, title: 'Late shift', time: '22:00', location: 'Karolinska', checkIn: true, notes: 'Until 06:00. Walk to T-bana.' },
];

export const INITIAL_REPORTS: MapReport[] = [
  { id: 'r1', kind: 'yellow', x: 52, y: 38, label: 'Felt followed', when: '2 days ago', area: 'Tegnérgatan' },
  { id: 'r2', kind: 'red', x: 28, y: 62, label: 'Harassment reported', when: '6 hr ago', area: 'Slussen passage' },
  { id: 'r3', kind: 'green', x: 70, y: 70, label: 'Verified safe area', when: 'community', area: 'Medborgarplatsen' },
  { id: 'r4', kind: 'yellow', x: 62, y: 22, label: 'Poorly lit', when: 'last night', area: 'Vasaparken N' },
];
