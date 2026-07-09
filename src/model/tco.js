// tco.js — Pure TCO model for GPU infrastructure (on-prem vs Azure).
// Single source of truth for all cost math. No React, no side effects — fully testable.
// Defaults and unit rates are sourced in DEFAULTS below (see README / CLAUDE.md).

import { PLATFORMS, DEFAULT_PLATFORM } from './platforms.js';

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

  // Workload
  tpm: 10,            // million tokens per minute (target throughput)
  util: 70,           // % utilization target (fleet sized to this)

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

// Slider/control metadata [key, label, min, max, step, unit, formatterFn].
// The 'platform' selector is rendered separately (it's a choice, not a slider).
export const CONTROLS = [
  ['Workload', [
    ['tpm', 'Throughput', 1, 50, 1, 'M TPM', v => String(v)],
    ['util', 'Utilization target', 20, 100, 5, '%', v => String(v)],
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

/**
 * Compute the full TCO model from a set of inputs.
 * @param {object} s - inputs (see DEFAULTS for shape); s.platform selects the accelerator.
 * @returns {object} derived metrics (all costs in USD unless noted)
 */
export function computeModel(s) {
  const { HOURS_PER_YEAR, HORIZON_YEARS } = CONSTANTS;
  const plat = PLATFORMS[s.platform] || PLATFORMS[DEFAULT_PLATFORM];

  // --- Sizing (platform-aware) ---
  const targetTokS = (s.tpm * 1e6) / 60;
  const rawCap = targetTokS / (s.util / 100);
  const nodes = Math.ceil(rawCap / (plat.tokPerGpu * plat.gpusPerNode));
  const gpus = nodes * plat.gpusPerNode;

  // --- On-prem 5-year ---
  const servers = nodes * plat.nodeCost;
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
    platform: plat,
    targetTokS, rawCap, nodes, gpus,
    servers, capex, fleetKw, elecUsd, colo, maint, staff, opex, onprem, onpremMonthlyOpex,
    payg, ri1, ri3,
    bePayg: breakEven(payg), beRi1: breakEven(ri1), beRi3: breakEven(ri3),
  };
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
