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
const state = { step: 1, services: [], service: null, days: [], today: null, month: null, date: null, time: null, offer: "" };

const dayLabel = (ymd, opts) =>
  new Date(ymd + "T00:00:00Z").toLocaleDateString("en-AU", { timeZone: "UTC", ...opts });
const timeLabel = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
};
const durationLabel = (mins) => (mins < 60 ? `${mins} min` : `${+(mins / 60).toFixed(1)} hr${mins > 60 ? "s" : ""}`);

function go(step) {
  if (state.step === step) return;
  state.step = step;
  document.querySelectorAll(".booker__step").forEach((el) => (el.hidden = el.dataset.step !== String(step)));
  document.querySelectorAll("[data-progress]").forEach((el) => {
    el.classList.toggle("is-active", +el.dataset.progress === step);
    el.classList.toggle("is-done", +el.dataset.progress < step);
  });
  const top = $("booker").getBoundingClientRect().top;
  if (top < 0 || top > window.innerHeight * 0.6) $("booker").scrollIntoView({ behavior: "smooth", block: "start" });
}
document.querySelectorAll("[data-go]").forEach((btn) => btn.addEventListener("click", () => go(+btn.dataset.go)));

// Step 1: service picker + calendar
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (ymd) => ymd.slice(0, 7);
const shiftMonth = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const addDaysYmd = (ymd, n) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const weekday = (ymd) => new Date(ymd + "T00:00:00Z").getUTCDay();

async function loadServices() {
  try {
    const res = await fetch("booking-config.json");
    state.services = (await res.json()).services;
  } catch {
    $("cal").hidden = true;
    notice(`Online booking is unavailable right now. Please call <a href="tel:0410448683">0410 448 683</a>.`);
    return;
  }
  $("svc-select").innerHTML = "";
  state.services.forEach((svc) =>
    $("svc-select").add(new Option(`${svc.name} · ${svc.price} · ${durationLabel(svc.minutes)}`, svc.name))
  );
  chooseService(state.services[0].name);
}

$("svc-select").addEventListener("change", (e) => chooseService(e.target.value));

function chooseService(name) {
  const svc = state.services.find((s) => s.name === name);
  if (!svc) return;
  state.service = svc;
  state.time = null;
  $("svc-select").value = svc.name;
  go(1);
  loadAvailability(state.date);
}

async function loadAvailability(keepDate) {
  showMonth();
  $("cal-grid").innerHTML = `<div class="cal__loading">Loading free times…</div>`;
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
  const firstFree = state.days.find((d) => d.slots.length);
  if (!state.month) state.month = monthOf(firstFree?.date || state.today);
  if (!firstFree) notice(`We're fully booked for the next few weeks. Please call <a href="tel:0410448683">0410 448 683</a>.`);
  renderCalendar();
  // Coming back after a clash, or after switching service: reopen that day if it still has times
  const keep = keepDate && state.days.find((d) => d.date === keepDate && d.slots.length);
  if (keep) showDay(keep.date);
}

function notice(html) {
  $("slot-notice").innerHTML = html;
  $("slot-notice").hidden = false;
}

function renderCalendar() {
  const byDate = Object.fromEntries(state.days.map((d) => [d.date, d]));
  const [y, m] = state.month.split("-").map(Number);
  const firstMonth = monthOf(state.today);
  const lastMonth = monthOf(state.days[state.days.length - 1].date);

  $("cal-month").innerHTML = `<b>${MONTHS[m - 1]}</b> ${y}`;
  $("cal-prev").disabled = state.month <= firstMonth;
  $("cal-next").disabled = state.month >= lastMonth;
  $("cal-today").disabled = state.month === firstMonth;

  const grid = $("cal-grid");
  grid.innerHTML = "";
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((d, i) => {
    const el = document.createElement("div");
    el.className = "cal__dow" + (i >= 5 ? " is-weekend" : "");
    el.textContent = d;
    grid.append(el);
  });

  // Whole weeks, Monday first, including greyed days from the months either side
  const first = `${state.month}-01`;
  const start = addDaysYmd(first, -((weekday(first) + 6) % 7));
  const lastOfMonth = `${state.month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const end = addDaysYmd(lastOfMonth, (7 - weekday(lastOfMonth)) % 7);

  for (let ymd = start; ymd <= end; ymd = addDaysYmd(ymd, 1)) {
    const info = byDate[ymd];
    const free = info?.slots.length || 0;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cal__cell";
    if (monthOf(ymd) !== state.month) cell.classList.add("is-other");
    if (weekday(ymd) === 0 || weekday(ymd) === 6) cell.classList.add("is-weekend");
    if (ymd === state.today) cell.classList.add("is-today");

    const day = +ymd.slice(8);
    const num = document.createElement("span");
    num.className = "cal__num";
    num.textContent = day;
    if (day === 1) {
      const mon = document.createElement("span");
      mon.className = "cal__mon";
      mon.textContent = ` ${MONTHS[+ymd.slice(5, 7) - 1].slice(0, 3)}`;
      num.append(mon);
    }
    cell.append(num);

    let tag = "";
    if (free) tag = `${free} time${free > 1 ? "s" : ""}`;
    else if (ymd === state.today) tag = "Call us";
    else if (weekday(ymd) === 0) tag = "Closed";
    else if (info) tag = "Full";
    if (tag) {
      const t = document.createElement("span");
      t.className = "cal__tag" + (free ? " is-free" : "");
      t.textContent = tag;
      cell.append(t);
    }

    cell.disabled = !free;
    if (free) cell.classList.add("is-free");
    cell.setAttribute("aria-label", `${dayLabel(ymd, { weekday: "long", day: "numeric", month: "long" })}: ${tag || "unavailable"}`);
    cell.addEventListener("click", () => showDay(ymd));
    grid.append(cell);
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
$("cal-today").addEventListener("click", () => {
  state.month = monthOf(state.today);
  renderCalendar();
});
$("day-back").addEventListener("click", showMonth);

function showMonth() {
  $("month-view").hidden = false;
  $("day-view").hidden = true;
}

function showDay(ymd) {
  const day = state.days.find((d) => d.date === ymd);
  if (!day) return;
  state.date = ymd;
  state.month = monthOf(ymd);
  $("day-back-month").textContent = MONTHS[+ymd.slice(5, 7) - 1];
  $("day-title").innerHTML = `<b>${dayLabel(ymd, { weekday: "long" })}</b> ${dayLabel(ymd, { day: "numeric", month: "long" })}`;
  $("day-sub").textContent = `${day.slots.length} free time${day.slots.length > 1 ? "s" : ""} for ${state.service.name} (${durationLabel(state.service.minutes)})`;
  $("slot-grid").innerHTML = "";
  [
    ["Morning", day.slots.filter((t) => t < "12:00")],
    ["Afternoon", day.slots.filter((t) => t >= "12:00")],
  ].forEach(([label, slots]) => {
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
  $("month-view").hidden = true;
  $("day-view").hidden = false;
}

function chooseTime(t) {
  state.time = t;
  $("sum-service").textContent = state.service.name;
  $("sum-when").textContent = `${dayLabel(state.date, { weekday: "long", day: "numeric", month: "long" })} · ${timeLabel(t)}`;
  $("sum-offer").hidden = !state.offer;
  $("sum-offer").textContent = state.offer ? `Offer ${state.offer} applied` : "";
  $("form-error").hidden = true;
  go(2);
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
      go(1);
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
  go(3);
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
