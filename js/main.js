// ---- Settings: fill these in before going live (see README) ----
const CONFIG = {
  // Formspree form URL, e.g. "https://formspree.io/f/abcdwxyz".
  // Leave empty for the demo: the form shows a success message without sending anything.
  formEndpoint: "",
  shopMobile: "0410448683",
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

// Date picker: earliest is today, and Sundays are rejected (closed)
const dateInput = document.getElementById("date");
const toISO = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
dateInput.min = toISO(new Date());
dateInput.addEventListener("change", () => {
  const day = new Date(dateInput.value + "T00:00").getDay();
  if (day === 0) {
    dateInput.setCustomValidity("We're closed Sundays — please pick Mon–Sat.");
    dateInput.reportValidity();
  } else {
    dateInput.setCustomValidity("");
  }
});

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
  document.getElementById("form-error").hidden = ok;
  if (!ok) return;

  const data = Object.fromEntries(new FormData(form));

  if (CONFIG.formEndpoint) {
    try {
      const res = await fetch(CONFIG.formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...data, _subject: `New booking: ${data.service} – ${data.name}` }),
      });
      if (!res.ok) throw new Error(res.statusText);
    } catch (err) {
      document.getElementById("form-error").textContent =
        "Sorry, something went wrong. Please call or text 0410 448 683.";
      document.getElementById("form-error").hidden = false;
      return;
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
