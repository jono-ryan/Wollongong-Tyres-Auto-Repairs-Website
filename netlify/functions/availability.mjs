// GET /.netlify/functions/availability?service=Logbook%20Service
// -> { demo, timezone, days: [{ date: "2026-10-16", slots: ["08:00", ...] }] }
import { config, findService, getAvailability, googleConfigured, json } from "../lib/booking.mjs";

export default async (req) => {
  const service = findService(new URL(req.url).searchParams.get("service") || "");
  if (!service) return json({ error: "Unknown service" }, 400);

  try {
    const days = await getAvailability(service);
    return json({ demo: !googleConfigured(), timezone: config.timezone, days });
  } catch (err) {
    console.error(err);
    return json({ error: "Couldn't load available times" }, 502);
  }
};
