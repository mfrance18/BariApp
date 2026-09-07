# BariApp

A single mobile app for bariatric surgery patients that replaces juggling
separate food-logging and smart-scale apps: log meals by weight (pulled
directly from a VeSync scale or entered manually), search or scan foods,
build recipes, track fluid intake, and track vitamins/medications with
reminders.

## Tech stack

- [Expo](https://expo.dev) + TypeScript, [`expo-router`](https://expo.github.io/router/) for navigation
- On-device SQLite via `expo-sqlite` + [`drizzle-orm`](https://orm.drizzle.team) (local-first, single-user — no backend server)
- `expo-secure-store` for VeSync credentials
- `expo-camera` for barcode scanning
- `expo-notifications` for local vitamin/medication reminders
- [Open Food Facts](https://world.openfoodfacts.org) for barcode/nutrition lookups
- A reverse-engineered VeSync cloud API client (no official third-party API exists) for scale readings

## Getting started

```bash
npm install
npm run start
```

Then press `a` for Android or `i` for iOS in the Expo CLI, or scan the QR
code with Expo Go.

## Scripts

- `npm run start` — start the Metro dev server
- `npm run android` / `npm run ios` / `npm run web` — start and open on a platform
- `npm run typecheck` — TypeScript project check
- `npm test` — run unit tests (Jest)
- `npm run db:generate` — regenerate SQL migrations from `src/db/schema.ts` after a schema change

## Project layout

- `app/` — screens and navigation (Expo Router file-based routing)
- `src/db/` — Drizzle schema, migrations, and repositories (all data access goes through `src/db/repositories/*`)
- `src/services/vesync/` — VeSync scale integration, isolated behind an adapter that never throws (falls back to manual weight entry)
- `src/services/openFoodFacts/` — barcode/nutrition lookups
- `src/services/nutrition/` — weight-based nutrition scaling math
- `src/services/notifications/` — local reminder scheduling for vitamins/meds

All app data lives on-device; there is no backend or account system beyond
your own VeSync login (used only to read your scale).
