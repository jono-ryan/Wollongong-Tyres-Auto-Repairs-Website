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
const state = { services: [], service: null, days: [], today: null, month: null, date: null, time: null, offer: "" };

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

// Step 2: month calendar + times
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (ymd) => ymd.slice(0, 7);
const shiftMonth = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

async function loadAvailability(keepDate) {
  $("cal-grid").innerHTML = `<div class="cal__loading">Loading free times…</div>`;
  $("slot-wrap").hidden = true;
  $("slot-notice").hidden = true;
  try {
    const res = await fetch(`${API}/availability?service=${encodeURIComponent(state.service.name)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    state.days = data.days;
    state.today = data.today;
    $("demo-note").hidden = !data.demo;
  } catch {
    $("cal-grid").innerHTML = "";
    notice(`Couldn't load times. Please refresh, or call <a href="tel:0410448683">0410 448 683</a>.`);
    return;
  }
  const keep = keepDate && state.days.find((d) => d.date === keepDate && d.slots.length);
  state.date = keep ? keepDate : null;
  const firstFree = state.days.find((d) => d.slots.length);
  state.month = monthOf(state.date || firstFree?.date || state.days[0].date);
  if (!firstFree) notice(`We're fully booked for the next few weeks. Please call <a href="tel:0410448683">0410 448 683</a>.`);
  renderCalendar();
  renderSlots();
}

function notice(html) {
  $("slot-notice").innerHTML = html;
  $("slot-notice").hidden = false;
}

function renderCalendar() {
  const byDate = Object.fromEntries(state.days.map((d) => [d.date, d]));
  const firstMonth = monthOf(state.days[0].date);
  const lastMonth = monthOf(state.days[state.days.length - 1].date);
  const [y, m] = state.month.split("-").map(Number);

  $("cal-month").textContent = `${MONTHS[m - 1]} ${y}`;
  $("cal-prev").disabled = state.month <= firstMonth;
  $("cal-next").disabled = state.month >= lastMonth;

  const grid = $("cal-grid");
  grid.innerHTML = "";
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((d) => {
    const el = document.createElement("div");
    el.className = "cal__dow";
    el.textContent = d;
    grid.append(el);
  });

  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday-first
  for (let i = 0; i < lead; i++) grid.append(document.createElement("div"));

  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${state.month}-${String(d).padStart(2, "0")}`;
    const info = byDate[ymd];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cal__day";
    btn.textContent = d;
    const free = info && info.slots.length > 0;
    btn.disabled = !free;
    if (ymd === state.today) {
      btn.classList.add("is-today");
      btn.title = "Same-day bookings: please call";
    } else if (info && !free && new Date(ymd + "T00:00:00Z").getUTCDay() !== 0) {
      btn.classList.add("is-full");
      btn.title = "Fully booked";
    }
    if (free) btn.classList.add("is-free");
    if (ymd === state.date) btn.classList.add("is-selected");
    btn.setAttribute("aria-label", `${dayLabel(ymd, { weekday: "long", day: "numeric", month: "long" })}${free ? "" : ", unavailable"}`);
    btn.addEventListener("click", () => {
      state.date = ymd;
      renderCalendar();
      renderSlots();
      $("slot-wrap").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    grid.append(btn);
  }
}

$("cal-prev").addEventListener("click", () => {
  state.month = shiftMonth(state.month, -1);
  renderCalendar();
});
$("cal-next").addEventListener("click", () => {
  state.month = shiftMonth(state.month, 1);
  renderCalendar();
});

function renderSlots() {
  const day = state.days.find((d) => d.date === state.date);
  $("slot-wrap").hidden = !day;
  if (!day) return;
  $("slot-heading").textContent = `Free times on ${dayLabel(day.date, { weekday: "long", day: "numeric", month: "long" })}`;
  $("slot-grid").innerHTML = "";
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
