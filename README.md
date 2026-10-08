# Wollongong Tyres & Auto Repairs — Website

A fast one-page website for Wollongong Tyres & Auto Repairs (505 Crown St, Wollongong). It's plain HTML, CSS and JavaScript, so there's no build step, no database and nothing to maintain. You can host it for free.

```
index.html                 the whole page (text, prices, offers)
css/styles.css             colours & layout
js/main.js                 booking widget + mobile menu
booking-config.json        services, durations, prices, opening hours, slot length
netlify/functions/         availability + book (server side, runs on Netlify)
netlify/lib/booking.mjs    Google Calendar + slot logic
assets/                    logo images
```

## Online booking (live Google Calendar)

Customers book in 2 steps: **(1) pick a day on an Apple-style month calendar, then a free time** (a "Booking for" dropdown at the top sets the service, which sets how long the job blocks) **→ (2) name, mobile, car, notes**.

- No same-day online bookings (`sameDayBookings: false`); customers are told to call. Bookings open from tomorrow to `daysAhead` days out.

- Free times = opening hours in `booking-config.json` minus anything already in the workshop's Google Calendar.
  Bilal can block time by adding any event to his calendar (e.g. "Busy", "Walk-in", "Closed").
- Each booking blocks the service's `minutes`, so a 2-hour logbook service can't overlap another job.
- Bookings are added to the calendar and emailed via Formspree (`formspreeEndpoint`).
- Before a booking is saved the slot is re-checked, so two people can't take the same time.
- **Demo mode:** until the Google settings below are added, the site shows sample availability and only sends the email.

### Connect Google Calendar (about 15 minutes, free)

1. Go to https://console.cloud.google.com, create a project (e.g. "Wollongong Tyres Booking").
2. **APIs & Services → Library →** enable **Google Calendar API**.
3. **IAM & Admin → Service Accounts → Create service account** (name: `booking`). Skip the optional roles.
4. Open the service account → **Keys → Add key → Create new key → JSON**. A file downloads. Keep it private.
5. In Google Calendar (the calendar bookings should go into), open **Settings → [the calendar] → Share with specific people**,
   add the service account's email (`booking@…iam.gserviceaccount.com`) with **"Make changes to events"**.
   On the same page copy the **Calendar ID** (for a main calendar it's the Gmail address).
6. In Netlify → **Site configuration → Environment variables**, add:
   | Key | Value |
   |---|---|
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the JSON file |
   | `GOOGLE_PRIVATE_KEY` | `private_key` from the JSON file (the whole thing, including `-----BEGIN PRIVATE KEY-----`) |
   | `GOOGLE_CALENDAR_ID` | the Calendar ID from step 5 |
7. **Deploys → Trigger deploy.** The "Demo mode" note under the times disappears once it's connected.

For the demo, use your own Google Calendar. At handover, share Bilal's calendar with the service account and change `GOOGLE_CALENDAR_ID`.

**Changing services, prices, durations or hours:** edit `booking-config.json`. Service names must match the `data-book` buttons in `index.html`.

**To preview:** double-click `index.html`, or run `python3 -m http.server` in this folder and open http://localhost:8000.

---

## Before showing it to the owner (Bilal)

- [ ] **Prices** in `index.html` (search for `price`) are *estimates* for Wollongong. Confirm the real ones with him.
- [ ] **Offers**: confirm he's happy to run each one, or change/remove them.
- [x] **Reviews**: three real 5-star Google reviews are in place. Add new ones as they come in. Never publish made-up reviews; that is illegal under Australian Consumer Law.
- [ ] Ask him for the **original logo file** (PNG/SVG from his designer). The current one is cleaned up from a screenshot.

## Demo mode (current)

The site is hosted under the developer's accounts as a preview. It is hidden from Google by the `noindex` tag in `index.html` and by `robots.txt`.
Booking emails currently go to the developer's demo Formspree form (`formspreeEndpoint` in `booking-config.json`).
**At handover:** delete both, point the form at Bilal's own Formspree form, and move hosting, code and domain into his accounts (see "Handover to the owner").

## Going live (about 1 hour, $0–$25/yr)

1. **Hosting (free):** in [Netlify](https://app.netlify.com) choose **Add new site → Import an existing project** and pick this GitHub repo (leave build settings blank, since `netlify.toml` handles them). Don't use drag-and-drop "Netlify Drop": it doesn't run the booking functions.
2. **Domain:** register `wollongongtyres.com.au` (or similar) **in Bilal's name with his ABN**. `.com.au` domains require an Australian business. This costs about $15–25/yr through VentraIP, Crazy Domains, etc. Point it at Netlify (Netlify → Domain settings walks you through it).
3. **Booking notifications → his email:**
   - Create a free form at [Formspree](https://formspree.io) using his email `wollongongtyresautorepairs@gmail.com`.
   - Paste the form URL into `formspreeEndpoint` in `booking-config.json`. Connect his Google Calendar (see "Online booking").
   - Every booking request now lands in his inbox. The free tier allows 50/month.
   - *Upgrade option:* swap the form for a real calendar such as [Cal.com](https://cal.com) (free) or Google Calendar Appointment Schedules, so customers can pick live slots. Or use workshop software like Mechanic Desk if he already has it.
4. **Google review button:** find his Place ID at
   https://developers.google.com/maps/documentation/places/web-service/place-id,
   then replace `PLACE_ID` in `index.html` (search `writereview`).
5. **Google Business Profile:** add the website link to his profile, along with photos, hours and services. This is the single biggest driver of local "mechanic near me" calls.

## Handover to the owner

Everything should end up in **his** accounts so he isn't dependent on you:

| Item | How to transfer |
|---|---|
| Domain | Register it in his name from day one, or transfer it via the registrar |
| Netlify site | Netlify → Team settings → invite his email as Owner, then remove yourself (or keep yourself on if you're on a care plan) |
| Formspree | Create it with his email, or transfer it in Formspree settings |
| Code | Zip this folder and email it, or transfer the GitHub repo (Settings → Transfer ownership) |

## Making changes later

Text and prices live in `index.html`. Open it in any editor (or ask Claude Code), find the text and change it. Push to GitHub and Netlify redeploys automatically.
