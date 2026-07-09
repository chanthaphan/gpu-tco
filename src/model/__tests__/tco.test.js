import { describe, it, expect } from 'vitest';
import { computeModel, cumulativeCurve, sensitivityByUtilization, DEFAULTS, CONSTANTS } from '../tco.js';
import { PLATFORMS } from '../platforms.js';

describe('computeModel — sizing', () => {
  it('sizes 17 H200 nodes for the default GLM-5.2 @ 10M TPM, 70% util', () => {
    const m = computeModel(DEFAULTS);
    expect(m.nodes).toBe(17);
    expect(m.gpus).toBe(136);
  });

  it('raw capacity = target / utilization', () => {
    const m = computeModel(DEFAULTS);
    expect(m.rawCap).toBeCloseTo((10e6 / 60) / 0.70, 2);
  });

  it('scales node count up when throughput doubles', () => {
    const m = computeModel({ ...DEFAULTS, tpm: 20 });
    expect(m.nodes).toBe(34);
  });

  it('needs more nodes at lower utilization target', () => {
    const hi = computeModel({ ...DEFAULTS, util: 90 });
    const lo = computeModel({ ...DEFAULTS, util: 40 });
    expect(lo.nodes).toBeGreaterThan(hi.nodes);
  });
});

describe('computeModel — on-prem TCO', () => {
  const m = computeModel(DEFAULTS);

  it('5-year on-prem total lands near $16.5M (GLM-5.2 baseline)', () => {
    expect(m.onprem / 1e6).toBeGreaterThan(15);
    expect(m.onprem / 1e6).toBeLessThan(18);
  });

  it('CAPEX = servers + networking/storage', () => {
    expect(m.capex).toBe(m.servers + DEFAULTS.netStorage);
  });

  it('electricity = fleet kW × PUE × hours × years × rate', () => {
    const expected = m.fleetKw * DEFAULTS.pue * CONSTANTS.HOURS_PER_YEAR * CONSTANTS.HORIZON_YEARS * DEFAULTS.elecRate;
    expect(m.elecUsd).toBeCloseTo(expected, 2);
  });
});

describe('computeModel — Azure & break-even', () => {
  const m = computeModel(DEFAULTS);

  it('PAYG > 1-yr RI > 3-yr RI', () => {
    expect(m.payg).toBeGreaterThan(m.ri1);
    expect(m.ri1).toBeGreaterThan(m.ri3);
  });

  it('on-prem is cheaper than all Azure options at default 24/7 util', () => {
    expect(m.onprem).toBeLessThan(m.ri3);
  });

  it('produces finite break-even months, PAYG crossing soonest', () => {
    expect(m.bePayg).toBeGreaterThan(0);
    expect(m.beRi1).toBeGreaterThan(0);
    expect(m.beRi3).toBeGreaterThan(0);
    expect(m.bePayg).toBeLessThan(m.beRi3);
  });
});

describe('platform switching (worked example)', () => {
  it('defaults to H200', () => {
    const m = computeModel(DEFAULTS);
    expect(m.platform.id).toBe('h200');
  });

  it('H100 needs more nodes than H200 for the same workload', () => {
    const h100 = computeModel({ ...DEFAULTS, platform: 'h100' });
    const h200 = computeModel({ ...DEFAULTS, platform: 'h200' });
    expect(h100.nodes).toBeGreaterThan(h200.nodes);
  });

  it('GB200 is rack-based (72 GPUs per unit) and needs the fewest units', () => {
    const gb200 = computeModel({ ...DEFAULTS, platform: 'gb200' });
    expect(gb200.platform.gpusPerNode).toBe(72);
    expect(gb200.nodes).toBeLessThanOrEqual(2);
  });

  it('every platform produces a positive on-prem total', () => {
    for (const id of Object.keys(PLATFORMS)) {
      const m = computeModel({ ...DEFAULTS, platform: id });
      expect(m.onprem).toBeGreaterThan(0);
      expect(m.gpus).toBeGreaterThan(0);
    }
  });

  it('falls back to H200 for an unknown platform id', () => {
    const m = computeModel({ ...DEFAULTS, platform: 'nonexistent' });
    expect(m.platform.id).toBe('h200');
  });
});

describe('curves & sensitivity', () => {
  const m = computeModel(DEFAULTS);

  it('cumulative curve has 61 monthly points starting at CAPEX', () => {
    const c = cumulativeCurve(m);
    expect(c.length).toBe(61);
    expect(c[0].onprem).toBeCloseTo(m.capex / 1e6, 3);
    expect(c[0].payg).toBe(0);
  });

  it('sensitivity: on-prem $/token falls as utilization rises', () => {
    const s = sensitivityByUtilization(m);
    expect(s[0].onprem).toBeGreaterThan(s[s.length - 1].onprem);
  });
});
