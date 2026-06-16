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

// NOTE: This module holds shared TYPE definitions only. All real content comes
// from Supabase via hooks (useCircle, useEvents, useReports, usePresence).
