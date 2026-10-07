# Wollongong Tyres & Auto Repairs — Website

A fast one-page website for Wollongong Tyres & Auto Repairs (505 Crown St, Wollongong). It's plain HTML, CSS and JavaScript, so there's no build step, no database and nothing to maintain. You can host it for free.

```
index.html        the whole page (text, prices, offers)
css/styles.css    colours & layout
js/main.js        booking form + mobile menu  (CONFIG at the top)
assets/           logo images
```

**To preview:** double-click `index.html`, or run `python3 -m http.server` in this folder and open http://localhost:8000.

---

## Before showing it to the owner (Bilal)

- [ ] **Prices** in `index.html` (search for `price`) are *estimates* for Wollongong. Confirm the real ones with him.
- [ ] **Offers**: confirm he's happy to run each one, or change/remove them.
- [x] **Reviews**: three real 5-star Google reviews are in place. Add new ones as they come in. Never publish made-up reviews; that is illegal under Australian Consumer Law.
- [ ] Ask him for the **original logo file** (PNG/SVG from his designer). The current one is cleaned up from a screenshot.

## Going live (about 1 hour, $0–$25/yr)

1. **Hosting (free):** sign up at [Netlify](https://app.netlify.com/drop) and drag this folder onto the "Drop" page. You get a live URL straight away. Cloudflare Pages and GitHub Pages also work and are free.
2. **Domain:** register `wollongongtyres.com.au` (or similar) **in Bilal's name with his ABN**. `.com.au` domains require an Australian business. This costs about $15–25/yr through VentraIP, Crazy Domains, etc. Point it at Netlify (Netlify → Domain settings walks you through it).
3. **Booking form → his phone/email:**
   - Create a free form at [Formspree](https://formspree.io) using his email `wollongongtyresautorepairs@gmail.com`.
   - Paste the form URL into `formEndpoint` in `js/main.js`.
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

Text and prices live in `index.html`. Open it in any editor (or ask Claude Code), find the text and change it. Then drag the folder onto Netlify again, or push to GitHub if Netlify is connected to the repo, which auto-deploys.
