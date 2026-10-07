// POST /.netlify/functions/book  { service, date, time, name, phone, vehicle, rego?, notes?, offer? }
// Re-checks the slot is still free, adds it to Google Calendar and emails a notification via Formspree.
import {
  config, createEvent, findService, getAvailability, googleConfigured, json, zonedToDate,
} from "../lib/booking.mjs";

const clean = (v, max) => String(v ?? "").trim().slice(0, max);

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  // Honeypot: real people never fill this hidden field
  if (body.company) return json({ ok: true });

  const service = findService(body.service);
  const date = clean(body.date, 10);
  const time = clean(body.time, 5);
  const name = clean(body.name, 80);
  const phone = clean(body.phone, 20);
  const vehicle = clean(body.vehicle, 100);
  const rego = clean(body.rego, 12).toUpperCase();
  const notes = clean(body.notes, 500);
  const offer = clean(body.offer, 20);

  if (!service || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return json({ error: "Please pick a service and time again." }, 400);
  }
  if (name.length < 2 || !/^[0-9 +()-]{8,20}$/.test(phone) || !vehicle) {
    return json({ error: "Please check your name, mobile and car details." }, 400);
  }

  try {
    // Is the slot still free right now? (Someone else may have just taken it.)
    const [day] = await getAvailability(service, date, 1);
    if (!day.slots.includes(time)) {
      return json({ error: "Sorry, that time was just taken. Please pick another.", taken: true }, 409);
    }

    const [h, m] = time.split(":").map(Number);
    const start = zonedToDate(date, h * 60 + m);
    const end = new Date(start.getTime() + service.minutes * 60_000);
    const details = [
      `Customer: ${name}`,
      `Mobile: ${phone}`,
      `Vehicle: ${vehicle}${rego ? ` (${rego})` : ""}`,
      offer && `Offer: ${offer}`,
      notes && `Notes: ${notes}`,
    ]
      .filter(Boolean)
      .concat("", "Booked online via the website.")
      .join("\n");

    if (googleConfigured()) {
      await createEvent({
        summary: `${service.name} – ${name}${rego ? ` (${rego})` : ""}`,
        description: details,
        start,
        end,
      });
    }

    const prettyDate = start.toLocaleDateString("en-AU", {
      timeZone: config.timezone, weekday: "short", day: "numeric", month: "short",
    });
    const prettyTime = start.toLocaleTimeString("en-AU", {
      timeZone: config.timezone, hour: "numeric", minute: "2-digit",
    });

    // Email notification (doesn't block the booking if it fails)
    if (config.formspreeEndpoint) {
      try {
        await fetch(config.formspreeEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            _subject: `New booking: ${service.name} – ${prettyDate} ${prettyTime} (${name})`,
            service: service.name,
            when: `${prettyDate} at ${prettyTime} (${service.minutes} min)`,
            name, phone, vehicle, rego, offer, notes,
            calendar: googleConfigured() ? "Added to Google Calendar" : "DEMO MODE: not added to a calendar",
          }),
        });
      } catch (err) {
        console.error("Formspree notification failed", err);
      }
    }

    return json({
      ok: true,
      demo: !googleConfigured(),
      booking: {
        service: service.name,
        start: start.toISOString(),
        end: end.toISOString(),
        label: `${prettyDate} at ${prettyTime}`,
      },
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Booking system is having trouble. Please call 0410 448 683." }, 502);
  }
};
