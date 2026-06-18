# App Store "App Privacy" — what to enter

Fill this in App Store Connect → your app → **App Privacy**. Answers below match
what Artemis actually does (Supabase backend, Google/Apple sign-in, Resend email).

## Tracking
- **Do you or your partners track users?** → **No.**
  (No ad SDKs, no cross-app/cross-site tracking. So no "Tracking" section.)

## Data types collected — declare each as: collected, **linked to identity**, used for **App Functionality** (not tracking, not advertising)

| Apple category | Data type | Why |
|---|---|---|
| Contact Info | **Email Address** | Account creation / sign-in |
| Contact Info | **Name** | Profile / shown to your circle |
| Contact Info | **Phone Number** | Optional profile field + emergency contacts |
| Location | **Precise Location** | Live location sharing, trip mode, nearby safety reports |
| User Content | **Other User Content** | Bio, chat messages, safety reports, check-ins |
| Identifiers | **User ID** | Supabase account id |
| Contacts | *(none)* | We do NOT read the device address book — emergency contacts are typed in manually, so do **not** declare "Contacts" |

For every row above:
- **Used for:** App Functionality (and "Account" where offered)
- **Linked to the user's identity:** Yes
- **Used for tracking:** No

## Data NOT collected (leave unchecked)
- Health & Fitness, Financial, Browsing/Search History, Purchases, Sensitive Info,
  Diagnostics/Analytics (no analytics SDK), Advertising Data.

## Account deletion (required, already in the app)
Apple Guideline 5.1.1(v): the in-app **Delete account** (Profile → Radera konto)
runs the `delete_my_account` Supabase RPC and removes all rows + the auth user.
Make sure `launch_prep.sql` is applied in the production database so the RPC exists.

## Notes for the reviewer (App Review → Notes)
- "Artemis is a personal-safety app. Location is shared only with the user's own
  trusted circle, controlled by an in-app toggle and trip mode. It is a
  supplementary tool, not a replacement for emergency services."
- Provide a demo account (email + password) so the reviewer can test the circle,
  wellness checks, and trip mode without needing a second device.

## Permission strings (already set in app.json, shown at the OS prompt)
- Location: NSLocationWhenInUseUsageDescription
- Photos/Camera: profile photo
- Notifications: local check-in reminders
