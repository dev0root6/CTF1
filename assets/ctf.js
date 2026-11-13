import { openVault } from "./vault.js";

const MISSIONS = [
  "Briefing",
  "Intercept",
  "Blank Page",
  "Magic Bytes",
  "Access Log",
  "The Insider",
  "Metadata",
  "Debrief",
];

const STORE_KEY = "codebreakers.v2";

const store = {
  read() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return { ...data, flags: data.flags || {}, pages: data.pages || {}, rewards: data.rewards || {} };
    } catch {
      return { flags: {}, pages: {}, rewards: {} };
    }
  },
  write(data) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable: progress just isn't remembered */
    }
  },
};

const body = document.body;
const missionNo = Number(body.dataset.mission || 0);
const pageName = location.pathname.split("/").pop() || "index.html";

function recordVisit() {
  if (!missionNo) return;
  const data = store.read();
  data.pages[missionNo] = pageName;
  if (body.dataset.flag) data.flags[missionNo] = body.dataset.flag;
  store.write(data);
}

function renderStepper() {
  const nav = document.getElementById("stepper");
  if (!nav) return;
  const data = store.read();
  const ol = document.createElement("ol");
  MISSIONS.forEach((title, i) => {
    const n = i + 1;
    const li = document.createElement("li");
    const solved = Boolean(data.flags[n]);
    const current = n === missionNo;
    li.className = [solved && "is-solved", current && "is-current"].filter(Boolean).join(" ");
    const label = `<span class="step-no">${String(n).padStart(2, "0")}</span><span class="step-title">${title}</span>`;
    const href = data.pages[n];
    if (href && !current) {
      li.innerHTML = `<a href="${href}">${label}</a>`;
    } else {
      li.innerHTML = `<span>${label}</span>`;
    }
    if (current) li.setAttribute("aria-current", "step");
    ol.appendChild(li);
  });
  nav.replaceChildren(ol);
  renderLocker();
}

function renderLocker() {
  const data = store.read();
  const count = Object.keys(data.flags).length;
  const btn = document.getElementById("locker-btn");
  if (btn) btn.querySelector("[data-count]").textContent = `${count}/${MISSIONS.length}`;
  document.querySelectorAll("[data-locker-list]").forEach((list) => {
    list.replaceChildren(
      ...MISSIONS.map((title, i) => {
        const n = i + 1;
        const li = document.createElement("li");
        const flag = data.flags[n];
        li.className = flag ? "is-solved" : "";
        li.innerHTML = `<span class="locker-title">${String(n).padStart(2, "0")} · ${title}</span>`;
        const code = document.createElement("code");
        code.textContent = flag || "locked";
        li.appendChild(code);
        return li;
      })
    );
  });
}

function setupLocker() {
  const btn = document.getElementById("locker-btn");
  const panel = document.getElementById("locker");
  if (!btn || !panel) return;
  btn.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      btn.focus();
    }
  });
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  const prev = button.textContent;
  button.textContent = "Copied";
  setTimeout(() => (button.textContent = prev), 1400);
}

function showReward(payload) {
  const reward = document.getElementById("reward");
  if (!reward) return;
  reward.querySelector("[data-flag]").textContent = payload.flag;
  const note = reward.querySelector("[data-note]");
  if (note) note.textContent = payload.note || "";
  const summary = reward.querySelector("[data-summary]");
  if (summary && Array.isArray(payload.summary)) {
    summary.replaceChildren(
      ...payload.summary.map(([label, text]) => {
        const p = document.createElement("p");
        const b = document.createElement("strong");
        b.textContent = `${label}: `;
        p.append(b, text);
        return p;
      })
    );
  }
  const next = reward.querySelector("[data-next]");
  if (next) {
    if (payload.next) next.href = payload.next;
    else next.remove();
  }
  reward.querySelector("[data-copy]")?.addEventListener("click", (e) => copyText(payload.flag, e.currentTarget));
  reward.hidden = false;

  const data = store.read();
  data.flags[missionNo] = payload.flag;
  data.rewards[missionNo] = payload;
  if (payload.next && missionNo < MISSIONS.length) {
    data.pages[missionNo + 1] = payload.next.split("#")[0];
  }
  if (missionNo === MISSIONS.length && !data.completedAt) {
    data.completedAt = new Date().toISOString();
  }
  store.write(data);
  renderStepper();
  if (missionNo === MISSIONS.length) renderCertificate();
}

// ---------------------------------------------------------------- player name

const NAME_MAX = 60;

function cleanName(value) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

function applyName() {
  const name = store.read().name || "";
  document.querySelectorAll("[data-agent-name]").forEach((el) => (el.textContent = name));
  document.querySelectorAll("[data-needs-name]").forEach((el) => (el.hidden = Boolean(name)));
  document.querySelectorAll("[data-has-name]").forEach((el) => (el.hidden = !name));
}

function setupNameForms() {
  document.querySelectorAll("form[data-name-form]").forEach((form) => {
    const input = form.querySelector("input");
    const feedback = form.querySelector(".feedback");
    input.value = store.read().name || "";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = cleanName(input.value);
      if (name.length < 2) {
        feedback.className = "feedback is-err";
        feedback.textContent = "Enter your full name.";
        return;
      }
      const data = store.read();
      data.name = name;
      store.write(data);
      feedback.textContent = "";
      applyName();
      renderCertificate();
    });
  });
  document.querySelectorAll("[data-change-name]").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyName();
      document.querySelectorAll("[data-needs-name]").forEach((el) => (el.hidden = false));
      document.querySelectorAll("[data-has-name]").forEach((el) => (el.hidden = true));
      document.querySelector("form[data-name-form] input")?.focus();
    });
  });
  applyName();
}

// ---------------------------------------------------------------- certificate

const RANKS = [
  [8, "Lead Forensic Analyst"],
  [6, "Forensic Analyst"],
  [0, "Field Agent"],
];

async function certificateId(name, flags, completedAt) {
  const text = [name, completedAt, ...Object.keys(flags).sort().map((k) => flags[k])].join("|");
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  const hex = [...hash.slice(0, 5)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `CB-${hex.slice(0, 5)}-${hex.slice(5)}`;
}

function fitText(ctx, text, maxWidth, size, weight, family) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    s -= 2;
  } while (ctx.measureText(text).width > maxWidth && s > 24);
}

async function renderCertificate() {
  const box = document.getElementById("certificate");
  if (!box) return;
  const data = store.read();
  if (!data.rewards[MISSIONS.length]) return;
  box.hidden = false;
  applyName();
  const name = data.name;
  if (!name) return;

  const canvas = box.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const SANS = '"IBM Plex Sans", system-ui, sans-serif';
  const MONO = '"IBM Plex Mono", ui-monospace, monospace';
  try {
    await Promise.all([
      document.fonts.load(`600 72px "IBM Plex Sans"`),
      document.fonts.load(`400 26px "IBM Plex Sans"`),
      document.fonts.load(`500 22px "IBM Plex Mono"`),
    ]);
  } catch {
    /* fall back to system fonts */
  }

  const solved = MISSIONS.filter((_, i) => data.flags[i + 1]).length;
  const rank = RANKS.find(([min]) => solved >= min)[1];
  const completed = new Date(data.completedAt || Date.now());
  const dateText = completed.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const id = await certificateId(name, data.flags, data.completedAt || "");

  const ink = "#161c26";
  const muted = "#5b6474";
  const amber = "#e09a1a";
  const cx = W / 2;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fbf8f1";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = amber;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(58, 58, W - 116, H - 116);

  // magnifier mark
  ctx.save();
  ctx.translate(cx - 28, 118);
  ctx.strokeStyle = amber;
  ctx.lineCap = "round";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(24, 24, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(36, 36);
  ctx.lineTo(52, 52);
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = muted;
  ctx.font = `500 22px ${MONO}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "6px";
  ctx.fillText("THE CODEBREAKERS · OPERATION GLASS KEY", cx, 228);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

  ctx.fillStyle = ink;
  ctx.font = `600 68px ${SANS}`;
  ctx.fillText("Certificate of Completion", cx, 320);

  ctx.fillStyle = muted;
  ctx.font = `400 26px ${SANS}`;
  ctx.fillText("This certifies that", cx, 396);

  ctx.fillStyle = ink;
  fitText(ctx, name, W - 360, 76, 600, SANS);
  ctx.fillText(name, cx, 492);
  ctx.strokeStyle = amber;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 420, 522);
  ctx.lineTo(cx + 420, 522);
  ctx.stroke();

  ctx.fillStyle = muted;
  ctx.font = `400 26px ${SANS}`;
  ctx.fillText("investigated Operation Glass Key, a digital forensics capture-the-flag, and finished", cx, 584);

  ctx.fillStyle = ink;
  ctx.font = `600 46px ${SANS}`;
  ctx.fillText(`${solved} of ${MISSIONS.length} levels`, cx, 656);

  // level pips
  const pip = 34;
  const gap = 14;
  const startX = cx - (MISSIONS.length * pip + (MISSIONS.length - 1) * gap) / 2;
  MISSIONS.forEach((_, i) => {
    const x = startX + i * (pip + gap);
    const done = Boolean(data.flags[i + 1]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = done ? amber : "#c9cdd4";
    ctx.fillStyle = done ? amber : "transparent";
    ctx.beginPath();
    ctx.roundRect(x, 690, pip, pip, 7);
    if (done) ctx.fill();
    ctx.stroke();
    ctx.fillStyle = done ? "#fff" : "#a0a6b0";
    ctx.font = `500 15px ${MONO}`;
    ctx.fillText(String(i + 1), x + pip / 2, 712);
  });

  ctx.fillStyle = amber;
  ctx.font = `600 28px ${SANS}`;
  ctx.fillText(`Rank: ${rank}`, cx, 790);

  ctx.fillStyle = muted;
  ctx.font = `400 21px ${SANS}`;
  ctx.fillText(
    "Ciphers · Hidden document text · File signatures · Log analysis · Timeline correlation · EXIF metadata",
    cx,
    846
  );

  // footer: date and ID
  ctx.strokeStyle = "#d8d3c6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(140, 930);
  ctx.lineTo(W - 140, 930);
  ctx.stroke();

  ctx.font = `500 16px ${MONO}`;
  ctx.fillStyle = muted;
  ctx.textAlign = "left";
  ctx.fillText("COMPLETED", 140, 968);
  ctx.textAlign = "right";
  ctx.fillText("CERTIFICATE ID", W - 140, 968);
  ctx.fillStyle = ink;
  ctx.font = `600 24px ${SANS}`;
  ctx.textAlign = "left";
  ctx.fillText(dateText, 140, 1004);
  ctx.font = `600 24px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText(id, W - 140, 1004);

  const link = box.querySelector("[data-cert-download]");
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agent";
  link.download = `codebreakers-certificate-${slug}.png`;
  canvas.toBlob((blob) => {
    if (!blob) return;
    if (link.dataset.url) URL.revokeObjectURL(link.dataset.url);
    link.dataset.url = URL.createObjectURL(blob);
    link.href = link.dataset.url;
  }, "image/png");
}

function lockForm(form, fields) {
  fields.forEach((f) => (f.disabled = true));
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "Solved ✓";
  form.classList.add("is-solved");
}

function readVault() {
  const el = document.getElementById("vault");
  if (!el) return null;
  try {
    return JSON.parse(el.textContent);
  } catch {
    return null;
  }
}

function setupAnswerForm() {
  const form = document.getElementById("answer-form");
  const vault = readVault();
  if (!form || !vault) return;
  const fields = [...form.querySelectorAll(".answer-field")];
  const feedback = document.getElementById("feedback");
  const submit = form.querySelector("button[type=submit]");
  let misses = 0;

  const saved = store.read().rewards[missionNo];
  if (saved) {
    lockForm(form, fields);
    feedback.textContent = "Solved earlier. Your reward is below.";
    feedback.className = "feedback is-ok";
    showReward(saved);
  }

  async function attempt(values, { silent = false } = {}) {
    const payload = await openVault(vault, values);
    if (payload) {
      lockForm(form, fields);
      feedback.textContent = "Verified. Evidence accepted.";
      feedback.className = "feedback is-ok";
      showReward(payload);
      document.getElementById("reward")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return true;
    }
    if (!silent) {
      misses += 1;
      feedback.className = "feedback is-err";
      feedback.textContent =
        misses >= 3
          ? "Still not it. Open the hints in the case file panel."
          : "Not quite. Re-check the evidence and try again.";
      form.classList.remove("shake");
      void form.offsetWidth;
      form.classList.add("shake");
    }
    return false;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const values = fields.map((f) => f.value);
    if (values.some((v) => !v.trim())) {
      feedback.className = "feedback is-err";
      feedback.textContent = "Fill in every field first.";
      return;
    }
    submit.disabled = true;
    submit.dataset.label ??= submit.textContent;
    submit.textContent = "Verifying…";
    feedback.className = "feedback";
    feedback.textContent = "";
    const ok = await attempt(values);
    if (!ok) {
      submit.disabled = false;
      submit.textContent = submit.dataset.label;
    }
  });

  // The final page can be unlocked by a key carried in the link from mission 7.
  if (body.hasAttribute("data-final") && !saved && location.hash.length > 1) {
    const key = decodeURIComponent(location.hash.slice(1));
    attempt([key], { silent: true }).then((ok) => {
      if (ok) history.replaceState(null, "", location.pathname);
    });
  }
}

function setupCopyButtons() {
  document.querySelectorAll("[data-copy-text]").forEach((btn) => {
    btn.addEventListener("click", () => copyText(btn.dataset.copyText, btn));
  });
}

recordVisit();
setupNameForms();
setupLocker();
renderStepper();
setupAnswerForm();
setupCopyButtons();
