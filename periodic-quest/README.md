# 🧪 Periodic Quest — Element Adventure

A kid-friendly Progressive Web App that teaches the periodic table through five mini-games, a discovery collection, pass-and-play multiplayer, and a full child-friendly encyclopedia. 100% client-side — no backend, no accounts, no paid APIs.

## Features
- **🧪 Mix Lab** — tap two elements, discover 89 real compounds as collectible cards (with friendly "why not" explanations for noble gases, metal+metal alloys, etc.)
- **🕵️ Guess the Element** — progressive clues; wrong and impossible choices dim to teach elimination (Beginner mode); Hard mode uses scientific clues only
- **🧩 Build the Table** — place elements on an empty table; First 10 / First 20 / All 118 / Timed
- **⚛️ Property Detective** — "Who am I?" with clue categories that get more scientific by difficulty
- **🔢 Atomic Challenge** — 5 modes: number→element, element→number, symbol match, memory match, 60-second speed round
- **🎮 Play Together** — pass-and-play: Guess Battle, Speed Build, Atomic Duel, Mix Lab Race
- **📖 Encyclopedia** — all 118 elements with child-friendly facts, uses, and where they're found
- **Rewards** — stars, coins, XP, 8 progressive learning levels, 12 badges, daily challenges, confetti
- **👩‍🏫 Grown-Up Zone** — accuracy, games played, recently learned elements, reset (behind a simple math gate)
- **Two modes** — 🐣 Beginner (6–8) and 🚀 Explorer (9–12)

## Accessibility
Large touch targets (≥44px), visible focus rings, ARIA labels and live regions, `prefers-reduced-motion` respected, sound toggle, no color-only information.

## Deploy to GitHub Pages
1. Create a repository and push this folder's contents to the root (or `/docs`).
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → pick `main` / root (or `/docs`).
3. Done. All paths are relative, so it works at `https://<user>.github.io/<repo>/` with no config.

Works offline after the first load (service worker caches the app shell and fonts). Progress is saved in `localStorage` on the device.

**Updating later:** bump the `CACHE` constant in `sw.js` (`pq-v1` → `pq-v2`) whenever you edit files, so returning players receive the new version.

## Run locally
Any static server, e.g. `python3 -m http.server` in this folder, then open `http://localhost:8000`.

## Structure
```
index.html            app shell (all screens + modals)
css/styles.css        "Candy Lab" design system
js/data.js            data layer: 118 elements + 89 compounds (generated, editable)
js/app.js             game logic, rewards, state
sw.js                 offline caching
manifest.webmanifest  PWA install metadata
icons/                app icons
```
Data lives entirely in `js/data.js` (a single `PQ_DATA` object) — add compounds or edit facts without touching game logic.
