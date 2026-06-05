# SmartChart

**A stateless, privacy-first PWA that auto-inserts templated text into EMR notes from a simple clinical one-liner.**

**[Live App → pedscoffee.github.io/shot-in-the-dark](https://pedscoffee.github.io/shot-in-the-dark/)**

> ⚠️ Currently in active development. Not yet suitable for clinical use.

---

## What It Does

SmartChart is a lightweight web app designed for clinicians who want to spend less time typing repetitive education and counseling text into their EMR. Type a brief clinical description (e.g., *"5yo with fever and cough"*), and SmartChart instantly assembles a structured note from matching templates — then auto-copies it to your clipboard, ready to paste.

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

SmartChart scans your one-liner for **trigger keywords** (case-insensitive, partial word boundary match) and assembles matching templates in priority order.

**Example:** Typing *"vomiting and poor PO"* matches both the **Dehydration Risk** and **Illness Supportive Care** templates, appending them in priority order.

### Note Template

The **Note Template** (editable in Settings) controls the final assembled structure. Three placeholder types are supported:

| Placeholder | Description |
|---|---|
| `{input}` | Your typed one-liner |
| `{templates}` | All matched template content, joined with separators |
| `{static:TEXT}` | Fixed text; use `<br>` for line breaks |
| `{dropdown:ID}` | Inline dropdown selector embedded in a template |

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

### Dropdown Templates

Templates can be of type `dropdown` — instead of fixed text, they present a selector in the preview panel where you choose one or more options. Dropdowns can be:

- **Single-select** — choose one option from a menu (e.g., a Follow-Up timeframe).
- **Multi-select** — choose multiple options, then pick how they're joined (bullets, comma list, "and/or", sentence, etc.).

Dropdown templates can be triggered by keywords in your one-liner (replacing the trigger word inline) or embedded inside other templates using `{dropdown:ID}`.

### Smart Textarea Shortcuts

The input field supports several dot-expansion shortcuts:

| Type this | Inserts |
|---|---|
| `.today` | Today's date (MM/DD/YYYY) |
| `.tomorrow` | Tomorrow's date |
| `.2d` | Date 2 days from now |
| `.1w` | Date 1 week from now |
| `.now` | Current time |
| `- ` + Enter | Continues a bullet list |

### Auto-Copy & Auto-Clear

- Preview updates **300ms** after you stop typing.
- Clipboard auto-copies **1.5 seconds** after you stop typing (a pulsing green dot indicates a pending copy).
- The **copy icon** in the header triggers an immediate manual copy (rich HTML + plain-text fallback).
- The **plain-text button** copies as plain text only (useful for EMRs that don't accept rich text).
- Input clears automatically after **30 seconds** of inactivity (configurable). An **Undo** button appears for 8 seconds after a clear.

---

## Template Wizard

The **Template Wizard** is a guided onboarding tool that lets you build a complete, structured diagnosis template in one step — no manual JSON editing or dropdown configuration required.

Access it via the **✦ Wizard** button inside the Settings panel.

### What It Does

Given a diagnosis or clinical problem (e.g., *"Acute Otitis Media"*), the wizard generates a full suite of linked dropdown templates covering every stage of the clinical encounter — history, exam, differential, diagnosis, labs, imaging, medications, treatment plan, supportive care, complications, conditional plans, return precautions, discharge planning, nursing orders, and follow-up. Each category becomes its own dropdown embedded inside a single main template that fires whenever your trigger keywords match.

### How to Use It

1. **Enter a Diagnosis or Problem Name** — This becomes the name of the main template (e.g., `Acute Otitis Media`).
2. **Enter Trigger Keywords** — Comma-separated words or phrases that activate this template from the input field (e.g., `ear pain, otitis, AOM`).
3. **Configure Categories** — A table of 15 pre-defined clinical categories is shown. For each category you want to include:
   - **Check the checkbox** to enable it (checking happens automatically when you start typing variations).
   - **Enter variations** in the textarea — one per line. These become the selectable options in the dropdown at note time.
   - **Choose an output mode** — how selected options are joined in the assembled note (single-select, bullets, comma list, comma + and/or, sentence, or paragraphs).
4. **Add Custom Categories** — Click **+ Add Custom Category** to insert a free-form row with your own category name and variations (e.g., *School Excuse*, *Interpreter Used*).
5. **Link Existing Templates** *(optional)* — Check any existing SmartChart templates to automatically add your new trigger keywords to them. This ensures your one-liner simultaneously fires both the new diagnosis-specific template and any relevant general-purpose templates (e.g., the default *Illness Supportive Care* template).
6. **Click Generate** — The wizard saves all generated templates to localStorage and immediately activates them. No page refresh needed.

### What Gets Generated

For a diagnosis with *N* enabled categories, the wizard creates:

- **N dropdown sub-templates** — one per enabled category, each containing the options you entered. These are embedded-only (no auto-trigger keywords), so they never fire independently.
- **1 main template** — named after the diagnosis, fired by your trigger keywords, and composed entirely of `{dropdown:ID}` references to the sub-templates. At note time, each category appears as an inline selector in the preview panel.

All generated templates are assigned a **category** matching the diagnosis name, making them easy to identify and manage in the Templates tab.

### Re-Running the Wizard

Re-running the wizard for the same diagnosis name safely **overwrites** only the previously generated templates for that diagnosis (matched by ID), preserving all other templates. This makes iteration painless — refine your variations, regenerate, and the updated templates are live immediately.

### Pre-Defined Category Reference

| Category | Default Output Mode | Description |
|---|---|---|
| Key elements of history | Single-select | Symptom onset, duration, quality, aggravating/alleviating factors |
| Key exam findings | Single-select | Physical exam parameters (TMs, throat, lungs, abdomen, etc.) |
| Key elements of differential | Single-select | Alternative or contributing diagnoses considered |
| Likely diagnosis | Single-select | Working diagnosis or assessment |
| Labs | Single-select | Laboratory testing ordered or reviewed |
| Imaging | Single-select | Radiology or bedside imaging ordered/performed |
| Medications with exact doses | Single-select | Pharmacological treatment with precise dosing |
| Treatment / plan actions | Bullets | Active counseling, procedures, or clinic-specific interventions |
| Supportive care | Bullets | Non-pharmacological measures, OTC meds, hydration, rest |
| Complications | Bullets | Clinical risks the caregiver should monitor for |
| Conditional plans (if X, then Y) | Bullets | Contingency plans if symptoms change or fail to resolve |
| Return precautions | Bullets | Red flag symptoms indicating need for prompt re-evaluation |
| Discharge planning | Bullets | Parameters for discharge or clinic wrap-up |
| Nursing orders | Bullets | Instructions for clinic or nursing staff |
| Follow-Up | Single-select | Schedule or criteria for follow-up evaluation |

---

## Settings

Access via the **⚙ gear icon** in the header.

### Note Template Tab
Edit the base note structure. Must contain `{input}` and `{templates}`. Supports HTML content and `{static:...}` / `{dropdown:...}` placeholders.

### Templates Tab
- **Add** templates with a name, trigger keywords, HTML content, and priority.
- **Edit** or **delete** any existing template.
- **Priority**: lower number = appears first in the assembled note (1 = highest).
- Triggers are comma-separated; matching uses word-boundary detection (case-insensitive).
- Template type can be set to `dropdown` with configurable options and join mode.

### Behavior Tab
- Toggle **auto-copy** on/off.
- Adjust **auto-copy delay** (0.5s–10s).
- Adjust **auto-clear delay** (10s–300s).
- Toggle **plain text copy** mode.
- Toggle **source labels** to show which template each block came from.
- **Export** all data as a JSON backup.
- **Import** from a previous JSON export.
- **Reset** to factory defaults.

---

## Default Templates

SmartChart ships with 10 default pediatric templates, all fully editable:

| Template | Key Triggers |
|---|---|
| Well Child / Health Maintenance | well child, well visit, health maintenance, checkup, physical, WCC |
| Illness Supportive Care | illness, sick, fever, cough, congestion, uri, rash, sore throat, ear pain, vomiting, diarrhea, wheezing |
| Injury Supportive Care | injury, laceration, cut, wound, trauma, bruise, sprain, fracture |
| Ear Infection Risk | ear infection, otitis media, ear pain, earache |
| Strep Test Risk | strep test, rapid strep, throat culture, strep throat |
| Dehydration Risk | dehydration, vomiting, diarrhea, poor po, not drinking |
| Respiratory Distress Risk | trouble breathing, shortness of breath, wheezing, respiratory distress |
| Eczema | eczema, atopic dermatitis |
| PCMH Reminder | adhd, weight, obesity, strep throat |
| Follow-Up Dropdown *(single-select)* | follow up, followup |

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

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘/Ctrl + Shift + C` | Copy note to clipboard immediately |
| `⌘/Ctrl + Shift + N` | New patient (clear input, with undo) |
| `⌘/Ctrl + Shift + S` | Open / close Settings |
| `⌘/Ctrl + Shift + F` | Focus input field |
| `Escape` | Close Settings panel |

---

## Privacy & Security

- Static page with no backend — can be used via GitHub Pages or run fully locally.
- All template data and settings are stored in **browser localStorage** — nothing is sent to a server.
- Clipboard copy uses the standard browser `Clipboard API`; rich HTML + plain-text fallback.
- HTML template content is sanitized via **DOMPurify** before any DOM insertion.
- Only as secure as the browser and machine you run it on.
- Beta development; not suitable for clinical use at this time.

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
| Template content format | HTML strings | Richer formatting; no Markdown parse step at render time |
| Clipboard output | Rich HTML + plain-text fallback via `ClipboardItem` | Works in most modern EMRs; gracefully degrades |
| HTML sanitization | DOMPurify (CDN) | Prevents XSS from user-supplied template content |
| Template conflict handling | Append all matches in priority order | Clinical safety — surface all relevant education |
| Dropdown join modes | bullets, comma, and/or/nor, sentence, paragraphs | Flexible output for varied EMR styles |
| Smart textarea | Dot expansions + bullet continuation | Speeds up common clinical input patterns |
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
