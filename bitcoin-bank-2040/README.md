# A Day in 2040 — Bitcoin-Native Banking Experience

A speculative design project imagining the lived experience of retail banking on Bitcoin rails in the year 2040. This interactive website follows Elena Vasquez, a freelance logistics consultant in Columbus, Ohio, through a single day of mundane financial interactions — payments, settlements, credit, and family finances — all built on Bitcoin infrastructure.

## Purpose

This project is not a prediction. It's a design exercise asking: *What would banking feel like if Bitcoin actually worked as global financial infrastructure?*

The goal is to make Bitcoin invisible. In this scenario, Bitcoin is boring. It's plumbing. Users don't think about it any more than they think about TCP/IP when loading a webpage.

**Design principles:**

- No hype, no price talk, no "Bitcoin changed everything" monologues
- Banks still exist. Fiat still exists (abstracted away)
- Custody is professional, transparent, auditable
- The user never sees private keys
- Everything settles fast, but not "magically"
- Tone is calm, matter-of-fact, confident

## Project Structure

```
bitcoin-bank-2040/
├── index.html              # Landing page with overview
├── morning.html            # Morning scene: balances, Lightning payments, yield
├── midday.html             # Midday scene: invoice settlements, international payments
├── afternoon.html          # Afternoon scene: Bitcoin-backed credit line, stress testing
├── evening.html            # Evening scene: family accounts, inheritance planning
├── styles/
│   └── main.css            # Complete stylesheet with CSS custom properties
├── scripts/
│   ├── app.js              # Core utilities, state management, shared functions
│   ├── morning.js          # Morning scene interactions
│   ├── midday.js           # Midday scene interactions
│   ├── afternoon.js        # Afternoon scene interactions
│   └── evening.js          # Evening scene interactions
├── data/
│   └── user-state.json     # All dynamic data for the experience
├── assets/
│   ├── icons/              # (Optional) Custom SVG icons
│   └── illustrations/      # (Optional) Scene illustrations
└── README.md               # This file
```

## Running Locally

1. Clone or download the project
2. Open a terminal in the project directory
3. Start any local server. Examples:

   **Python 3:**
   ```bash
   python -m http.server 8000
   ```

   **Node.js (with npx):**
   ```bash
   npx serve .
   ```

   **PHP:**
   ```bash
   php -S localhost:8000
   ```

4. Open `http://localhost:8000` in your browser

**Note:** A local server is required because the app loads `user-state.json` via fetch. Opening `index.html` directly in a browser will cause CORS errors.

## How It Works

### State Management

All dynamic data lives in `data/user-state.json`. This includes:

- User profile (Elena Vasquez)
- Account balances (BTC + USD)
- Vault yield information
- Recent transactions
- Invoice data
- Credit line parameters
- Custodial accounts (children)
- Inheritance configuration
- Custody model details

JavaScript loads this file once on page load and manages state in memory. Changes made during the session (like simulating a payment) update local state but don't persist — this is a demo, not a real app.

### Scene Structure

Each scene (morning, midday, afternoon, evening) follows the same pattern:

1. **Scene header** — Time, location, and narrative quote from Elena's perspective
2. **Primary interaction** — The main financial activity (checking balance, viewing settlement, simulating credit draw)
3. **Detail modals** — Expandable information (yield sources, settlement details)
4. **Narrative breaks** — First-person quotes that ground the experience in Elena's reality
5. **Navigation** — Links to continue the day's journey

### Interaction Model

| Scene     | Primary Interactions                                    |
| --------- | ------------------------------------------------------- |
| Morning   | View balances, expand yield details, simulate payment   |
| Midday    | View invoice settlements, expand transaction details    |
| Afternoon | Enter draw amount, run stress tests, view projections   |
| Evening   | View family accounts, toggle inheritance settings, save |

### Styling

The CSS uses custom properties (CSS variables) for all design tokens. To modify colors, spacing, or typography, edit the `:root` block in `styles/main.css`.

Dark mode is automatically supported via `@media (prefers-color-scheme: dark)`.

The design is intentionally *not* a "crypto dashboard." It's inspired by modern banking apps (Monzo, N26, Apple Card) — minimal, typographic, trust-focused.

## Extending the Project

### Adding a New Scene

1. Create `newscene.html` following the structure of existing scenes
2. Create `scripts/newscene.js` for scene-specific interactions
3. Add navigation links to all other scene files
4. Update `user-state.json` with any new data the scene requires

### Modifying Elena's Profile

Edit `data/user-state.json` to change:

- User details (`user` object)
- Account balances (`balances` object)
- Transaction history (`transactions` array)
- Credit parameters (`credit` object)
- Family accounts (`custodialAccounts` array)

### Adding Animations

The CSS includes transition variables (`--transition-fast`, `--transition-base`, `--transition-slow`). Add motion by applying these to elements via JavaScript class toggling.

### Internationalization

The project uses `Intl.NumberFormat` for currency formatting. To support other locales:

1. Modify `formatUSD()` in `app.js` to accept a locale parameter
2. Add locale-specific date formatting in `formatDate()` and `formatTime()`

## Design Constraints

This project deliberately avoids:

- **Sci-fi clichés** — No holographic interfaces, brain chips, or teleportation
- **Crypto aesthetics** — No neon gradients, trading charts, or price tickers
- **Ideology** — Elena chose Meridian Bank because it solved real problems, not because of political beliefs
- **Unrealistic tech** — Everything shown could plausibly exist with incremental advances from 2025

## The Narrative

The full first-person narrative is embedded in the HTML pages as quotes and scene descriptions. For the complete standalone narrative, see the project documentation or the introductory text on `index.html`.

## Technical Notes

- **No frameworks** — Plain HTML, CSS, vanilla JavaScript
- **No build step** — Works directly in browser
- **Mobile-first** — Designed for 375px width, scales gracefully
- **Accessible** — Semantic HTML, ARIA labels, keyboard navigation
- **Performance** — Single CSS file, minimal JS, no external dependencies

## License

This is a design concept for educational and speculative purposes. Use it however you like.

---

*"The money just works. That's the whole point."*
