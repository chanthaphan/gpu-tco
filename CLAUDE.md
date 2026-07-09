# CLAUDE.md — Project Context for Claude Code

This file gives Claude Code the context it needs to work on this project effectively.
Read it before making changes.

## What this is

An interactive **GPU Infrastructure Total Cost of Ownership (TCO) calculator** for teams
weighing an on-prem GPU build against cloud. It compares the 5-year cost of serving a large
open-source Mixture-of-Experts LLM (GLM-4.5 / DeepSeek-class) at **10 million tokens per
minute (10M TPM)** across:

- **On-premise NVIDIA H200** (the default build)
- **Azure ND H200 v5** — pay-as-you-go, 1-year Reserved, 3-year Reserved

It computes fleet sizing, itemized 5-year TCO, break-even timelines, and a
utilization-sensitivity curve, all updating live as the user drags sliders.

**Huawei Ascend is deliberately excluded from the cost math** — not for performance
reasons but legal ones: a 13 May 2025 US BIS ruling makes using Ascend 910-series chips
anywhere in the world an export-control violation, an unacceptable sanctions risk for most
enterprises (especially regulated or USD-clearing institutions). Do not add Ascend as a
cost option without an explicit instruction that accounts for this; a *disabled/annotated*
comparison entry is acceptable, a live cost recommendation is not.

## Architecture

```
src/
  model/
    tco.js                 ← THE MODEL. Pure functions, no React. Single source of truth.
    platforms.js           ← Accelerator definitions (H100/H200/B200/GB200). WORKED EXAMPLE.
    __tests__/tco.test.js  ← Vitest unit tests for the model.
  components/
    UI.jsx                 ← Presentational components (Slider, Section, Stat, Card, PlatformSelector).
  App.jsx                  ← Wires model → recharts visualizations. State lives here.
  main.jsx                 ← React entry point.
index.html                 ← Vite HTML entry.
.github/workflows/test.yml ← CI: runs tests + build on every push/PR.
.github/workflows/deploy.yml ← Deploys dist/ to GitHub Pages on push to main.
```

## Worked example: the platform switcher (READ THIS to learn the extension pattern)

`src/model/platforms.js` is a deliberately-included reference implementation showing how to
add a new dimension to the calculator. It demonstrates the intended pattern end-to-end:

1. **Data lives in a dedicated module** (`platforms.js`) with each platform's specs
   (`tokPerGpu`, `gpusPerNode`, `nodeCost`, `nodeKw`, `azurePaygHr`, `rackBased`) and sources.
2. **The model consumes it** — `computeModel()` reads `PLATFORMS[s.platform]` and falls back
   to the default for unknown ids. No platform math is duplicated into components.
3. **The UI exposes it** — `PlatformSelector` in `UI.jsx`, rendered at the top of the controls
   in `App.jsx`, wired with the same `set('platform')` state setter as the sliders.
4. **Tests pin the behavior** — see the "platform switching" block in `tco.test.js`
   (H100 needs more nodes than H200, GB200 is rack-based, unknown id falls back, etc.).

**Follow this same 4-step pattern** (data module → model reads it → UI control → tests) for any
new feature: CSV export, scenario compare, a currency toggle, etc.

**Golden rule: all cost/sizing logic lives in `src/model/tco.js` and nowhere else.**
Components and `App.jsx` only *display* what the model returns. If you change a formula,
change it in `tco.js` and update the tests. Never duplicate math into a component.

## The model (src/model/tco.js)

- `DEFAULTS` — every editable input with its sourced default value (see comments inline).
- `CONTROLS` — slider metadata `[key, label, min, max, step, unit, formatterFn]`; this
  array drives the UI, so adding an input = add to `DEFAULTS` + `CONTROLS`.
- `computeModel(inputs)` — returns sizing + all cost figures + break-even months.
- `cumulativeCurve(model)` — 61 monthly points for the break-even line chart.
- `sensitivityByUtilization(model)` — effective $/M-tokens at each utilization level.

### Core formulas (keep these correct)
- `rawCapacity = (tpm * 1e6 / 60) / (util/100)`  — tokens/sec to provision
- `nodes = ceil(rawCapacity / (tokPerGpu * 8))`
- On-prem 5-yr = CAPEX (servers + net/storage) + OPEX (electricity + colo + maintenance
  + staff + spares). Electricity = `fleetKw * pue * 8760 * 5 * elecRate` (USD/kWh).
- Azure 5-yr = `rate/hr * nodes * 8760 * 5 * (1 + egress%)`
- Break-even months = `CAPEX / (azureMonthly − onpremMonthlyOpex)` (null if Azure is
  cheaper monthly, which shouldn't happen at high util).

## Sourced default assumptions (do not silently change)

| Input | Default | Source |
|---|---|---|
| tokPerGpu (H200) | 2200 tok/s | vLLM wide-EP, CoreWeave H200 cluster (Dec 2025) |
| nodeCost | $340,000 / 8×H200 | market estimate |
| elecRate | $0.13/kWh | blended industrial rate — users should set their local tariff |
| coloRate | $200/kW/mo | high-density AI colo, metro-market estimate |
| paygHr | $110.24/hr/node | Azure ND96isr H200 v5, Vantage 6-Jul-2026 |
| ri1Disc / ri3Disc | 35% / 55% | proxied from Azure H100 reserved discounts |

Azure H200 reserved rates are **proxies** (Microsoft hadn't published ND H200 v5 RI rates
as of July 2026). If you wire in real rates, update the comment and the README.

## Conventions

- Plain inline styles + a small palette in `components/UI.jsx` (`COLORS`). No CSS framework.
- Charts use **recharts**. Keep them responsive (`ResponsiveContainer`).
- No browser storage APIs unless asked. Keep everything in React state.
- Run `npm test` after any model change — the tests encode the expected defaults
  (e.g. 14 nodes / 112 GPUs, ~$14.4M on-prem total).

## Good first tasks / likely requests

- ✅ **B200 / GB200 platform switcher** — DONE (see `platforms.js`; use it as the template).
- Add **"export scenario to CSV/JSON"** button (serialize current `s` + `computeModel`).
- Add **save/compare two scenarios** side-by-side.
- Add a **currency toggle** on all chart axes (USD + one user-configured local currency).
- Wire in **real Azure ND H200 v5 reserved pricing** when published.

## Commands

```bash
npm install      # first time
npm run dev      # local dev server (Vite, hot reload)
npm test         # run model unit tests (Vitest)
npm run build    # production build → dist/
npm run preview  # preview the production build
```
