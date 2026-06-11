# Artemis — React Native

Port of the Artemis safety & wellness app design (`../design_handoff_artemis/`) to Expo + React Native.

## What's wired up

### Foundations
| Layer | Path |
|---|---|
| Design tokens (colors, type, spacing, radii, shadows, motion) | `src/theme/tokens.ts` |
| Theme provider (light/night, hue) + `useTheme()` | `src/theme/ThemeProvider.tsx` |
| Demo data (`USER`, `CIRCLE`, `INITIAL_EVENTS`, `INITIAL_REPORTS`) | `src/data/demo.ts` |
| Global app state (sharing, reports, events, calendarShares, trip, fakeCall) | `src/state/AppState.tsx` |
| Icons + brand mark (`react-native-svg`) | `src/components/icons/index.tsx` |
| Primitives — Avatar, StatusDot, PillButton, Card, Toggle, TopBar, Text/Eyebrow | `src/components/` |
| Composite - BottomSheet, CircleCard, QuickAction, EventCard, StatusPill, Row | `src/components/` |
| Bottom tab nav + root stack (with modal screens) | `src/navigation/` |

### Screens
| Screen | Path | Notes |
|---|---|---|
| Home / Dashboard | `src/screens/HomeScreen.tsx` | Hero card with "I'm OK" + radial gold pulse, horizontal Circle scroll, "Right now" 2-col grid |
| Map | `src/screens/MapScreen.tsx` | SVG-drawn forest aesthetic map (placeholder for real map SDK), avatar pins, "you" pulse pin, report zones, report bottom sheet |
| Circle list | `src/screens/CircleScreen.tsx` | Person rows + secondary contacts |
| Person profile | `src/screens/CirclePersonScreen.tsx` | Hero ringed avatar, 3 actions, details card, secondary contact |
| Calendar | `src/screens/CalendarScreen.tsx` | Month grid (today highlighted, event dots), upcoming list, share-sheet (per-person granularity none/checkin/full) |
| Profile | `src/screens/ProfileScreen.tsx` | Emergency contacts, shared calendar, day/night mode toggle |
| Location Share | `src/screens/LocationShareScreen.tsx` | Master toggle, 3 mode radios, per-person visibility |
| Wellness Incoming | `src/screens/WellnessIncomingScreen.tsx` | 30s auto-escalate gold progress bar, 3-tier response (good / need help / alarm) |
| Alarm Active | `src/screens/AlarmActiveScreen.tsx` | Crimson-tinted background, pulsing red field, recording indicator with animated 5-bar waveform + mm:ss timer, notified circle list |
| Trip Setup | `src/screens/TripSetupScreen.tsx` | Destination, ETA, 4-emoji transport row, buddy radio list |
| Trip Active | `src/screens/TripActiveScreen.tsx` | Animated progress bar (forest→gold), buddy card, arrived / need-help actions |
| Fake Call Setup | `src/screens/FakeCallSetupScreen.tsx` | 5 timing chips, schedule + immediate-2s |
| Fake Call Incoming | `src/screens/FakeCallIncomingScreen.tsx` | iOS-style fullscreen black/forest gradient, pulsing 1.6s ring, decline/answer 70px circles |
| Fake Call On-Call | `src/screens/FakeCallOnCallScreen.tsx` | mm:ss timer, "this is a fake call" banner, end button |

### Behaviors implemented
- **Wellness check auto-escalate** — 30s countdown on the gold progress bar; auto-dismisses at 0s.
- **Reports persist in memory** — submitting a new report from the map sheet prepends it to the list, visible immediately.
- **Trip progress** — ticks +1.5% every 1.5s in the prototype.
- **Calendar share levels** — `none`/`checkin`/`full` per person, drives the avatar stack on the calendar screen.
- **Theme switching** — toggle Day/Night in Profile; everything (including nav backgrounds, status dots, avatar rings) re-themes live.

## Setup

```powershell
cd artemis-rn
npm install
npx expo start --tunnel
```

> Windows PowerShell 5.1 doesn't support `&&` — run lines separately. PowerShell 7+, cmd.exe, and Git Bash all support `&&`.

Scan the QR with Expo Go (must be SDK 54).

## What's deliberately not real yet

These are spec-faithful UI mocks, but the underlying integrations are stubs:

| Surface | Mock | Real-app needs |
|---|---|---|
| Map | SVG-drawn pastel "Stockholm" with hand-placed pins | MapLibre / `react-native-maps` styled to spec, real geolocation for "you" pin |
| Audio recording (Alarm) | Animated waveform + mm:ss timer, no audio captured | `expo-av` `Audio.Recording` + microphone permission flow |
| Trip Mode escalation | Progress bar advances synthetically | `expo-location` background updates + geofence + local notifications |
| Fake Call | In-app fullscreen overlay | iOS CallKit (real lockscreen call), Android full-screen intent |
| Push notifications | None | `expo-notifications` for incoming wellness check / trip miss |

## Architecture notes

- **Navigation** — `RootStack` (native stack) wraps `RootTabs`. Modal screens (Wellness, Alarm, Fake Call states) use `presentation: 'fullScreenModal'`.
- **State** — single `AppState` context. No Redux / Zustand needed at this size; promote to a real store when you add persistence.
- **Animations** — Reanimated 4 (worklets via `react-native-worklets`, plugin handled by `babel-preset-expo` automatically).
- **Fonts** — Fraunces (display) + DM Sans (body) via `@expo-google-fonts/*`. App splash holds until both load (with fallback to system fonts if loader is slow).
- **Avatar gradients & primary buttons** — `expo-linear-gradient` to match the gold→gold and forest-700→forest-900 fills.

## Known rough edges

- **`PillButton` `style` prop** sets the outer animated wrapper, not the inner pill — passing `style={{ backgroundColor: ... }}` to recolor a secondary won't take effect. Add a `bgColor` override prop if you need that.
- **Map "you" pin position** is hard-coded at center; needs real geolocation.
- **Map circle pins** are at hand-placed coordinates (`CIRCLE_PIN_POS`); needs real circle member geo.
- **Calendar grid** assumes May 2026 starts on Tuesday (`startWeekday = 1`); needs real date math when you go beyond the demo month.
- **`react-native-screens` warning about transparent fullScreenModal** — harmless, can be silenced with `presentation: 'transparentModal'` if you tweak the alarm/wellness screens to work without an opaque background.

## Roadmap

- Persistence (`AsyncStorage` for events/reports)
- Real map SDK + geolocation
- `expo-av` audio recording
- `expo-notifications` for the 30s wellness check + trip miss
- Localization (Swedish strings already in demo data — extract to i18n)
- Onboarding flow (not in design yet)

