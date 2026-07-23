# Trip Live Activity — setup

Dynamic Island + lock-screen live card for an active trip (ETA countdown,
distance left, route progress, "👀 {buddy} is watching"). iOS 16.2+.

**The JS side is already wired and live** in the app (`src/lib/liveActivity.ts`,
called from `src/screens/TripActiveScreen.tsx`). It safely no-ops until the
native module below is linked, so the current build is unaffected. These native
pieces need an **EAS dev build** to compile — they can't be tested in Expo web
or Expo Go.

> Honest status: I can't run an iOS build from here, so treat this as a
> ~90%-there scaffold. The one step most likely to need adjustment on the first
> real build is **Step 4 (sharing the attributes type)** — verify that first.

---

## Step 1 — install tooling

```bash
npx expo install @bacons/expo-apple-targets
```

## Step 2 — move the files into place

From `native-staging/live-activity/`:

- `target/*`  → a new folder `targets/ArtemisWidget/` at the project root
  (the 4 Swift files + `expo-target.config.js`).
- `module/*`  → a new local module folder `modules/artemis-live-activity/`
  (`expo-module.config.json` + `ArtemisLiveActivityModule.swift`, the Swift file
  under an `ios/` subfolder: `modules/artemis-live-activity/ios/`).
- `plugins/withLiveActivity.js` → `plugins/withLiveActivity.js` at project root.

## Step 3 — wire app.json

Add to `expo.plugins`:

```json
"@bacons/expo-apple-targets",
"./plugins/withLiveActivity"
```

(If you prefer not to use the custom plugin for Info.plist, you can instead add
`"NSSupportsLiveActivities": true` under `expo.ios.infoPlist` directly — but you
still need the plugin, or a manual step, for Step 4.)

## Step 4 — share the attributes type (the important one)

`TripActivityAttributes` must be ONE Swift type compiled into **both** the
`ArtemisWidget` target and the **main app** target. `expo-apple-targets` compiles
it into the widget (it's in the target folder). `withLiveActivity.js` adds the
same file to the app target's sources — confirm `SHARED_ATTRIBUTES_PATH` in that
plugin matches where the file ends up after `npx expo prebuild` (open the
generated `ios/` project and check the app target's Build Phases → Compile
Sources includes `TripActivityAttributes.swift`).

If ActivityKit reports the activity never appears / type mismatch, this is the
cause: the two targets are compiling two different structs. Fix by ensuring the
single file is a member of both targets.

## Step 5 — build & test

```bash
eas build --profile development --platform ios
```

Install on a real device (Live Activities don't show in the simulator's Dynamic
Island reliably), start a trip, and watch the lock screen + Dynamic Island.

---

## How it drives updates

- `startTripActivity` fires when a trip becomes active.
- Updates push every 15 s, plus an immediate update the moment the buddy opens
  the trip (the "👀 watching" flip).
- The ETA **counts down natively** from `endEpochSec`, so it stays smooth
  without frequent JS updates (better battery).
- `endTripActivity` fires when the trip ends (arrived / cancelled / escalated)
  or the screen unmounts.

## Phase 2 (not included)

Updating the card while the app is fully terminated needs **ActivityKit push
updates** (APNs `liveactivity` push type + per-activity push token + a small
server tweak in the `notify` edge function). The current version updates while
the trip is active and the app is foreground or background-running (which it is,
via the trip background-location task). That already covers the vast majority of
the experience.
