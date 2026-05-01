// LinkedIn Job Color Tracker

const COLORS = {
  applied:  { border: "#ef4444", bg: "rgba(239,68,68,0.08)" },
  fresh:    { border: "#22c55e", bg: "rgba(34,197,94,0.06)" },
  external: { border: "#eab308", bg: "rgba(234,179,8,0.06)" },
};

// --------------------------------------------------
// Extension Context Safety
// --------------------------------------------------

function isExtensionAlive() {
  try { return !!(chrome && chrome.runtime && chrome.runtime.id); }
  catch { return false; }
}

function safeStorageGet(keys, callback) {
  try {
    if (!isExtensionAlive() || !chrome?.storage?.local) return;
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        console.warn("Storage GET error:", chrome.runtime.lastError.message);
        return;
      }
      callback(result || {});
    });
  } catch (e) { console.warn("safeStorageGet failed:", e); }
}

function safeStorageSet(data, callback = null) {
  try {
    if (!isExtensionAlive() || !chrome?.storage?.local) return;
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        console.warn("Storage SET error:", chrome.runtime.lastError.message);
        return;
      }
      if (callback) callback();
    });
  } catch (e) { console.warn("safeStorageSet failed:", e); }
}

function safeStorageRemove(key, callback = null) {
  try {
    if (!isExtensionAlive() || !chrome?.storage?.local) return;
    chrome.storage.local.remove(key, () => {
      if (chrome.runtime.lastError) {
        console.warn("Storage REMOVE error:", chrome.runtime.lastError.message);
        return;
      }
      if (callback) callback();
    });
  } catch (e) { console.warn("safeStorageRemove failed:", e); }
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function colorCard(card, status) {
  const color = COLORS[status] || COLORS.fresh;
  card.style.setProperty("border-left", `4px solid ${color.border}`, "important");
  card.style.setProperty("background-color", color.bg, "important");
  card.style.setProperty("border-radius", "4px", "important");
  card.setAttribute("data-jt-status", status);
}

// Job ID from the page URL — used for the currently open/viewed job
function getUrlJobId() {
  return new URLSearchParams(window.location.search).get("currentJobId");
}

// Job ID extracted from the card element itself — used when iterating the list
// This avoids the bug where all cards share the single URL job ID
function getCardJobId(card) {
  const key = card.getAttribute("componentkey");
  if (key && key.startsWith("job-card-component-ref-")) {
    return key.replace("job-card-component-ref-", "");
  }
  return null;
}

// Extract displayable metadata from a job card element
function extractCardMeta(card) {
  // Title: job view link (detail panel) → obfuscated title paragraph (list cards)
  const titleEl =
    card.querySelector('a[href*="/jobs/view/"]') ||
    card.querySelector('p[class*="dbade2f9"] span:not([aria-hidden])') ||
    card.querySelector('p[class*="dbade2f9"]');

  // Company: structured aria-label (most stable) → obfuscated class fallback
  const companyWrapper = card.querySelector('[aria-label^="Company,"]');
  let company = null;
  if (companyWrapper) {
    company = companyWrapper.getAttribute("aria-label")
      .replace(/^Company,\s*/i, "").replace(/\.$/, "").trim() || null;
  } else {
    const companyEl = card.querySelector('p[class*="cb8df2cc"]');
    company = (companyEl?.innerText || "").trim() || null;
  }

  return {
    title:   (titleEl?.innerText || "").trim().replace(/^Selected,\s*/i, "") || null,
    company: company,
  };
}

// --------------------------------------------------
// Status Detection
// --------------------------------------------------

function getCardStatus(card) {
  const text = (card.innerText || "").trim();

  if (/\bApplied\b/i.test(text)) return "applied";

  const hasEasyApply =
    !!card.querySelector('[id="linkedin-bug-small"]') ||
    !!card.querySelector('[aria-label*="Easy Apply"]');

  // Match only explicit Apply buttons — not dismiss buttons, nav links, etc.
  const hasApplyButton = !!card.querySelector(
    'button[aria-label*="Apply"], a[aria-label*="Apply"], button.jobs-apply-button'
  );

  if (!hasEasyApply && hasApplyButton) return "external";
  return "fresh";
}

// --------------------------------------------------
// Undo Button
// --------------------------------------------------

function createUndoBtn() {
  const btn = document.createElement("button");
  btn.textContent = "↩ Undo";
  btn.setAttribute("data-jt-undo", "true");

  Object.assign(btn.style, {
    fontSize: "12px",
    fontWeight: "600",
    color: "#0a66c2",
    background: "#e8f0fe",
    border: "1.5px solid #0a66c2",
    borderRadius: "16px",
    padding: "3px 12px",
    cursor: "pointer",
    marginLeft: "10px",
    verticalAlign: "middle",
    display: "inline-block",
    lineHeight: "1.5",
    transition: "background 0.15s, color 0.15s",
    userSelect: "none",
  });

  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#0a66c2";
    btn.style.color = "#fff";
  });
  btn.addEventListener("mouseleave", () => {
    if (btn.getAttribute("data-jt-done")) return;
    btn.style.background = "#e8f0fe";
    btn.style.color = "#0a66c2";
  });

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const jobId = getUrlJobId();
    if (!jobId) return;

    btn.textContent = "Removing…";
    btn.style.opacity = "0.6";
    btn.style.cursor = "default";
    btn.style.pointerEvents = "none";

    safeStorageRemove(`jt_${jobId}`, () => {
      btn.setAttribute("data-jt-done", "true");
      btn.textContent = "✓ Removed";
      btn.style.color = "#166534";
      btn.style.borderColor = "#22c55e";
      btn.style.background = "rgba(34,197,94,0.12)";
      btn.style.opacity = "1";
      setTimeout(processCards, 300);
      setTimeout(() => btn.remove(), 2000);
    });
  });

  return btn;
}

function addUndoButton() {
  document.querySelectorAll("h2").forEach((h2) => {
    if (h2.textContent.trim() !== "Application status") return;

    const section = h2.closest("div.f09a21f5");
    if (!section) return;
    if (section.querySelector("[data-jt-undo]")) return;

    section.querySelectorAll("p").forEach((p) => {
      if (p.textContent.trim() !== "Application submitted") return;

      // Place undo button inline, right beside the "Application submitted" text
      p.style.display = "inline-flex";
      p.style.alignItems = "center";
      p.style.flexWrap = "wrap";
      p.style.gap = "4px";
      p.appendChild(createUndoBtn());
    });
  });
}

// --------------------------------------------------
// Main Processing — single batched storage read
// --------------------------------------------------

function processCards() {
  if (!isExtensionAlive()) return;

  const cards = document.querySelectorAll(
    '[componentkey^="job-card-component-ref-"]'
  );

  if (!cards.length) {
    addUndoButton();
    return;
  }

  // Map storageKey → card, using the card's OWN key (not the URL job ID)
  // so that each card in the list is handled independently
  const cardMap = new Map();
  cards.forEach((card) => {
    const jobId = getCardJobId(card);
    if (jobId) cardMap.set(`jt_${jobId}`, card);
  });

  // One batched read instead of N individual reads
  safeStorageGet(Array.from(cardMap.keys()), (result) => {
    cardMap.forEach((card, storageKey) => {
      const stored = result[storageKey];

      if (stored) {
        colorCard(card, stored);
        return;
      }

      const domStatus = getCardStatus(card);
      if (domStatus === "applied") {
        safeStorageSet({ [storageKey]: "applied" });
        const meta = extractCardMeta(card);
        const metaKey = "jt_meta_" + storageKey.slice(3);
        safeStorageSet({ [metaKey]: { ...meta, date: new Date().toISOString().slice(0, 10), mode: "quick-apply" } });
        colorCard(card, "applied");
      } else if (domStatus === "external") {
        colorCard(card, "external");
      } else {
        colorCard(card, "fresh");
      }
    });
  });

  addUndoButton();
}

// --------------------------------------------------
// Apply Button Click Detection
// --------------------------------------------------

document.addEventListener("click", (e) => {
  const applyBtn = e.target.closest(`
    button[aria-label*="Apply"],
    a[aria-label*="Apply"],
    button.jobs-apply-button
  `);
  if (!applyBtn) return;

  const jobId = getUrlJobId();
  if (!jobId) return;

  const text = (applyBtn.innerText || "").toLowerCase();
  const isEasyApply =
    text.includes("easy apply") ||
    !!applyBtn.querySelector('[id="linkedin-bug-small"]');

  // External apply — mark yellow immediately
  if (!isEasyApply) {
    safeStorageSet({ [`jt_${jobId}`]: "external" });
    const activeCard = document.querySelector(
      `[componentkey="job-card-component-ref-${jobId}"]`
    );
    const meta = activeCard ? extractCardMeta(activeCard) : {};
    safeStorageSet({ [`jt_meta_${jobId}`]: { ...meta, date: new Date().toISOString().slice(0, 10), mode: "external" } });
    setTimeout(processCards, 500);
  }
  // Easy Apply — wait for LinkedIn's "Applied" DOM update or toast
}, true);

// --------------------------------------------------
// Toast Observer
// --------------------------------------------------

const toastObserver = new MutationObserver(() => {
  const toast = document.querySelector('[data-testid="toasts-title"]');
  if (!toast) return;
  const text = (toast.innerText || "").toLowerCase();
  if (
    text.includes("application") ||
    text.includes("applied") ||
    text.includes("notification")
  ) {
    setTimeout(processCards, 1000);
  }
});

// --------------------------------------------------
// SPA DOM Observer — debounced
// --------------------------------------------------

const pageObserver = new MutationObserver(() => {
  clearTimeout(window._jtProcessTimer);
  window._jtProcessTimer = setTimeout(processCards, 500);
});

// --------------------------------------------------
// Start
// --------------------------------------------------

if (document.body) {
  toastObserver.observe(document.body, { childList: true, subtree: true });
  pageObserver.observe(document.body, { childList: true, subtree: true });
}

setTimeout(processCards, 1000);
