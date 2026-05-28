# SmartChart

**Stateless, client-side PWA for auto-inserting templated text into EMR notes.**

[Shot-in-the-dark](https://pedscoffee.github.io/shot-in-the-dark/)

---

## Quick Start

1. **Open `index.html`** in any modern browser (Chrome, Firefox, Safari, Edge).
2. **Type a clinical one-liner** in the input field (e.g. *"2yo with fever and vomiting x1 day"*).
3. Matching templates appear instantly in the preview.
4. After **1.5 seconds of inactivity**, the note is **auto-copied** to your clipboard.
5. **Paste directly into your EMR.**

---

## How It Works

### Template Matching
- You type a one-liner; SmartChart scans it for **trigger keywords** (case-insensitive, partial match).
- Example: typing *"vomiting"* matches the **GI Illness** template (trigger: `vomiting`) and the **Dehydration Precautions** template (trigger: `vomiting`).
- Multiple matches are appended in priority order, separated by blank lines.

### Note Template
The **Note Template** (editable in Settings) controls the final structure:

| Placeholder | Meaning |
|---|---|
| `{input}` | Your typed one-liner |
| `{templates}` | All matched template content, joined with blank lines |
| `{static:TEXT}` | Fixed Markdown text; use `\n` for newlines |

**Default:**
```
{input}

{templates}
```

**Example with custom structure:**
```
**HPI:** {input}

**Educated On:**
{templates}

{static:**Follow-Up:** Return in 1 week if not improving.\n\n**Vaccines:** Up to date.}
```

### Auto-Copy
- Preview updates **300ms** after you stop typing.
- Clipboard auto-copies **1.5 seconds** after you stop typing.
- A pulsing green dot in the status bar indicates a copy is pending.
- The **copy icon** in the header forces a manual copy at any time.

### Auto-Clear
- Input clears automatically after **30 seconds** of inactivity.
- A toast notification confirms the clear.
- Both delays are configurable in **Settings → Behavior**.

---

## Settings

Access via the **gear icon ⚙** in the pane header.

### Note Template Tab
Edit the base note structure. Must contain `{input}` and `{templates}`. Supports full Markdown plus `{static:...}` placeholders.

### Templates Tab
- **Add** new templates with name, trigger keywords, Markdown content, and priority.
- **Edit** or **delete** existing templates.
- **Priority**: lower number = appears first in the note (1 = highest priority).
- Triggers are comma-separated keywords; matching is case-insensitive and partial.

### Behavior Tab
- Toggle **auto-copy** on/off.
- Adjust **auto-copy delay** (0.5s–10s).
- Adjust **auto-clear delay** (10s–300s).
- **Export** all data as JSON backup.
- **Import** from a previous JSON export.
- **Reset** everything to factory defaults.

---

## Default Templates

| Template | Key Triggers |
|---|---|
| Dehydration Precautions | dehydration, vomiting, diarrhea, poor po |
| Fever Management | fever, febrile, temperature |
| Upper Respiratory Illness | cough, congestion, runny nose, uri |
| Sore Throat / Pharyngitis | sore throat, strep, throat pain |
| Ear Infection (Otitis Media) | ear pain, earache, otitis |
| Gastrointestinal Illness | gastroenteritis, nausea, vomiting, diarrhea |
| Rash / Skin Irritation | rash, hives, eczema, itching |
| Well Child Visit | well child, checkup, annual, physical exam |
| Minor Injury / Wound Care | laceration, cut, wound, sprain, injury |
| Antibiotic Instructions | antibiotic, amoxicillin, azithromycin |
| General Return Precautions | return precautions |

All templates are fully editable. You can add unlimited custom templates.

---

## Installing as PWA ("Add to Home Screen")

**On Desktop (Chrome):**
Click the install icon (⊕) in the browser address bar, or go to `⋮ Menu → Install SmartChart`.

**On iPhone/iPad (Safari):**
Tap the Share button → *Add to Home Screen*.

**On Android (Chrome):**
Tap `⋮ Menu → Add to Home Screen`.

Once installed, SmartChart works fully **offline** — the service worker caches all assets on first load.

---

## Privacy & Security

- **No data leaves your device.** All templates and settings are stored in `localStorage` only.
- **No analytics, no telemetry, no ads.**
- **No PHI is stored** — the input field is never persisted; it clears on inactivity.
- The clipboard copy uses the standard browser `Clipboard API`. No data passes through any server.

---

## Design Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Markdown library | `marked.js` v9 via CDN | Lightweight, browser-native, no build step |
| Preview content | Renders HTML; clipboard gets **Markdown source** | EMRs expect plain text/Markdown, not HTML |
| Resize handle | Custom JS drag handle | More reliable than `CSS resize` on `position:fixed` |
| Template conflict | Append all matches in priority order | Clinical safety — show all relevant education |
| Font pairing | Sora (UI) + IBM Plex Mono (content) | Tool-like professional aesthetic |
| Color scheme | Deep charcoal + medical green (`#22c55e`) | Clinical, high-contrast, OLED-friendly |
| Settings panel | Full-pane overlay | Maximizes usable space; avoids nested scroll complexity |
| Auto-copy format | Markdown source text | Paste-ready for most EMR rich-text fields |
| Icons | Inline SVG (no external requests) | Works fully offline |

---

## Browser Support

| Browser | Support |
|---|---|
| Chrome 90+ | ✅ Full (including PWA install) |
| Firefox 88+ | ✅ Full |
| Safari 15.4+ | ✅ Full (PWA via "Add to Home Screen") |
| Edge 90+ | ✅ Full |
| IE 11 | ❌ Not supported |
