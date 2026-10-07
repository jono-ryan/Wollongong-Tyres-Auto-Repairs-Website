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

// ---------------- Booking ----------------
// Services and hours live in /booking-config.json; free times come from
// /.netlify/functions/availability (Google Calendar), bookings go to /.netlify/functions/book.

const API = "/.netlify/functions";
const SHOP_ADDRESS = "505 Crown Street, Wollongong NSW 2500";

const $ = (id) => document.getElementById(id);
const state = { services: [], service: null, days: [], date: null, time: null, offer: "" };

const dayLabel = (ymd, opts) =>
  new Date(ymd + "T00:00:00Z").toLocaleDateString("en-AU", { timeZone: "UTC", ...opts });
const timeLabel = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
};
const durationLabel = (mins) => (mins < 60 ? `${mins} min` : `${+(mins / 60).toFixed(1)} hr${mins > 60 ? "s" : ""}`);

function go(step) {
  document.querySelectorAll(".booker__step").forEach((el) => (el.hidden = el.dataset.step !== String(step)));
  document.querySelectorAll("[data-progress]").forEach((el) => {
    el.classList.toggle("is-active", +el.dataset.progress === step);
    el.classList.toggle("is-done", +el.dataset.progress < step);
  });
  const top = $("booker").getBoundingClientRect().top;
  if (top < 0 || top > window.innerHeight * 0.6) $("booker").scrollIntoView({ behavior: "smooth", block: "start" });
}
document.querySelectorAll("[data-go]").forEach((btn) => btn.addEventListener("click", () => go(+btn.dataset.go)));

// Step 1: services
async function loadServices() {
  try {
    const res = await fetch("booking-config.json");
    state.services = (await res.json()).services;
  } catch {
    $("svc-grid").innerHTML = `<p class="booker__notice">Online booking is unavailable right now. Please call <a href="tel:0410448683">0410 448 683</a>.</p>`;
    return;
  }
  $("svc-grid").innerHTML = "";
  state.services.forEach((svc) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "svc";
    btn.innerHTML = `<strong></strong><span></span>`;
    btn.querySelector("strong").textContent = svc.name;
    btn.querySelector("span").textContent = `${svc.price} · ${durationLabel(svc.minutes)}`;
    btn.addEventListener("click", () => chooseService(svc.name));
    $("svc-grid").append(btn);
  });
}

function chooseService(name) {
  const svc = state.services.find((s) => s.name === name);
  if (!svc) return;
  state.service = svc;
  state.time = null;
  $("chosen-service").textContent = svc.name;
  go(2);
  loadAvailability();
}

// Step 2: days + times
async function loadAvailability(keepDate) {
  $("day-strip").innerHTML = "";
  $("slot-grid").innerHTML = `<div class="slot-skeleton"></div>`.repeat(8);
  $("slot-notice").hidden = true;
  try {
    const res = await fetch(`${API}/availability?service=${encodeURIComponent(state.service.name)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    state.days = data.days;
    $("demo-note").hidden = !data.demo;
  } catch {
    $("slot-grid").innerHTML = "";
    notice(`Couldn't load times. Please refresh, or call <a href="tel:0410448683">0410 448 683</a>.`);
    return;
  }
  const keep = keepDate && state.days.find((d) => d.date === keepDate && d.slots.length);
  state.date = keep ? keepDate : state.days.find((d) => d.slots.length)?.date || null;
  renderDays();
  renderSlots();
}

function notice(html) {
  $("slot-notice").innerHTML = html;
  $("slot-notice").hidden = false;
}

function renderDays() {
  $("day-strip").innerHTML = "";
  state.days.forEach((d) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day";
    btn.setAttribute("role", "option");
    btn.disabled = !d.slots.length;
    btn.setAttribute("aria-selected", d.date === state.date);
    btn.innerHTML = `<small>${dayLabel(d.date, { weekday: "short" })}</small><b>${dayLabel(d.date, { day: "numeric" })}</b><small>${dayLabel(d.date, { month: "short" })}</small>`;
    btn.addEventListener("click", () => {
      state.date = d.date;
      renderDays();
      renderSlots();
    });
    $("day-strip").append(btn);
  });
  const selected = $("day-strip").querySelector('[aria-selected="true"]');
  if (selected) $("day-strip").scrollLeft = selected.offsetLeft - $("day-strip").clientWidth / 2 + selected.clientWidth / 2;
}

function renderSlots() {
  $("slot-grid").innerHTML = "";
  const day = state.days.find((d) => d.date === state.date);
  if (!day) {
    notice(`No free times in the next two weeks. Please call <a href="tel:0410448683">0410 448 683</a>.`);
    return;
  }
  $("slot-notice").hidden = true;
  const groups = [
    ["Morning", day.slots.filter((t) => t < "12:00")],
    ["Afternoon", day.slots.filter((t) => t >= "12:00")],
  ];
  groups.forEach(([label, slots]) => {
    if (!slots.length) return;
    const heading = document.createElement("p");
    heading.className = "slot-group";
    heading.textContent = label;
    $("slot-grid").append(heading);
    slots.forEach((t) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot";
      btn.textContent = timeLabel(t);
      btn.addEventListener("click", () => chooseTime(t));
      $("slot-grid").append(btn);
    });
  });
}

function chooseTime(t) {
  state.time = t;
  $("sum-service").textContent = state.service.name;
  $("sum-when").textContent = `${dayLabel(state.date, { weekday: "long", day: "numeric", month: "long" })} · ${timeLabel(t)}`;
  $("sum-offer").hidden = !state.offer;
  $("sum-offer").textContent = state.offer ? `Offer ${state.offer} applied` : "";
  $("form-error").hidden = true;
  go(3);
  setTimeout(() => $("name").focus({ preventScroll: true }), 300);
}

// Step 3: details + submit
const form = $("details-form");
form.querySelectorAll("input, textarea").forEach((el) =>
  el.addEventListener("input", () => {
    el.classList.remove("invalid");
    if (!form.querySelector(".invalid")) $("form-error").hidden = true;
  })
);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  let ok = true;
  form.querySelectorAll("[required]").forEach((el) => {
    const bad = el.value.trim().length < 2 || (el.id === "phone" && !/^[0-9 +()-]{8,20}$/.test(el.value.trim()));
    el.classList.toggle("invalid", bad);
    if (bad) ok = false;
  });
  if (!ok) return showError("Please check the highlighted fields.");

  const btn = $("submit-btn");
  btn.disabled = true;
  btn.textContent = "Booking…";
  try {
    const res = await fetch(`${API}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...Object.fromEntries(new FormData(form)),
        service: state.service.name,
        date: state.date,
        time: state.time,
        offer: state.offer,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      go(2);
      await loadAvailability(state.date);
      notice("Sorry, someone just grabbed that time. Please pick another.");
      return;
    }
    if (!res.ok) throw new Error(data.error);
    showDone(data.booking);
  } catch (err) {
    showError(err.message || "Something went wrong. Please call 0410 448 683.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm booking";
  }
});

function showError(msg) {
  $("form-error").textContent = msg;
  $("form-error").hidden = false;
}

function showDone(booking) {
  $("done-service").textContent = booking.service;
  $("done-when").textContent = booking.label;
  const stamp = (iso) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  $("add-to-cal").href =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(`${booking.service} – Wollongong Tyres & Auto Repairs`)}` +
    `&dates=${stamp(booking.start)}/${stamp(booking.end)}` +
    `&location=${encodeURIComponent(SHOP_ADDRESS)}` +
    `&details=${encodeURIComponent("Questions? Call 0410 448 683")}`;
  go(4);
}

const servicesReady = loadServices();

// "Book this" / "Claim offer" buttons elsewhere on the page jump straight to step 2
document.querySelectorAll("[data-book]").forEach((btn) =>
  btn.addEventListener("click", async () => {
    if (btn.dataset.offer) state.offer = btn.dataset.offer;
    document.getElementById("book").scrollIntoView({ behavior: "smooth" });
    await servicesReady;
    chooseService(btn.dataset.book);
  })
);
