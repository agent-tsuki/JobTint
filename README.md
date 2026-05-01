# JobTint

Automatically color-codes LinkedIn job listings by application status — at a glance, no clicking required.

![Version](https://img.shields.io/badge/version-1.13-blue)
![License](https://img.shields.io/badge/license-GPLv3-green)
![Platform](https://img.shields.io/badge/platform-Chrome-yellow)
![Manifest](https://img.shields.io/badge/manifest-v3-orange)

---

## What It Does

JobTint injects a colored border onto every LinkedIn job card as you browse, so you always know where you stand with each listing.

| Border Color | Meaning |
|---|---|
| 🟢 Green `#22c55e` | Fresh job with Easy Apply available |
| 🔴 Red `#ef4444` | Already applied |
| 🟡 Yellow `#eab308` | External application required |

Colors are applied live as you scroll — no page reload needed.

---

## Installation

### Load Unpacked (Development / Personal Use)

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `JobTint` folder.
5. Navigate to any LinkedIn Jobs page — color-coding starts immediately.

### Package for Chrome Web Store

```bash
make package
```

This produces `dist/jobtint-v1.13.zip`, ready for submission to the Chrome Web Store.

---

## Features

- Live color-coding on LinkedIn job cards with no page reload required
- Persistent status tracking via Chrome's storage API — survives browser restarts
- Undo button appears next to "Application submitted" on job detail pages
- Dashboard popup with a full table of all tracked jobs
- Inline notes editing per job directly in the dashboard
- Status dropdown to manually change a job's status
- One-click CSV export of all tracked jobs
- Batch storage reads — one API call for all jobs, not one per job
- Zero external dependencies and zero network calls
- Defensive safety wrappers handle extension unload gracefully

---

## How It Works

`content.js` attaches a `MutationObserver` to the LinkedIn Jobs page to detect new job cards as the DOM changes (LinkedIn is a SPA). On each change, it:

1. Reads all tracked job IDs from Chrome storage in a single batch call.
2. Walks the visible job cards, matches each to a stored status, and applies the corresponding CSS border class.
3. Watches for the "Application submitted" toast on detail pages and injects an **Undo** button.
4. Debounces DOM change handling at 500 ms to avoid thrashing.

The popup (`popup/popup.js`) reads the same storage keys to render the dashboard table and writes back on any user action (status change, note edit, delete).

---

## Storage Schema

All data lives in `chrome.storage.local` under these key patterns:

```
jt_{jobId}           →  "applied" | "external" | "fresh"

jt_meta_{jobId}      →  {
                            title:   string,   // job title
                            company: string,   // company name
                            date:    string,   // ISO date string
                            mode:    string,   // "easy" | "external"
                            notes:   string    // user notes (may be empty)
                         }
```

---

## Project Structure

```
JobTint/
├── manifest.json        MV3 manifest — storage permission, targets linkedin.com/jobs/*
├── content.js           DOM observer, color-coding logic, toast watcher, SPA support
├── styles.css           Card border transitions (0.3s)
├── popup/
│   ├── popup.html       Dashboard UI shell
│   ├── popup.js         Table, CSV export, notes editing, status dropdown, delete/undo
│   └── popup.css        Dashboard styles — 520px wide, sticky header
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## Development

No build step is required. The extension runs directly from source.

**Workflow:**

1. Make changes to any file.
2. Go to `chrome://extensions/` and click the **reload** button on the JobTint card.
3. Refresh the LinkedIn tab to pick up changes in `content.js` or `styles.css`.  
   (Popup changes take effect immediately on the next popup open.)

**Packaging:**

```bash
make package
# Output: dist/jobtint-v1.13.zip
```

---

## License

JobTint is released under the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html).
