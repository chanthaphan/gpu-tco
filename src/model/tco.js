// tco.js — Pure TCO model for GPU infrastructure (on-prem vs Azure).
// Single source of truth for all cost math. No React, no side effects — fully testable.
// Defaults and unit rates are sourced in DEFAULTS below (see README / CLAUDE.md).

import { PLATFORMS, DEFAULT_PLATFORM } from './platforms.js';
import { MODELS, DEFAULT_MODEL, REF, SPEED_CLAMP } from './models.js';

export const CONSTANTS = {
  HOURS_PER_YEAR: 8760,
  HORIZON_YEARS: 5,
  MONTHS: 60,
};

// Editable inputs with their sourced defaults.
// NOTE: per-accelerator specs (tokPerGpu, gpusPerNode, nodeCost, nodeKw, azurePaygHr)
// now come from the selected PLATFORM (see platforms.js). The inputs below are the
// operating/economic assumptions that apply regardless of platform.
export const DEFAULTS = {
  // Platform selector (worked example — see platforms.js)
  platform: DEFAULT_PLATFORM,

  // LLM being served (see models.js); custom* inputs apply when llm === 'custom'
  llm: DEFAULT_MODEL,
  customTokPerGpu: 2200, // tok/s/GPU on the H200 reference platform
  customWeightsGb: 355,  // serving-precision weights footprint

  // Workload — demandMode 'direct' uses tpm; 'derived' computes it from the inputs below
  demandMode: 'direct',
  tpm: 10,            // million tokens per minute (target throughput)
  dauK: 300,          // daily active users (thousands)
  reqPerUser: 8,      // requests per user per day
  tokPerReq: 2000,    // tokens per request (input + output)
  peakFactor: 3,      // peak-to-average traffic ratio (fleet sized at peak)
  util: 70,           // % utilization target (fleet sized to this)

  // Memory fit: % of serving-unit HBM reserved for KV cache / activations / framework
  kvHeadroomPct: 30,

  // Hidden sensitivity handles (not in CONTROLS; used by sensitivityTornado)
  perfMult: 1,        // multiplies effective tok/s/GPU
  nodeCostMult: 1,    // multiplies platform node cost

  // On-prem hardware (non-platform)
  netStorage: 1600000,// USD total: InfiniBand NDR + ~1PB NVMe + racks

  // On-prem operating
  pue: 1.5,           // power usage effectiveness (air-cooled datacenter)
  elecRate: 0.13,     // USD/kWh blended industrial rate — set to your local tariff
  coloRate: 200,      // USD/kW/month, high-density AI colocation
  maintPct: 10,       // %/yr of hardware CAPEX
  fte: 4,             // SRE/infra headcount
  ftecost: 45000,     // USD/yr loaded per FTE — adjust to local labor market
  spares: 1000000,    // USD total spares/refresh buffer

  // Azure reserved discounts (PAYG rate comes from the platform)
  ri1Disc: 35,        // % 1-yr reserved discount (proxy from H100 [ref 12])
  ri3Disc: 55,        // % 3-yr reserved discount (proxy from H100 [ref 12])
  egress: 7.5,        // % uplift for egress + premium storage
};

// Slider/control metadata [key, label, min, max, step, unit, formatterFn, when?].
// The optional 8th element is a predicate when(s) — the slider renders only if it
// returns true for the current inputs (used for mode-dependent controls).
// The 'platform' / 'llm' selectors are rendered separately (choices, not sliders).
export const CONTROLS = [
  ['Workload', [
    ['tpm', 'Throughput', 1, 50, 1, 'M TPM', v => String(v), s => s.demandMode !== 'derived'],
    ['dauK', 'Daily active users', 10, 5000, 10, 'K', v => String(v), s => s.demandMode === 'derived'],
    ['reqPerUser', 'Requests /user/day', 1, 100, 1, '', v => String(v), s => s.demandMode === 'derived'],
    ['tokPerReq', 'Tokens /request', 200, 20000, 100, 'tok', v => String(v), s => s.demandMode === 'derived'],
    ['peakFactor', 'Peak / average', 1, 6, 0.1, '×', v => v.toFixed(1), s => s.demandMode === 'derived'],
    ['util', 'Utilization target', 20, 100, 5, '%', v => String(v)],
  ]],
  ['LLM Serving', [
    ['customTokPerGpu', 'Custom tok/s/GPU (H200 ref)', 200, 8000, 50, 'tok/s', v => String(v), s => s.llm === 'custom'],
    ['customWeightsGb', 'Custom model weights', 20, 1500, 5, 'GB', v => String(v), s => s.llm === 'custom'],
    ['kvHeadroomPct', 'KV/batch headroom', 10, 60, 5, '%', v => String(v)],
  ]],
  ['On-Prem · Hardware', [
    ['netStorage', 'Network/storage/racks', 500000, 4000000, 100000, '', v => '$' + (v / 1e6).toFixed(1) + 'M'],
  ]],
  ['On-Prem · Operating', [
    ['pue', 'PUE', 1.1, 2.0, 0.05, '', v => v.toFixed(2)],
    ['elecRate', 'Electricity', 0.05, 0.3, 0.01, '$/kWh', v => v.toFixed(2)],
    ['coloRate', 'Colocation', 100, 400, 10, '$/kW/mo', v => String(v)],
    ['maintPct', 'Maintenance /yr', 5, 20, 1, '%', v => String(v)],
    ['fte', 'Staff (FTE)', 1, 12, 1, 'FTE', v => String(v)],
    ['ftecost', 'Cost per FTE/yr', 25000, 90000, 5000, '', v => '$' + (v / 1000).toFixed(0) + 'K'],
    ['spares', 'Spares buffer', 0, 3000000, 100000, '', v => '$' + (v / 1e6).toFixed(1) + 'M'],
  ]],
  ['Azure', [
    ['ri1Disc', '1-yr RI discount', 0, 70, 1, '%', v => String(v)],
    ['ri3Disc', '3-yr RI discount', 0, 70, 1, '%', v => String(v)],
    ['egress', 'Egress + storage uplift', 0, 20, 0.5, '%', v => v.toFixed(1)],
  ]],
];

/** Resolve the selected LLM (unknown id falls back to the default model). */
export function resolveLlm(s) {
  return MODELS[s.llm] || MODELS[DEFAULT_MODEL];
}

/**
 * Throughput multiplier vs the platform's calibrated tokPerGpu (see models.js).
 * Catalog models: bandwidth-bound scaling from active-weight bytes, clamped.
 * Custom: user-set tok/s/GPU relative to the H200 reference — platform ratios
 * encode hardware capability, so the factor carries across platforms unclamped.
 */
export function llmSpeedFactor(s) {
  const model = resolveLlm(s);
  if (model.custom) return s.customTokPerGpu / PLATFORMS.h200.tokPerGpu;
  const raw = (REF.activeB * REF.bytesPerParam) / (model.activeB * model.bytesPerParam);
  return Math.min(Math.max(raw, SPEED_CLAMP[0]), SPEED_CLAMP[1]);
}

/** Effective demand in M tokens/minute — direct slider or derived from workload inputs. */
export function effectiveTpm(s) {
  if (s.demandMode !== 'derived') return s.tpm;
  return (s.dauK * 1000 * s.reqPerUser * s.tokPerReq * s.peakFactor) / 1440 / 1e6;
}

/**
 * Does the model fit the serving unit (node, or NVL72 rack)?
 * Planning-grade: requires kvHeadroomPct of unit HBM free for KV/activations/framework
 * instead of estimating KV cache (too many unknowns: seq len, batch, attention type).
 */
export function memoryFit(s) {
  const plat = PLATFORMS[s.platform] || PLATFORMS[DEFAULT_PLATFORM];
  const model = resolveLlm(s);
  const weightsGb = model.custom ? s.customWeightsGb : model.weightsGb;
  const nodeHbmGb = plat.hbmGb * plat.gpusPerNode;
  const usableGb = nodeHbmGb * (1 - s.kvHeadroomPct / 100);
  const headroomGb = nodeHbmGb - weightsGb;
  const headroomPct = (headroomGb / nodeHbmGb) * 100;
  const status = weightsGb > nodeHbmGb ? 'no-fit' : weightsGb > usableGb ? 'tight' : 'fits';
  const minUnits = Math.max(1, Math.ceil(weightsGb / usableGb));
  return {
    weightsGb, nodeHbmGb, usableGb, headroomGb, headroomPct, status, minUnits,
    unitLabel: plat.rackBased ? 'rack' : 'node',
  };
}

/**
 * Compute the full TCO model from a set of inputs.
 * @param {object} s - inputs (see DEFAULTS for shape); s.platform selects the accelerator.
 * @returns {object} derived metrics (all costs in USD unless noted)
 */
export function computeModel(s) {
  const { HOURS_PER_YEAR, HORIZON_YEARS } = CONSTANTS;
  const plat = PLATFORMS[s.platform] || PLATFORMS[DEFAULT_PLATFORM];

  // --- Sizing (platform- and LLM-aware) ---
  const speedFactor = llmSpeedFactor(s);
  const effTokPerGpu = plat.tokPerGpu * speedFactor * (s.perfMult ?? 1);
  const tpmEff = effectiveTpm(s);
  const targetTokS = (tpmEff * 1e6) / 60;
  const rawCap = targetTokS / (s.util / 100);
  const nodes = Math.ceil(rawCap / (effTokPerGpu * plat.gpusPerNode));
  const gpus = nodes * plat.gpusPerNode;

  // --- On-prem 5-year ---
  const servers = nodes * plat.nodeCost * (s.nodeCostMult ?? 1);
  const capex = servers + s.netStorage;
  const fleetKw = nodes * plat.nodeKw;
  const elecUsd = fleetKw * s.pue * HOURS_PER_YEAR * HORIZON_YEARS * s.elecRate;
  const colo = fleetKw * s.coloRate * 12 * HORIZON_YEARS;
  const maint = capex * (s.maintPct / 100) * HORIZON_YEARS;
  const staff = s.fte * s.ftecost * HORIZON_YEARS;
  const opex = elecUsd + colo + maint + staff + s.spares;
  const onprem = capex + opex;
  const onpremMonthlyOpex = opex / (HORIZON_YEARS * 12);

  // --- Azure 5-year (same node count; platform's SKU rate) ---
  const uplift = 1 + s.egress / 100;
  const azTotal = (rate) => rate * nodes * HOURS_PER_YEAR * HORIZON_YEARS * uplift;
  const payg = azTotal(plat.azurePaygHr);
  const ri1 = azTotal(plat.azurePaygHr * (1 - s.ri1Disc / 100));
  const ri3 = azTotal(plat.azurePaygHr * (1 - s.ri3Disc / 100));

  // --- Break-even (months): CAPEX / (azure_monthly - onprem_monthly_opex) ---
  const breakEven = (azTot) => {
    const azMonthly = azTot / (HORIZON_YEARS * 12);
    return azMonthly > onpremMonthlyOpex ? capex / (azMonthly - onpremMonthlyOpex) : null;
  };

  return {
    platform: plat, llm: resolveLlm(s), speedFactor, effTokPerGpu, tpmEff, fit: memoryFit(s),
    targetTokS, rawCap, nodes, gpus,
    servers, capex, fleetKw, elecUsd, colo, maint, staff, opex, onprem, onpremMonthlyOpex,
    payg, ri1, ri3,
    bePayg: breakEven(payg), beRi1: breakEven(ri1), beRi3: breakEven(ri3),
  };
}

/** 5-yr TCO ($M) for each option as demand sweeps a TPM range (node-count step curve). */
export function tcoVsThroughput(s, { min = 1, max = 50, step = 1 } = {}) {
  const rows = [];
  for (let tpm = min; tpm <= max; tpm += step) {
    const m = computeModel({ ...s, demandMode: 'direct', tpm });
    rows.push({ tpm, onprem: m.onprem / 1e6, ri3: m.ri3 / 1e6, payg: m.payg / 1e6, nodes: m.nodes });
  }
  return rows;
}

/**
 * Tornado: on-prem 5-yr TCO when each driver moves ±pct from its current value,
 * ranked by impact. TPM varies via a direct-mode override so it works in either
 * demand mode; util is clamped to 100.
 */
export function sensitivityTornado(s, pct = 0.2) {
  const base = computeModel(s).onprem;
  const tpmEff = effectiveTpm(s);
  const at = (key, mult) =>
    computeModel(
      key === 'tpm'
        ? { ...s, demandMode: 'direct', tpm: tpmEff * mult }
        : { ...s, [key]: key === 'util' ? Math.min(s[key] * mult, 100) : s[key] * mult },
    ).onprem;
  const drivers = [
    ['tpm', 'Throughput (TPM)'],
    ['util', 'Utilization target'],
    ['perfMult', 'GPU throughput'],
    ['nodeCostMult', 'Node cost'],
    ['netStorage', 'Network/storage'],
    ['pue', 'PUE'],
    ['elecRate', 'Electricity rate'],
    ['coloRate', 'Colocation rate'],
    ['maintPct', 'Maintenance %'],
    ['ftecost', 'Cost per FTE'],
    ['spares', 'Spares buffer'],
  ];
  const rows = drivers
    .map(([key, label]) => {
      const low = at(key, 1 - pct);
      const high = at(key, 1 + pct);
      return { key, label, low, high, span: Math.abs(high - low) };
    })
    .sort((a, b) => b.span - a.span);
  return { base, rows };
}

/** 60-month cumulative cost curve for each option (values in USD millions). */
export function cumulativeCurve(m) {
  const { HORIZON_YEARS, MONTHS } = CONSTANTS;
  const opMonthly = m.opex / (HORIZON_YEARS * 12);
  const rows = [];
  for (let mo = 0; mo <= MONTHS; mo++) {
    rows.push({
      month: mo,
      onprem: (m.capex + opMonthly * mo) / 1e6,
      payg: (m.payg / MONTHS * mo) / 1e6,
      ri1: (m.ri1 / MONTHS * mo) / 1e6,
      ri3: (m.ri3 / MONTHS * mo) / 1e6,
    });
  }
  return rows;
}

/** Effective $/million-tokens across utilization levels (sensitivity). */
export function sensitivityByUtilization(m, utils = [20, 30, 40, 50, 60, 70, 80, 90, 100]) {
  const { HORIZON_YEARS, HOURS_PER_YEAR } = CONSTANTS;
  const secs = HORIZON_YEARS * HOURS_PER_YEAR * 3600;
  return utils.map((u) => {
    const tokensM = (m.rawCap * (u / 100) * secs) / 1e6;
    return {
      util: u,
      onprem: m.onprem / tokensM,
      ri3: m.ri3 / tokensM,
      payg: m.payg / tokensM,
    };
  });
}

// --- Formatting helpers ---
export const fmtUsdM = (v) => '$' + (v / 1e6).toFixed(1) + 'M';
export const fmtBreakEven = (v) => (v == null ? 'never' : `~${v.toFixed(0)} mo`);
