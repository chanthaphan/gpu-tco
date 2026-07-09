# GPU Infrastructure TCO Calculator

Interactive 5-year Total Cost of Ownership calculator comparing **on-premise NVIDIA H200**
against **Azure ND H200 v5** (PAYG / 1-yr RI / 3-yr RI) for serving a large open-source
MoE LLM (GLM-4.5 / DeepSeek class) at **10M tokens/minute**.

Built for AI infrastructure teams weighing on-prem GPU builds against cloud. React + Vite + Recharts.

![status](https://img.shields.io/badge/status-ready-brightgreen)

## Quick start

```bash
npm install
npm run dev      # → http://localhost:5173
```

Then open it in Claude Code to extend:

```bash
claude          # from inside this directory
```

Claude Code will read `CLAUDE.md` automatically for full project context.

## What it shows

- **Fleet sizing** — GPUs/nodes needed for your throughput at a given utilization target.
- **5-year TCO comparison** — on-prem vs the three Azure options.
- **On-prem cost breakdown** — servers, networking, electricity, colo, maintenance, staff, spares.
- **Break-even curve** — cumulative cost over 60 months, with the crossover month marked.
- **Sensitivity** — effective $/million-tokens across utilization levels (the key decision variable).

Everything recomputes live as you drag the sliders.

## Project layout

```
src/
  model/tco.js              ← all cost/sizing math (pure, tested). Edit formulas HERE.
  model/platforms.js        ← H100/H200/B200/GB200 specs. Worked example for extending the model.
  model/__tests__/          ← Vitest unit tests (17 tests).
  components/UI.jsx          ← Slider, Section, Stat, Card, PlatformSelector.
  App.jsx                    ← wires model → charts.
CLAUDE.md                    ← context for Claude Code (read this).
.github/workflows/test.yml   ← CI: tests + build run on every push/PR.
```

Switch accelerator platforms (H100 / H200 / B200 / GB200 NVL72) with the selector at the top
of the controls — fleet sizing and all costs recompute for the chosen hardware.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Local dev server with hot reload |
| `npm test` | Run model unit tests |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build |

## Key assumptions

Defaults are sourced (July 2026 figures) and documented inline in `src/model/tco.js` and
in `CLAUDE.md`. Highlights: H200 at 2,200 tok/s/GPU (vLLM wide-EP), $340K/node,
electricity $0.13/kWh (blended industrial — set to your local tariff), Azure ND H200 v5
$110.24/hr PAYG.

**Note:** Azure H200 *reserved* rates are proxied from published H100 discounts (35%/55%),
since Microsoft had not published ND H200 v5 RI pricing as of July 2026. Update when available.

**Huawei Ascend** is excluded from the cost math on legal grounds (13 May 2025 US BIS
worldwide-use ruling). See `CLAUDE.md`.

## Caveats

All figures are planning estimates. Inference throughput varies 2–3× with sequence length,
batch size, and latency SLO. Benchmark on your own traffic mix before committing capital.
