# GPU Infrastructure TCO Calculator

Interactive 5-year Total Cost of Ownership calculator comparing **on-premise GPU builds**
(NVIDIA H100/H200/B200/GB200) against **Azure ND H200 v5** (PAYG / 1-yr RI / 3-yr RI)
and **Azure MaaS** for serving a large open-source MoE LLM (GLM-5.2 baseline,
DeepSeek-V3/R1 reference) at **10M tokens/minute**.

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
- **LLM model selector** — pick the model you're serving (GLM-4.5, GLM-5.2,
  DeepSeek-V3/R1, Qwen3-235B, Llama 4 Maverick, GPT-OSS-120B, or Custom); throughput
  per GPU scales automatically from active-weight bytes (decode is bandwidth-bound).
- **Model spec & platform matrix** — the selected model's full specification (params,
  precision, weights, context, license) plus per-platform performance: effective
  tok/s/GPU, fleet size, on-prem 5-yr TCO, and memory fit on every accelerator.
- **Workload builder** — enter TPM directly, or derive it from DAU × requests/day ×
  tokens/request × peak factor.
- **GPU memory fit check** — flags models that don't fit one node's HBM (or leave no
  KV/batching headroom) on the selected platform.
- **5-year TCO comparison** — on-prem vs the three Azure options.
- **On-prem cost breakdown** — servers, networking, electricity, colo, maintenance, staff, spares.
- **TCO vs throughput** — how costs and the node-count step function scale from 1–50M TPM.
- **Break-even curve** — cumulative cost over 60 months, with the crossover month marked.
- **Sensitivity** — effective $/million-tokens across utilization levels (the key decision
  variable), with published API prices (DeepSeek, GLM, GPT-class) as reference lines.
- **Azure MaaS comparison** — what the same token volume costs as pay-per-token
  Model-as-a-Service (GPT-5.5 and Claude Sonnet 5 on Microsoft Foundry), with the
  break-even volume below which MaaS beats building.
- **Sensitivity tornado** — which assumption moves on-prem TCO the most at ±20%.
- **EN/$ ↔ ไทย/฿ toggle** — switches the UI language and converts all money displays to
  THB at 33.4/USD. Inputs and the model stay USD-native; the conversion is display-only.

Everything recomputes live as you drag the sliders.

## Project layout

```
src/
  model/tco.js              ← all cost/sizing math (pure, tested). Edit formulas HERE.
  model/platforms.js        ← H100/H200/B200/GB200 specs. Worked example for extending the model.
  model/models.js           ← LLM catalog + throughput scaling rule.
  model/apiPrices.js        ← public API $/M-token benchmarks (sourced, dated).
  model/__tests__/          ← Vitest unit tests (43 tests).
  components/UI.jsx          ← Slider, Section, Stat, Card, SelectorGrid, MemoryFitBar.
  App.jsx                    ← wires model → charts.
CLAUDE.md                    ← context for Claude Code (read this).
.github/workflows/test.yml   ← CI: tests + build run on every push/PR.
.github/workflows/deploy.yml ← deploys to GitHub Pages on push to main.
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

**Model throughput scaling** is a first-order bandwidth rule: platform tok/s/GPU is
calibrated to GLM-4.5 (32B active, FP8) and scaled by active-weight bytes for other
models (clamped ×0.25–×4). It ignores prefill, KV bandwidth, and multi-node penalties —
benchmark your model on your own traffic before committing capital.

**Huawei Ascend** is excluded from the cost math (13 May 2025 US BIS worldwide-use
ruling). **B200/GB200 throughput** is derated from SemiAnalysis InferenceX DeepSeek-R1
measurements (2,558 / 5,790 tok/s/GPU at 75 tok/s/user, verified Jul 2026); note GB200
falls to ~3,988 at a stricter 120 tok/s/user SLO. See `CLAUDE.md`.

## Caveats

All figures are planning estimates. Inference throughput varies 2–3× with sequence length,
batch size, and latency SLO. Benchmark on your own traffic mix before committing capital.
