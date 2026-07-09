# CLAUDE.md — Project Context for Claude Code

This file gives Claude Code the context it needs to work on this project effectively.
Read it before making changes.

## What this is

An interactive **GPU Infrastructure Total Cost of Ownership (TCO) calculator** for teams
weighing an on-prem GPU build against cloud. It compares the 5-year cost of serving a large
open-source Mixture-of-Experts LLM at **10 million tokens per minute (10M TPM)** across:

- **On-premise NVIDIA H200** (the default build), plus H100 / B200 / GB200 NVL72 /
  Huawei Ascend 910C platforms
- **Azure ND H200 v5** — pay-as-you-go, 1-year Reserved, 3-year Reserved

The default (reference model A) is **GLM-5.2** (753B/40B MoE); **DeepSeek-V3/R1** is
reference model B. GLM-4.5 remains the throughput *calibration anchor* (speedFactor 1.0).
It computes fleet sizing, itemized 5-year TCO, break-even timelines, and a
utilization-sensitivity curve, all updating live as the user drags sliders.

**Huawei Ascend is included in the cost math with a mandatory legal caution** (added on
explicit user instruction, 10 Jul 2026, at gray-market planning rates). A 13 May 2025 US
BIS GP10 ruling makes using Ascend 910-series chips anywhere in the world an
export-control violation — a material sanctions risk for regulated or USD-clearing
institutions. The `caution` field on the ascend platform entry is surfaced in the UI and
report wherever Ascend appears; **do not remove or soften that warning**, and keep the
legal framing prominent in any output that shows Ascend costs.

## Architecture

```
src/
  model/
    tco.js                 ← THE MODEL. Pure functions, no React. Single source of truth.
    platforms.js           ← Accelerator definitions (H100/H200/B200/GB200). WORKED EXAMPLE.
    models.js              ← LLM catalog (GLM-4.5/DeepSeek/Qwen3/Llama-4/GPT-OSS + custom).
    apiPrices.js           ← Public API $/M-token benchmarks (reference lines).
    __tests__/tco.test.js  ← Vitest unit tests pinning the original model behavior.
    __tests__/extensions.test.js ← Tests for LLM scaling, workload builder, new plots.
  components/
    UI.jsx                 ← Presentational components (Slider, Section, Stat, Card, PlatformSelector).
  i18n.js                  ← EN/$ ↔ ไทย/฿ locale strings + money formatters (display-layer only).
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
  Includes two *hidden* sensitivity handles not exposed as sliders: `perfMult` (multiplies
  effective tok/s/GPU) and `nodeCostMult` (multiplies node cost) — both 1 by default, used
  only by `sensitivityTornado` to vary platform-derived quantities.
- `CONTROLS` — slider metadata `[key, label, min, max, step, unit, formatterFn, when?]`;
  this array drives the UI, so adding an input = add to `DEFAULTS` + `CONTROLS`. The
  optional `when(s)` predicate hides mode-dependent sliders (direct-vs-derived demand,
  custom-model inputs).
- `computeModel(inputs)` — returns sizing + all cost figures + break-even months + `llm`,
  `speedFactor`, `effTokPerGpu`, `tpmEff`, `fit`.
- `resolveLlm(s)` / `llmSpeedFactor(s)` — selected LLM and its throughput multiplier.
- `effectiveTpm(s)` — demand in M TPM (direct slider, or derived from workload inputs).
- `memoryFit(s)` — weights-vs-HBM fit check per serving unit (node / NVL72 rack).
- `cumulativeCurve(model)` — 61 monthly points for the break-even line chart.
- `sensitivityByUtilization(model)` — effective $/M-tokens at each utilization level.
- `tcoVsThroughput(s, {min,max,step})` — TCO sweep across TPM (node-count step curve).
- `sensitivityTornado(s, pct)` — on-prem TCO impact of each driver at ±pct, ranked.
- `platformMatrix(s)` — per-platform rows (eff. tok/s/GPU, fleet, on-prem TCO, fit)
  for the selected LLM; drives the model spec/performance card.

### Core formulas (keep these correct)
- `speedFactor = clamp(REF.activeB*REF.bytesPerParam / (activeB*bytesPerParam), 0.25, 4)`
  — decode is HBM-bandwidth-bound; platform `tokPerGpu` is calibrated to GLM-4.5
  (32B active, FP8), so GLM-4.5 is exactly 1.0. Custom model: `customTokPerGpu / 2200`
  (H200-referenced, unclamped). First-order rule only — ignores prefill, KV bandwidth,
  EP efficiency, multi-node penalties.
- `effectiveTpm` (derived mode) = `dauK*1000 * reqPerUser * tokPerReq * peakFactor / 1440 / 1e6`
  — defaults (300K DAU × 8 req × 2000 tok × 3.0 peak) reproduce exactly 10M TPM.
- `rawCapacity = (effectiveTpm * 1e6 / 60) / (util/100)`  — tokens/sec to provision
- `nodes = ceil(rawCapacity / (tokPerGpu * speedFactor * gpusPerNode))`
- Memory fit: `usable = hbmGb*gpusPerNode*(1 − kvHeadroomPct/100)`; no-fit if weights >
  unit HBM, tight if weights > usable. Headroom-% by design — no KV-cache formula.
- On-prem 5-yr = CAPEX (servers + net/storage) + OPEX (electricity + colo + maintenance
  + staff + spares). Electricity = `fleetKw * pue * 8760 * 5 * elecRate` (USD/kWh).
- Azure 5-yr = `rate/hr * nodes * 8760 * 5 * (1 + egress%)`
- Break-even months = `CAPEX / (azureMonthly − onpremMonthlyOpex)` (null if Azure is
  cheaper monthly, which shouldn't happen at high util).
- API benchmark blend = `0.75*input + 0.25*output` per M tokens (3:1 mix; directional
  comparison only — APIs bill actual tokens with no idle cost).

## Sourced default assumptions (do not silently change)

| Input | Default | Source |
|---|---|---|
| tokPerGpu (H200) | 2200 tok/s | vLLM wide-EP, CoreWeave H200 cluster (Dec 2025) |
| nodeCost | $340,000 / 8×H200 | market estimate |
| ascend nodeCost / tokPerGpu | $220,000 / 1300 tok/s | gray-market planning estimate (~180–200K CNY/chip reported); derated from Huawei CloudMatrix-Infer 1,943 tok/s decode |
| elecRate | $0.13/kWh | blended industrial rate — users should set their local tariff |
| coloRate | $200/kW/mo | high-density AI colo, metro-market estimate |
| paygHr | $110.24/hr/node | Azure ND96isr H200 v5, Vantage 6-Jul-2026 |
| ri1Disc / ri3Disc | 35% / 55% | proxied from Azure H100 reserved discounts |
| LLM catalog (models.js) | params/precision/weights per model | published model cards; throughput derived via speedFactor rule |
| hbmGb (platforms.js) | 80 / 141 / 192 / 186 GB per GPU | vendor specs; GB200 figure is a planning estimate |
| API prices (apiPrices.js) | DeepSeek V4 Flash $0.14/$0.28 · GLM-4.5 $0.60/$2.20 · GPT-5.4 $2.50/$15 | provider pricing pages, verified Jul 2026 |

Azure H200 reserved rates are **proxies** (Microsoft hadn't published ND H200 v5 RI rates
as of July 2026). If you wire in real rates, update the comment and the README.
API list prices drift — re-verify `apiPrices.js` and bump each entry's `asOf` when touched.

## Conventions

- Plain inline styles + a small palette in `components/UI.jsx` (`COLORS`). No CSS framework.
- Charts use **recharts**. Keep them responsive (`ResponsiveContainer`).
- No browser storage APIs unless asked. Keep everything in React state.
- Run `npm test` after any model change — the tests encode the expected defaults
  (GLM-5.2 default: 17 nodes / 136 GPUs, ~$16.5M on-prem total; GLM-4.5 anchor:
  speedFactor exactly 1.0 → 14 nodes).

## Good first tasks / likely requests

- ✅ **B200 / GB200 platform switcher** — DONE (see `platforms.js`; use it as the template).
- ✅ **LLM model catalog + custom entry** — DONE (`models.js`, speedFactor scaling).
- ✅ **Workload builder** (derive TPM from DAU/requests/tokens/peak) — DONE.
- ✅ **TCO-vs-throughput, tornado, API benchmark, memory-fit plots** — DONE.
- Add **"export scenario to CSV/JSON"** button (serialize current `s` + `computeModel`).
- Add **save/compare two scenarios** side-by-side.
- ✅ **EN/$ ↔ ไทย/฿ locale toggle** — DONE (`src/i18n.js`; display-layer only, model stays
  USD-native, THB converts at `FX_THB` 33.4).
- Wire in **real Azure ND H200 v5 reserved pricing** when published.

## Commands

```bash
npm install      # first time
npm run dev      # local dev server (Vite, hot reload)
npm test         # run model unit tests (Vitest)
npm run build    # production build → dist/
npm run preview  # preview the production build
```
