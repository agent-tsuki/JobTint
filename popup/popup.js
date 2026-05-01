// Popup dashboard for LinkedIn Job Tracker

const tbody    = document.getElementById("jobs-body");
const badge    = document.getElementById("count-badge");
const emptyEl  = document.getElementById("empty-state");
const tableWrap = document.getElementById("table-wrap");
const exportBtn = document.getElementById("export-btn");

// ---- Load all tracked jobs from storage ----

chrome.storage.local.get(null, (all) => {
  // Collect entries: jt_{id} = status (skip jt_meta_ keys and internal keys)
  const jobs = [];

  Object.keys(all).forEach((key) => {
    if (!/^jt_(?!meta_)/.test(key)) return;

    const jobId  = key.replace("jt_", "");
    const status = all[key];
    const meta   = all[`jt_meta_${jobId}`] || {};

    jobs.push({
      jobId,
      status,
      title:   (meta.title || "").replace(/^Selected,\s*/i, "") || "—",
      company: meta.company || "—",
      date:    meta.date    || "",
      notes:   meta.notes   || "",
      mode:    meta.mode    || "",
    });
  });

  // Sort newest first
  jobs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  updateBadge(jobs.length);

  if (!jobs.length) {
    emptyEl.classList.remove("hidden");
    tableWrap.classList.add("hidden");
    return;
  }

  emptyEl.classList.add("hidden");
  tableWrap.classList.remove("hidden");
  jobs.forEach(addRow);
});

// ---- Render one row ----

function addRow(job) {
  const tr = document.createElement("tr");
  tr.dataset.jobId = job.jobId;

  const dateDisplay = job.date ? formatDate(job.date) : "—";
  const modeLabel = job.mode === "external" ? "External" : job.mode === "quick-apply" ? "Quick Apply" : "—";
  const modeCls   = job.mode === "external" ? "mode-external" : job.mode === "quick-apply" ? "mode-quick-apply" : "mode-none";
  const statusCell = job.status === "external"
    ? `<td class="status-cell" data-status="external"><select class="status-select"><option value="external">⏳ Pending</option><option value="applied">✓ Applied</option></select></td>`
    : `<td class="status-cell" data-status="applied"><span class="status-icon" title="Applied">✓</span></td>`;

  tr.innerHTML = `
    <td class="company-cell">${escHtml(job.company)}</td>
    <td class="title-cell" title="${escHtml(job.title)}">${escHtml(job.title)}</td>
    <td class="date-cell">${dateDisplay}</td>
    ${statusCell}
    <td><span class="mode-badge ${modeCls}">${modeLabel}</span></td>
    <td class="notes-cell"><span class="notes-text">${escHtml(job.notes)}</span></td>
    <td><button class="undo-btn" title="Remove tracking">×</button></td>
  `;

  // Inline notes editing
  const notesCell = tr.querySelector(".notes-cell");
  const notesText = tr.querySelector(".notes-text");

  notesCell.addEventListener("click", () => {
    if (notesCell.querySelector("input")) return;

    const input = document.createElement("input");
    input.type  = "text";
    input.value = job.notes;
    notesCell.replaceChild(input, notesText);
    input.focus();

    const save = () => {
      const val = input.value.trim();
      job.notes = val;
      notesText.textContent = val;
      notesCell.replaceChild(notesText, input);

      const metaKey = `jt_meta_${job.jobId}`;
      chrome.storage.local.get([metaKey], (r) => {
        const existing = r[metaKey] || {};
        chrome.storage.local.set({ [metaKey]: { ...existing, notes: val } });
      });
    };

    input.addEventListener("blur",  save);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
  });

  // Status dropdown: external → applied
  const statusSelect = tr.querySelector(".status-select");
  if (statusSelect) {
    statusSelect.addEventListener("change", () => {
      if (statusSelect.value !== "applied") return;
      const today = new Date().toISOString().slice(0, 10);

      chrome.storage.local.set({ [`jt_${job.jobId}`]: "applied" }, () => {
        const metaKey = `jt_meta_${job.jobId}`;
        chrome.storage.local.get([metaKey], (r) => {
          const existing = r[metaKey] || {};
          chrome.storage.local.set({ [metaKey]: { ...existing, date: today } });
        });
      });

      job.status = "applied";
      job.date = today;

      const statusTd = statusSelect.closest("td");
      statusTd.dataset.status = "applied";
      statusTd.innerHTML = `<span class="status-icon" title="Applied">✓</span>`;

      const dateCell = tr.querySelector(".date-cell");
      if (dateCell) dateCell.textContent = formatDate(today);
    });
  }

  // Undo / delete row
  tr.querySelector(".undo-btn").addEventListener("click", () => {
    chrome.storage.local.remove([`jt_${job.jobId}`, `jt_meta_${job.jobId}`], () => {
      tr.remove();
      const remaining = tbody.querySelectorAll("tr").length;
      updateBadge(remaining);
      if (!remaining) {
        emptyEl.classList.remove("hidden");
        tableWrap.classList.add("hidden");
      }
    });
  });

  tbody.appendChild(tr);
}

// ---- Export CSV ----

exportBtn.addEventListener("click", () => {
  const rows = [["Company", "Role", "Date Applied", "Status", "Mode", "Notes"]];

  tbody.querySelectorAll("tr").forEach((tr) => {
    const cells   = tr.querySelectorAll("td");
    const company = cells[0]?.textContent?.trim() || "";
    const title   = cells[1]?.textContent?.trim() || "";
    const date    = cells[2]?.textContent?.trim() || "";
    const status  = cells[3]?.dataset?.status || cells[3]?.textContent?.trim() || "";
    const mode    = cells[4]?.textContent?.trim() || "";
    const notes   = tr.querySelector(".notes-text")?.textContent?.trim() || "";

    rows.push([company, title, date, status, mode, notes]);
  });

  downloadCSV(rows);
});

// ---- Helpers ----

function updateBadge(n) {
  badge.textContent = n;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadCSV(rows) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `linkedin-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
