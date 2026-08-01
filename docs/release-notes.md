# Release notes — 1.0.1

Two audiences, two tones:
- **TestFlight → "What to Test"** — specific, tells testers what to poke at.
- **App Store → "What's New"** — benefit-led, no jargon. (Only used for updates
  *after* your first public release; on a first release Apple shows the
  description instead.)

Both fit Apple's 4000-character limit.

---

## TestFlight — What to Test (English)

```
Big update. The main things to try:

TRIPS
• You can now pick several people — or a whole group — to follow one trip.
• Followers tap "I'm following this trip", so you get a real confirmation
  instead of guessing. Check the traveller sees "Confirmed".
• New group chat inside a trip, shared by everyone following it.
• Search a destination, then tap the map to place the pin on the exact
  entrance.
• Tapping "Need help" during a trip no longer breaks the back button.
• Any follower can close a trip the traveller forgot to end.

CIRCLE & EMERGENCIES
• New Groups (Circle tab → Groups) — bundle people as "Family", "Roommates".
• If someone raises an alarm you now get a dedicated emergency screen: their
  live location, one-tap call, and clear steps for how to help.
• Profiles only show activity that involves you.

WELLNESS CHECKS
• Checks sent to you are saved in the app (bell icon) — not just the
  notification, so a missed one is still there.
• You can answer straight from the lock screen: press and hold the
  notification.
• The button on someone's profile now says what it actually does.

GETTING STARTED
• Onboarding is much shorter, and you pick your language on the sign-in screen.
• Features explain themselves the first time you tap them.

FIXED
• Sign in with Google works again.
• Address search finds street numbers properly (e.g. "Åkerbyvägen 82").
• Calendar shows only upcoming events, and shared calendars work.
• A bug where the app stopped responding to taps after a feature intro.

Please report anything that feels slow, unclear, or wrong — especially around
trips, since that changed the most.
```

## TestFlight — Vad du kan testa (Svenska)

```
Stor uppdatering. Det viktigaste att prova:

RESOR
• Du kan nu välja flera personer — eller en hel grupp — som följer en resa.
• Följare trycker "Jag följer denna resa", så du får en riktig bekräftelse
  istället för att gissa. Kolla att resenären ser "Bekräftat".
• Ny gruppchatt inne i resan, delad av alla som följer.
• Sök en destination och tryck sedan på kartan för att placera nålen på exakt
  entré.
• "Behöver hjälp" under en resa kraschar inte längre tillbaka-knappen.
• Vilken följare som helst kan avsluta en resa som resenären glömt.

CIRKEL & NÖDLÄGEN
• Nya Grupper (fliken Cirkel → Grupper) — bunta ihop personer som "Familjen".
• Om någon larmar får du nu en särskild nödsida: deras live-plats, ring med ett
  tryck, och tydliga steg för hur du hjälper.
• Profiler visar bara aktivitet som rör dig.

MÅENDE-KOLLAR
• Kollar som skickats till dig sparas i appen (klockikonen) — inte bara som
  avisering, så en missad koll finns kvar.
• Du kan svara direkt från låsskärmen: håll in aviseringen.
• Knappen på någons profil säger nu vad den faktiskt gör.

KOMMA IGÅNG
• Onboardingen är mycket kortare, och du väljer språk på inloggningsskärmen.
• Funktioner förklarar sig själva första gången du trycker på dem.

FIXAT
• Logga in med Google fungerar igen.
• Adressökning hittar gatunummer korrekt (t.ex. "Åkerbyvägen 82").
• Kalendern visar bara kommande händelser, och delade kalendrar fungerar.
• Ett fel där appen slutade svara på tryck efter en funktionsförklaring.

Rapportera gärna allt som känns långsamt, otydligt eller fel — särskilt kring
resor, som ändrats mest.
```

---

## App Store — What's New (English)

```
Trips just got a lot more useful.

• Bring more than one person along. Choose several people — or a whole group
  like "Family" — to follow a single trip.
• Know they're really there. Followers confirm they're watching, so you get a
  clear yes instead of hoping.
• Talk in one place. Every trip now has its own group chat.
• Land on the right doorstep. Search an address, then place the pin exactly
  where you're headed.

Also in this update:
• Groups — organise your circle once, use it everywhere.
• A clearer emergency screen when someone in your circle raises an alarm,
  with their live location and what to do next.
• Wellness checks sent to you are saved in the app, so you'll never miss one.
• A much shorter setup, and you can choose your language right away.
• Fixes for Google sign-in, address search, and the calendar.
```

## App Store — Nyheter (Svenska)

```
Resor har blivit mycket mer användbara.

• Ta med fler än en. Välj flera personer — eller en hel grupp som "Familjen" —
  som följer samma resa.
• Vet att de verkligen är där. Följare bekräftar att de tittar, så du får ett
  tydligt ja istället för att hoppas.
• Prata på ett ställe. Varje resa har nu en egen gruppchatt.
• Hamna vid rätt dörr. Sök en adress och placera sedan nålen exakt dit du ska.

Även i den här uppdateringen:
• Grupper — organisera din cirkel en gång, använd den överallt.
• En tydligare nödsida när någon i din cirkel larmar, med deras live-plats och
  vad du bör göra.
• Mående-kollar som skickats till dig sparas i appen, så du missar aldrig en.
• Mycket kortare uppstart, och du kan välja språk direkt.
• Fixar för Google-inloggning, adressökning och kalendern.
```

---

## Before you send this to testers

The trip-following, groups, chat and calendar-sharing features **require
`supabase/pending_migrations.sql` to have been run**. Until it is, testers will
see "Couldn't confirm" on the follow button and no groups. Run it first, then
release the build.
