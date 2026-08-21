# Solar Forecast Model Leaderboard

A standalone, client-facing workspace for historical head-to-head evaluation of three
generation-forecasting models — **External QCA**, **Sunsure Internal** and **Nevron** —
against measured plant output at 15-minute resolution.

Built to PRD v2. This is the **frontend**: it runs against a typed mock service today and
against the production evaluation API tomorrow, with no UI changes.

---

## Running it

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:3000>. The workspace is behind a single shared access code.

| Variable | Purpose | Default |
| --- | --- | --- |
| `LEADERBOARD_PASSWORD` | The shared access code. Validated server-side only. | none — login refuses all attempts until set |
| `AUTH_SECRET` | HMAC key for the session cookie. | none — a random per-process key is used, so sessions drop on restart |

Both live in `.env.local`, which is gitignored — copy `.env.example` and fill it in. Neither has a
committed default, so a deployment that forgets them fails closed rather than falling back to a
value published in this repository. The password is never bundled into client
JavaScript — `/api/auth/login` compares it on the server and returns an httpOnly, signed,
12-hour session cookie that `src/proxy.ts` verifies on every request.

```bash
npm run build && npm start
```

---

## What's on screen

**Fleet overview** — every plant on one screen. Each plant gets one row: metric winners
and coverage across the top, then Forecast vs Actual on the left beside its official band
distribution on the right — the curve and how it settled into bands, same period, same
eligible blocks. Panels fetch independently, so one slow or failing plant never blanks the
fleet. Multi-day charts pan and zoom, and clicking a day opens that plant's 96 blocks.

**Plant monitor** — one plant in depth, in this order: independent metric winners, the
Forecast vs Actual evidence directly beneath them, the model leaderboard, then supporting
evidence (official band distribution plus daily evidence or the intraday error profile).

**Comparison** — up to six plant/period selections. Side-by-side forecast panels on an
identical visual grammar, a metric focus chart defaulting to capacity-normalised RMSE, and
the comparison matrix. Every selection states its eligible interval count, so a 79-day
selection is never read as equal in weight to a one-day selection.

**Settings** — plant configuration, the locked visual identity, the API surface, and the
demo scenario switcher.

The default period is a **single day** (the latest with complete data), so charts open at
full 15-minute resolution rather than as a long-range timeline.

Periods are capped at **30 days** (`MAX_RANGE_DAYS` in `lib/utils/date.ts`). Everything is
sized by that cap: the series stays at full 15-minute resolution — 30 × 96 = 2,880 blocks,
never averaged — so the block table works across any selectable period. The cap is applied
in `clampRange()`, which every entry point routes through: the picker, a pasted URL, and
the service itself. An over-long URL is trimmed *and* rewritten, so a shared link always
describes the data it shows. Raising the cap means revisiting chart density and table row
counts together.

---

## Product rules encoded in the code

These are not styling choices; they are correctness constraints from the PRD, and each has
a single enforcement point so it cannot drift:

| Rule | Where it lives |
| --- | --- |
| **No composite score.** Winners are resolved independently per metric. | `resolveWinners()` in `src/lib/metrics/compute.ts` — there is no combining function to call. |
| **One deviation, one classifier.** Band A is `|forecast − actual| ÷ actual ≤ tolerance` (±10% UP, ±15% MH). The chart envelope is drawn at that same boundary, so it can never tell a different story from the band counts. | `annotateBands()` in `src/lib/metrics/compute.ts` is the only classifier; `summariseModel` reads its output rather than re-deriving. Per-block bands ship in `IntervalRecord.bands`. |
| **Tolerance is a filled area, never a dotted line.** | `ForecastChart` draws a stacked translucent light-green area; there is no boundary series. |
| **Missing Actual is never zeroed.** | `actual_mw: null` flows end to end; the line breaks, a "No telemetry" band is drawn, and the interval is excluded from every denominator. |
| **Range metrics aggregate the whole range.** | Band counts and coverage read from `coverage.eligible_intervals`, printed next to the chart — 13 days is 1,248 expected blocks, not 96. |
| **Like-for-like comparison.** | `resolveEligibility()` intersects the blocks all three models supplied; per-model availability is disclosed when they diverge. |
| **DSM impact is qualified.** | The payload carries `dsm_basis`; the UI renders the matching caveat rather than inferring one. Same for `band_basis`. |
| **Every metric explains itself.** | One `METRIC_CATALOG` feeds hover cards, table headers and the metric reference dialog, so no metric can be described two ways. |
| **No cross-plant apples-to-oranges.** | Raw MW errors and state-specific band metrics are flagged as single-plant only; cross-plant comparison defaults to capacity-normalised NRMSE. See `lib/metrics/normalize.ts`. |
| **Sample size is always visible.** | Eligible interval counts sit beside every comparison selection, so selections of very different weight cannot look equally solid. |
| **No period escapes the cap.** | `clampRange()` in `lib/utils/date.ts` is the only place a period is resolved — picker, URL and `resolveScope()` all call it, so an over-long range cannot reach the service by any path. |

---

## Architecture

```
src/
├── app/
│   ├── (workspace)/        overview (fleet) · monitor · day · compare · settings
│   ├── api/                the evaluation service (mock implementation)
│   └── login/
├── components/
│   ├── charts/             ECharts wrapper, forecast chart, shared chart chrome
│   ├── fleet/              per-plant panel for the fleet overview
│   ├── leaderboard/        winner cards, leaderboard table
│   ├── evidence/           band distribution, daily evidence, intraday error
│   ├── day/                96-block interval table
│   ├── compare/            selection builder, side-by-side charts
│   ├── metrics/            canonical tooltip + reference dialog
│   ├── shell/ workspace/   header, context bar, URL-backed selection state
│   └── ui/                 primitives, loading / empty / error states
└── lib/
    ├── types.ts            the API contract — the only shape components read
    ├── api/                typed client + TanStack Query hooks
    ├── config/             plants, model identity, metric catalogue
    ├── metrics/compute.ts  RMSE / MAE / bias / bands / DSM / winners
    ├── metrics/normalize.ts capacity-normalised metrics for cross-plant reads
    └── mock/               deterministic data generator + scenarios
```

Stack: Next.js 16 (App Router, React 19 under the hood) · TypeScript · Tailwind v4 ·
Apache ECharts · TanStack Query · Radix UI · Geist.

The interface uses a warm neutral canvas, a deep-green brand anchor and a restrained
amber accent. Colour is reserved for meaning: light green shades Band A, amber marks
caution, and each model keeps one fixed identity colour across every chart, table and
legend.

**Vendor brands.** The two models under evaluation carry their own colours — Nevron Blue
`#1A5FAB` from the Nevron Group brand guide (v4.5), and Sunsure's red-orange `#FF3B21`.
External QCA is neither brand, so it takes a purple of its own: the only hue far enough
from both to stay separable at 1.6px, and one that can never be mistaken for the near-black
Actual line. Nevron's real assets live in `public/brand/` and render through
`components/brand/model-logo.tsx`.

Nevron colour rules observed: brand blue and green appear as accents on a light ground,
never as a saturated full-bleed background, and no text is set on a raw accent surface.
Nevron's mark appears only as the identity of the Nevron *model* — never in the masthead or
footer, where it would read as an endorsement of what is a Sunsure evaluation tool.

Workspace selection (plant, period, visible models, scenario) lives in the URL, so any view
a stakeholder is looking at can be copied out of the address bar and reopened exactly.

---

## Connecting the real backend

Everything synthetic is behind one module boundary.

1. Point `NEXT_PUBLIC_API_BASE` at the real service, or replace the handlers in
   `src/app/api/evaluation/*` with proxies to it.
2. Delete `src/lib/mock/` and the `scenario` query parameter in `src/lib/api/client.ts`.
3. Delete the scenario card in `src/app/(workspace)/settings/page.tsx`.

Nothing in `src/components/` needs to change. The endpoints and payloads are already the
PRD contract:

| Endpoint | Returns |
| --- | --- |
| `GET /plants` | Plant configuration and state metadata |
| `GET /evaluation/summary` | Range metrics, coverage, per-metric winners |
| `GET /evaluation/daily` | Per-day evidence for the range |
| `GET /evaluation/series` | Interval series backing the primary chart |
| `GET /evaluation/day` | The 96 blocks of one plant-day |
| `POST /evaluation/compare` | Metrics for multiple plant/period selections |

Two payload fields drive how the UI qualifies its numbers, and the backend owns both:

- `band_basis` — `regulatory_schedule` or `simulated_model_as_schedule`
- `dsm_basis` — `actual_schedule_linked` or `simulated_model_attribution`

Set them accurately. The frontend states what they say and never infers liability from
forecast error.

---

## Demo data

All figures are generated by a deterministic mock: a clear-sky curve for the plant's
latitude and day of year, a cloud transmittance field, and per-model forecasts that blend
the true cloud field with an independently generated one according to each model's skill.
Forecast error is autocorrelated with occasional multi-block excursions, and no model
forecasts meaningfully above the clear-sky ceiling — so the curves behave the way an
operator expects rather than looking like noise.

The generator is seeded on `(plant, date, scenario)`, so the same selection always returns
the same numbers. Screenshots and walkthroughs stay stable.

Scenarios (Settings → Data scenario):

| Scenario | Demonstrates |
| --- | --- |
| Typical operations | The everyday comparison view |
| Clear sky | Models nearly tied — winners separated by small margins |
| Monsoon volatility | Wide tolerance breaches, degraded bands, high DSM exposure |
| SCADA outage | Coverage below 100%, a visible gap in the Actual line |
| Model feed dropout | Uneven per-model coverage, flagged as not like-for-like |
| QCA over-forecast drift | Bias as a failure mode distinct from RMSE |
| No evaluation data | The empty state |
| API failure | The error state with retry, and no stale numbers shown as current |
| Stale cache | Last-good data served but explicitly marked |

---

## Out of scope

Per the PRD, this prototype does not schedule, revise or submit generation, does not
integrate with QCA portals, does not attribute settlement liability, and does not explain
forecast error. It evaluates models against Actual, and says so on every screen.
