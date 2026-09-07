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

## Building a real app (EAS)

The app currently uses Expo's default icon/splash placeholders — swap
`assets/icon.png`, `assets/splash-icon.png`, and the Android adaptive icon
assets for your own before shipping a build.

To build an installable app instead of running through Expo Go:

```bash
npm install -g eas-cli
eas login
eas build:configure   # links this project to your Expo account, adds an eas projectId to app.json
eas build --profile development --platform android   # or ios
```

`eas.json` already defines `development`, `preview`, and `production`
build profiles.

## VeSync scale integration — verify before relying on it

`src/services/vesync/client.ts` reimplements VeSync's unofficial cloud
protocol (the same one `pyvesync`/Home Assistant use). The login and
device-list calls are the stable, well-documented part of that protocol,
but the scale-reading command (`getWeighingDataV2`) and its value scaling
were **not verified against a real account/scale** — VeSync's smart scale
is a less commonly reverse-engineered device category than their
plugs/bulbs/humidifiers. `DEBUG_LOG_RAW_RESPONSES` in that file is on by
default so you can see the raw JSON in the Metro console the first time
you connect your real VeSync account, and adjust the field names/scaling
in `client.ts` if they don't match. The rest of the app is unaffected
either way — the "weigh it" flow always falls back to manual entry if the
scale can't be read.
