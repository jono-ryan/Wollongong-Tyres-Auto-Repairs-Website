// ---- Settings: fill these in before going live (see README) ----
const CONFIG = {
  // Formspree form URL. Booking requests are emailed to the Formspree account owner.
  // Leave empty to demo the form without sending anything.
  formEndpoint: "https://formspree.io/f/mkjojzly",
  shopMobile: "0410448683",
  // Opening hours per weekday (0 = Sunday). null = closed. 24h "HH:MM".
  hours: {
    0: null,
    1: ["08:00", "17:00"],
    2: ["08:00", "17:00"],
    3: ["08:00", "17:00"],
    4: ["08:00", "17:00"],
    5: ["08:00", "17:00"],
    6: ["08:00", "17:00"],
  },
  slotMinutes: 30,
  // Same-day bookings must be at least this far ahead of now.
  sameDayLeadMinutes: 60,
};

// Mobile menu
const toggle = document.querySelector(".nav-toggle");
const nav = document.getElementById("nav");
toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});
nav.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  })
);

document.getElementById("year").textContent = new Date().getFullYear();

// "Book this" / "Claim offer" buttons pre-fill the form and scroll to it
const form = document.getElementById("booking-form");
const serviceSelect = document.getElementById("service");
const notes = document.getElementById("notes");
const offerInput = document.getElementById("offer");

document.querySelectorAll("[data-book]").forEach((btn) =>
  btn.addEventListener("click", () => {
    serviceSelect.value = btn.dataset.book;
    if (btn.dataset.offer) {
      offerInput.value = btn.dataset.offer;
      if (!notes.value.includes(btn.dataset.offer)) {
        notes.value = `Offer: ${btn.dataset.offer}\n${notes.value}`.trim();
      }
    }
    document.getElementById("book").scrollIntoView({ behavior: "smooth" });
    setTimeout(() => document.getElementById("date").focus({ preventScroll: true }), 600);
  })
);

// Date picker + 30-minute drop-off slots built from CONFIG.hours
const dateInput = document.getElementById("date");
const timeSelect = document.getElementById("time");
const toISO = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const formatTime = (mins) => {
  const h = Math.floor(mins / 60);
  const m = String(mins % 60).padStart(2, "0");
  return `${h % 12 || 12}:${m}${h < 12 ? "am" : "pm"}`;
};

dateInput.min = toISO(new Date());

function fillSlots() {
  const previous = timeSelect.value;
  timeSelect.innerHTML = "";
  dateInput.setCustomValidity("");

  if (!dateInput.value) {
    timeSelect.add(new Option("Pick a day first", ""));
    timeSelect.disabled = true;
    return;
  }

  const day = new Date(dateInput.value + "T00:00");
  const hours = CONFIG.hours[day.getDay()];
  if (!hours) {
    dateInput.setCustomValidity("We're closed that day. Please pick Mon–Sat.");
    dateInput.reportValidity();
    timeSelect.add(new Option("Closed that day", ""));
    timeSelect.disabled = true;
    return;
  }

  const [open, close] = hours.map(toMinutes);
  let earliest = open;
  if (dateInput.value === toISO(new Date())) {
    const now = new Date();
    earliest = Math.max(open, now.getHours() * 60 + now.getMinutes() + CONFIG.sameDayLeadMinutes);
  }

  const slots = [];
  for (let t = open; t + CONFIG.slotMinutes <= close; t += CONFIG.slotMinutes) {
    if (t >= earliest) slots.push(formatTime(t));
  }

  if (!slots.length) {
    timeSelect.add(new Option("No times left today. Pick another day", ""));
    timeSelect.disabled = true;
    return;
  }

  timeSelect.add(new Option("Select a time…", ""));
  slots.forEach((label) => timeSelect.add(new Option(label, label)));
  timeSelect.disabled = false;
  if (slots.includes(previous)) timeSelect.value = previous;
}
dateInput.addEventListener("change", fillSlots);
fillSlots();

// Submit
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const required = form.querySelectorAll("[required]");
  let ok = true;
  required.forEach((el) => {
    const bad = !el.value.trim() || !el.checkValidity();
    el.classList.toggle("invalid", bad);
    if (bad) ok = false;
  });
  document.getElementById("form-error").textContent = "Please fill in the highlighted fields.";
  document.getElementById("form-error").hidden = ok;
  if (!ok) return;

  const data = Object.fromEntries(new FormData(form));
  data.date = new Date(data.date + "T00:00").toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

  const errorBox = document.getElementById("form-error");
  const submitBtn = document.getElementById("submit-btn");

  if (CONFIG.formEndpoint) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    try {
      const res = await fetch(CONFIG.formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...data,
          _subject: `New booking request: ${data.service} on ${data.date} at ${data.time} (${data.name})`,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body.errors || []).map((e) => e.message).join(" ");
        throw new Error(msg || res.statusText);
      }
    } catch (err) {
      errorBox.textContent = `Sorry, the booking didn't send${err.message ? ` (${err.message})` : ""}. Please call or text 0410 448 683.`;
      errorBox.hidden = false;
      return;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Request booking";
    }
  }

  const sms =
    `Hi, booking request: ${data.service} on ${data.date} at ${data.time}. ` +
    `${data.vehicle}${data.rego ? " (" + data.rego + ")" : ""}. ${data.name}, ${data.phone}`;
  const sep = /iPhone|iPad|Mac/.test(navigator.userAgent) ? "&" : "?";
  document.getElementById("sms-fallback").href = `sms:${CONFIG.shopMobile}${sep}body=${encodeURIComponent(sms)}`;
  document.getElementById("success-name").textContent = data.name.split(" ")[0];
  document.getElementById("success-service").textContent = data.service;
  document.getElementById("form-success").hidden = false;
});

form.querySelectorAll("input, select, textarea").forEach((el) =>
  el.addEventListener("input", () => el.classList.remove("invalid"))
);
