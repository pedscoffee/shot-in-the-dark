# SmartChart

**A stateless, privacy-first PWA that auto-inserts templated text into EMR notes from a simple clinical one-liner.**

**[Live App → pedscoffee.github.io/shot-in-the-dark](https://pedscoffee.github.io/shot-in-the-dark/)**

> ⚠️ Currently in active development.  Not yet suitable for actual use.

---

## What It Does

SmartChart is a lightweight, single-file web app designed for clinicians who want to spend less time typing repetitive education and counseling text into their EMR. You type a brief clinical description (e.g., *"5yo with fever and cough"*), and SmartChart instantly assembles a structured note from matching templates — then auto-copies it to your clipboard, ready to paste.

No login. No server. No data leaves your device.

---

## Quick Start

1. Open the [live app](https://pedscoffee.github.io/shot-in-the-dark/) (or clone and open `index.html` locally).
2. Type a clinical one-liner into the input field.
3. Matching templates appear instantly in the preview panel.
4. After **1.5 seconds of inactivity**, the note is **auto-copied** to your clipboard.
5. Paste directly into your EMR.

---

## How It Works

### Template Matching

SmartChart scans your one-liner for **trigger keywords** (case-insensitive, partial match) and assembles matching templates in priority order.

**Example:** Typing *"vomiting and poor PO"* matches both the **GI Illness** and **Dehydration Precautions** templates, appending them with blank lines between.

### Note Template

The **Note Template** (editable in Settings) controls the final assembled structure. Three placeholder types are supported:

| Placeholder | Description |
|---|---|
| `{input}` | Your typed one-liner |
| `{templates}` | All matched template content, joined with blank lines |
| `{static:TEXT}` | Fixed text; use `<br>` for line breaks |

**Default structure:**
```
{input}

{templates}
```

**Custom example:**
```
**HPI:** {input}

**Educated On:**
{templates}

{static:**Follow-Up:** Return in 1 week if not improving.<br><br>**Vaccines:** Up to date.}
```

### Auto-Copy & Auto-Clear

- Preview updates **300ms** after you stop typing.
- Clipboard auto-copies **1.5 seconds** after you stop typing (a pulsing green dot indicates a pending copy).
- The **copy icon** in the header triggers an immediate manual copy.
- Input clears automatically after **30 seconds** of inactivity (configurable).

---

## Settings

Access via the **⚙ gear icon** in the pane header.

### Note Template Tab
Edit the base note structure. Must contain `{input}` and `{templates}`. Supports full Markdown and `{static:...}` placeholders.

### Templates Tab
- **Add** templates with a name, trigger keywords, Markdown content, and priority.
- **Edit** or **delete** any existing template.
- **Priority**: lower number = appears first in the assembled note (1 = highest).
- Triggers are comma-separated; matching is case-insensitive and partial.

### Behavior Tab
- Toggle **auto-copy** on/off.
- Adjust **auto-copy delay** (0.5s–10s).
- Adjust **auto-clear delay** (10s–300s).
- **Export** all data as a JSON backup.
- **Import** from a previous JSON export.
- **Reset** to factory defaults.

---

## Default Templates

SmartChart ships with 11 common pediatric templates, all fully editable:

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

---

## Installing as a PWA

SmartChart works as a Progressive Web App — install it to your home screen for offline access with a native app feel.

**Desktop (Chrome / Edge):**
Click the install icon (⊕) in the address bar, or go to `⋮ Menu → Install SmartChart`.

**iPhone / iPad (Safari):**
Tap the Share button → *Add to Home Screen*.

**Android (Chrome):**
Tap `⋮ Menu → Add to Home Screen`.

Once installed, SmartChart works **fully offline** — a service worker caches all assets on first load.

---

## Privacy & Security

- Static page without a backend you can try out via Github Pages and then run locally if you like it
- Only as secure as the browser and machine you run it on
- Clipboard copy uses the standard browser `Clipboard API` — nothing passes through a server.
- In beta development; not suitable for clinical use at this time

---

## Browser Support

| Browser | Support |
|---|---|
| Chrome 90+ | ✅ Full (including PWA install) |
| Firefox 88+ | ✅ Full |
| Safari 15.4+ | ✅ Full (PWA via Add to Home Screen) |
| Edge 90+ | ✅ Full |
| IE 11 | ❌ Not supported |

---

## Technical Notes

| Decision | Choice | Rationale |
|---|---|---|
| Markdown library | `marked.js` v9 via CDN | Lightweight, browser-native, no build step |
| Preview rendering | HTML preview; clipboard gets **Markdown source** | EMRs expect plain text/Markdown, not HTML |
| Template conflict handling | Append all matches in priority order | Clinical safety — surface all relevant education |
| Resize handle | Custom JS drag | More reliable than `CSS resize` on fixed-position elements |
| Font pairing | Sora (UI) + IBM Plex Mono (content) | Professional, tool-like aesthetic |
| Color scheme | Deep charcoal + medical green (`#22c55e`) | Clinical, high-contrast, OLED-friendly |
| Settings panel | Full-pane overlay | Maximizes usable space; avoids nested scroll complexity |

---

## Running Locally

No build step required.

```bash
git clone https://github.com/pedscoffee/shot-in-the-dark.git
cd shot-in-the-dark
# Open index.html in any modern browser
open index.html
```

For service worker functionality (offline support, PWA install), serve over HTTP:

```bash
# Python 3
python -m http.server 8080
# Then open http://localhost:8080
```