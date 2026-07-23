# App Store Connect — copy-paste reference

Everything needed for the **App Information** and **Version Information** pages in App Store Connect. All character-limited fields verified against Apple's actual limits (script-checked, not eyeballed).

---

## ⚠️ Read this first: the app name

Apple requires App Store names to be **unique across the entire store**, and "Artemis" alone is a very common word/name — there's a real chance it's already taken by another app. This is a *different* field from your in-app branding (the app UI, website, and OAuth consent screen can all keep saying plain "Artemis" — that's unaffected).

**Recommended App Store name:** `Artemis: Safety Circle` (22/30 chars) — check availability in App Store Connect when you create the listing. If taken, fallbacks below also fit under 30 chars:
- `Artemis - Personal Safety`
- `Artemis: Live Location`
- `Artemis Safety`

---

## App Information

| Field | Value |
|---|---|
| **Name** | `Artemis: Safety Circle` (verify availability — see above) |
| **Subtitle** | `Your circle, always watching` (28/30) |
| **Primary Category** | Lifestyle |
| **Secondary Category** | Navigation *(Trip Mode is a genuine routing/navigation feature)* — Health & Fitness is a reasonable alternative given wellness checks |
| **Privacy Policy URL** | `https://artemis.embelstudio.se/privacy` |
| **Support URL** | `https://artemis.embelstudio.se/support` *(built this session — FAQ + contact)* |
| **Marketing URL** *(optional)* | `https://artemis.embelstudio.se` |
| **Copyright** | `© 2026 Embel Studio` *(confirm this is your registered legal entity name — swap if different)* |

---

## Version Information (English — primary locale)

### Promotional text (170 max, editable anytime without a new review)
```
Share your live location, send wellness checks, and know your circle always has your back. Real-time trip tracking, one-tap SOS, and more.
```
138/170 chars.

### Keywords (100 max, comma-separated)
```
safety,location sharing,check in,SOS,emergency,alarm,panic button,walk home,trip tracker,family
```
95/100 chars. Deliberately doesn't repeat words already in the name/subtitle ("circle", "watching", "Artemis") — those are indexed automatically, so repeating them wastes keyword budget.

### Description (4000 max, 2714/4000 used)
Full text in [`docs/description_en.txt`](description_en.txt) — copy-paste directly from that file into App Store Connect.

### What's New in This Version (first release)
```
Welcome to Artemis — your personal safety circle. Share your live location, run trips with real-time tracking, answer wellness checks right from your lock screen, and know your circle always has your back.
```

---

## Version Information (Swedish — sv-SE locale)

Add this as a secondary localization in App Store Connect (App Information → add sv-SE). Sweden is a natural strong market given the in-app 112 integration and existing full Swedish translation.

| Field | Value |
|---|---|
| **Name** | `Artemis: Trygghetscirkel` (24/30) |
| **Subtitle** | `Din cirkel vakar alltid` (23/30) |
| **Promotional text** | `Dela din live-plats, skicka mående-kollar och vet att din cirkel alltid har din rygg. Live-spårning av resor, SOS med ett tryck, och mer.` (137/170) |
| **Keywords** | `trygghet,platsdelning,incheckning,SOS,nödsituation,larm,panikknapp,gå hem,resespårning,familj` (93/100) |
| **Description** | Full text in [`docs/description_sv.txt`](description_sv.txt) — 2745/4000 chars |

---

## Age Rating Questionnaire

Expected result based on actual app content: **4+**. Answer the questionnaire as follows:

| Question | Answer | Why |
|---|---|---|
| Cartoon/Fantasy or Realistic Violence | None | — |
| Sexual Content or Nudity | None | — |
| Profanity or Crude Humor | None | — |
| Alcohol, Tobacco, or Drug Use | None | — |
| Mature/Suggestive Themes | None | — |
| Horror/Fear Themes | None | — |
| Gambling (Simulated or Contests) | No | — |
| Unrestricted Web Access | No | The in-app browser is only used for OAuth sign-in redirects, not general browsing |
| Medical/Treatment Information | No | — |
| User-Generated Content | Yes, but private only | 1:1 messaging and safety reports exist, but there are no public feeds, no strangers-matching, and all connections require mutual opt-in acceptance |

---

## App Review Information

### Contact info
Fill in your name, phone number, and email. Use an email you actually monitor — Apple reviewers do sometimes follow up.

### Demo account (required — the app requires sign-in)
You need to create a real test account and provide its credentials here. Suggested approach:
1. Sign up in the app with something like `appreview@embelstudio.se` and a password you control
2. Complete onboarding fully (name, and ideally add a second demo account as a circle member so the reviewer can see a populated circle, not an empty one)
3. Enter those exact credentials in the **Sign-In Required** section of App Review Information

*(I can help create this account through the web preview if you'd like — just ask.)*

### Review notes (paste into the free-text notes field)
```
Artemis is a personal safety app. Location is only ever shared with circle members
the user has explicitly approved, and only while sharing, a trip, or an alarm is
active — it is never shared automatically or publicly. It is a supplementary
safety tool, not a replacement for emergency services.

The demo account above can be used to test sign-in, profile setup, the calendar,
fake call, safety timer, and the emergency-contact/SOS flow end-to-end.

Some features are inherently two-person interactions (a wellness check sent to
a circle member, or one user following another's live trip). These require two
connected accounts to fully exercise — the single demo account can send a
wellness check to itself's circle contact if a second seed account is provided,
or reviewers are welcome to create a second free account to test the full
circle flow. All core single-user safety features are fully testable with the
one demo account.
```

---

## App Privacy (nutrition label)

Already documented in detail in `docs/app-store-privacy.md` from a prior session — still accurate, no changes needed. Covers: no tracking, data types collected (email, name, phone, precise location, user content, user ID), and confirms contacts are *not* read from the device (emergency contacts are typed in manually).

---

## Screenshots

Not covered by this document — Apple requires 6.7" (1290×2796) and 6.1" (1179×2556) device screenshots minimum. This needs either real device screenshots from TestFlight or simulator captures at the correct resolution. Happy to help generate these next — say the word.

---

## What still needs a human

- Confirm the App Store name is actually available (App Store Connect will tell you when you try to save it)
- Confirm "Embel Studio" is the correct legal entity for the copyright line
- Create and populate the demo account
- Fill in your personal contact info for App Review
- Screenshots (separate task)
