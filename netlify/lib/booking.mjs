// Shared booking logic for the Netlify Functions.
// Availability = opening hours (booking-config.json) minus busy times in Google Calendar.
import crypto from "node:crypto";
import config from "../../booking-config.json";

export { config };

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const TZ = config.timezone;

// ---------- Google Calendar (service account, no dependencies) ----------

const env = (name) => (process.env[name] || "").trim();

export function googleConfigured() {
  return Boolean(env("GOOGLE_SERVICE_ACCOUNT_EMAIL") && env("GOOGLE_PRIVATE_KEY") && env("GOOGLE_CALENDAR_ID"));
}

const b64url = (input) => Buffer.from(input).toString("base64url");

let cachedToken = null;

async function getAccessToken() {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.token;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: env("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const key = env("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const signature = crypto.createSign("RSA-SHA256").update(`${header}.${claims}`).sign(key, "base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Google auth failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  cachedToken = { token: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return cachedToken.token;
}

async function googleApi(path, body) {
  const token = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google Calendar ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function getBusy(timeMin, timeMax) {
  const calendarId = env("GOOGLE_CALENDAR_ID");
  const json = await googleApi("/freeBusy", {
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    items: [{ id: calendarId }],
  });
  const cal = json.calendars?.[calendarId];
  if (!cal || cal.errors?.length) {
    throw new Error(`Calendar not readable (is it shared with the service account?): ${JSON.stringify(cal?.errors)}`);
  }
  return cal.busy.map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }));
}

export async function createEvent({ summary, description, start, end }) {
  const calendarId = encodeURIComponent(env("GOOGLE_CALENDAR_ID"));
  return googleApi(`/calendars/${calendarId}/events`, {
    summary,
    description,
    start: { dateTime: start.toISOString(), timeZone: TZ },
    end: { dateTime: end.toISOString(), timeZone: TZ },
  });
}

// ---------- Time zone helpers (workshop time, whatever the server's zone) ----------

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function zoneParts(date) {
  const p = Object.fromEntries(partsFormatter.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

function offsetMs(date) {
  const p = zoneParts(date);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-10-16" + minutes after midnight (workshop time) -> Date */
export function zonedToDate(ymd, minutes) {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = offsetMs(new Date(guess));
  const second = offsetMs(new Date(guess - first));
  return new Date(guess - second);
}

export function todayYmd() {
  const p = zoneParts(new Date());
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const weekdayKey = (ymd) => DAY_KEYS[new Date(ymd + "T00:00:00Z").getUTCDay()];
const toMinutes = (hhmm) => hhmm.split(":").reduce((h, m) => h * 60 + +m);
export const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export const findService = (name) => config.services.find((s) => s.name === name);

// ---------- Demo mode: believable fake bookings until Google is connected ----------

function demoBusy(days) {
  const busy = [];
  for (const ymd of days) {
    let seed = [...ymd].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
    const blocks = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < blocks; i++) {
      const start = 8 * 60 + Math.floor(rand() * 16) * 30;
      const length = (1 + Math.floor(rand() * 4)) * 30;
      busy.push({ start: zonedToDate(ymd, start).getTime(), end: zonedToDate(ymd, start + length).getTime() });
    }
  }
  return busy;
}

// ---------- Availability ----------

/**
 * Free start times per day for a service.
 * Returns [{ date: "2026-10-16", slots: ["08:00", "08:30", ...] }, ...]
 */
export async function getAvailability(service, fromYmd = todayYmd(), numDays = config.daysAhead) {
  const days = Array.from({ length: numDays }, (_, i) => addDays(fromYmd, i));
  const open = days.filter((ymd) => config.hours[weekdayKey(ymd)]);
  if (!open.length) return days.map((date) => ({ date, slots: [] }));

  const rangeStart = zonedToDate(open[0], 0);
  const rangeEnd = zonedToDate(addDays(open[open.length - 1], 1), 0);
  const busy = googleConfigured() ? await getBusy(rangeStart, rangeEnd) : demoBusy(open);
  const earliest = Date.now() + config.minNoticeMinutes * 60_000;

  return days.map((date) => {
    const hours = config.hours[weekdayKey(date)];
    if (!hours) return { date, slots: [] };
    const [openMin, closeMin] = hours.map(toMinutes);
    const slots = [];
    for (let t = openMin; t + service.minutes <= closeMin; t += config.slotMinutes) {
      const start = zonedToDate(date, t).getTime();
      const end = start + service.minutes * 60_000;
      if (start < earliest) continue;
      if (busy.some((b) => b.start < end && b.end > start)) continue;
      slots.push(toHHMM(t));
    }
    return { date, slots };
  });
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
