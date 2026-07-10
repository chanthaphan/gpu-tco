import { describe, it, expect } from 'vitest';
import {
  computeModel, effectiveTpm, llmSpeedFactor, resolveLlm, memoryFit,
  tcoVsThroughput, sensitivityTornado, platformMatrix, maasComparison, DEFAULTS, CONSTANTS,
} from '../tco.js';
import { PLATFORMS, PLATFORM_ORDER } from '../platforms.js';
import { MODELS, SPEED_CLAMP } from '../models.js';
import { API_PRICES, blendedApiPrice, apiBenchmarks, maasBenchmarks, INPUT_SHARE } from '../apiPrices.js';

describe('LLM model selection', () => {
  it('default is GLM-5.2 (reference model A): factor 0.8, 17 H200 nodes', () => {
    expect(llmSpeedFactor(DEFAULTS)).toBeCloseTo(0.8, 10);
    const m = computeModel(DEFAULTS);
    expect(m.nodes).toBe(17);
    expect(m.gpus).toBe(136);
    expect(m.llm.id).toBe('glm52');
  });

  it('GLM-4.5 is the calibration anchor: speedFactor exactly 1 → 14 nodes', () => {
    expect(llmSpeedFactor({ ...DEFAULTS, llm: 'glm45' })).toBe(1);
    expect(computeModel({ ...DEFAULTS, llm: 'glm45' }).nodes).toBe(14);
  });

  it('DeepSeek (reference model B, 37B active) → 16 H200 nodes', () => {
    const m = computeModel({ ...DEFAULTS, llm: 'deepseek' });
    expect(m.nodes).toBe(16);
  });

  it('GLM-5.2 (753 GB) does not fit a single H100 node', () => {
    const fit = memoryFit({ ...DEFAULTS, llm: 'glm52', platform: 'h100' });
    expect(fit.status).toBe('no-fit');
  });

  it('smaller active sets need fewer nodes (Qwen3, Llama 4 Maverick)', () => {
    expect(computeModel({ ...DEFAULTS, llm: 'qwen3' }).nodes).toBe(10);
    expect(computeModel({ ...DEFAULTS, llm: 'llama4mav' }).nodes).toBe(8);
  });

  it('GPT-OSS-120B clamps at the SPEED_CLAMP max', () => {
    expect(llmSpeedFactor({ ...DEFAULTS, llm: 'gptoss' })).toBe(SPEED_CLAMP[1]);
    expect(computeModel({ ...DEFAULTS, llm: 'gptoss' }).nodes).toBe(4);
  });

  it('custom tok/s/GPU is H200-referenced: 1100 tok/s → factor 0.5 → 2× nodes', () => {
    const s = { ...DEFAULTS, llm: 'custom', customTokPerGpu: 1100 };
    expect(llmSpeedFactor(s)).toBe(0.5);
    expect(computeModel(s).nodes).toBe(28);
  });

  it('custom factor preserves relative platform performance (h100 vs h200)', () => {
    const s = { ...DEFAULTS, llm: 'custom', customTokPerGpu: 1100 };
    const h100 = computeModel({ ...s, platform: 'h100' });
    const h200 = computeModel({ ...s, platform: 'h200' });
    expect(h100.effTokPerGpu / h200.effTokPerGpu)
      .toBeCloseTo(PLATFORMS.h100.tokPerGpu / PLATFORMS.h200.tokPerGpu, 10);
  });

  it('unknown llm id falls back to the default model (GLM-5.2)', () => {
    const m = computeModel({ ...DEFAULTS, llm: 'nonexistent' });
    expect(m.llm.id).toBe('glm52');
    expect(m.nodes).toBe(17);
  });

  it('every catalog model produces a positive fleet', () => {
    for (const id of Object.keys(MODELS)) {
      const m = computeModel({ ...DEFAULTS, llm: id });
      expect(m.nodes).toBeGreaterThan(0);
      expect(m.onprem).toBeGreaterThan(0);
    }
  });
});

describe('workload builder (effectiveTpm)', () => {
  it('direct mode passes tpm through', () => {
    expect(effectiveTpm(DEFAULTS)).toBe(10);
    expect(effectiveTpm({ ...DEFAULTS, tpm: 37 })).toBe(37);
  });

  it('derived defaults reproduce exactly 10.0M TPM', () => {
    expect(effectiveTpm({ ...DEFAULTS, demandMode: 'derived' })).toBe(10);
  });

  it('derived TPM is linear in DAU and peak factor', () => {
    const d = { ...DEFAULTS, demandMode: 'derived' };
    expect(effectiveTpm({ ...d, dauK: 600 })).toBeCloseTo(20, 10);
    expect(effectiveTpm({ ...d, peakFactor: 6 })).toBeCloseTo(20, 10);
  });

  it('doubling DAU roughly doubles the fleet', () => {
    const d = { ...DEFAULTS, demandMode: 'derived' };
    const base = computeModel(d);
    const doubled = computeModel({ ...d, dauK: 600 });
    expect(doubled.nodes).toBe(2 * base.nodes);
  });
});

describe('memory fit', () => {
  it('every platform declares hbmGb', () => {
    for (const p of Object.values(PLATFORMS)) expect(p.hbmGb).toBeGreaterThan(0);
  });

  it('default GLM-5.2 (753 GB) fits an H200 node with default headroom', () => {
    const fit = memoryFit(DEFAULTS);
    expect(fit.status).toBe('fits');
    expect(fit.nodeHbmGb).toBe(141 * 8);
    expect(fit.unitLabel).toBe('node');
  });

  it('Ascend 910C: GLM-5.2 is tight (753 GB vs 1,024 GB node), DeepSeek fits', () => {
    expect(memoryFit({ ...DEFAULTS, platform: 'ascend' }).status).toBe('tight');
    expect(memoryFit({ ...DEFAULTS, llm: 'deepseek', platform: 'ascend' }).status).toBe('fits');
  });

  it('Ascend 910C sizes 29 nodes for the GLM-5.2 baseline workload', () => {
    const m = computeModel({ ...DEFAULTS, platform: 'ascend' });
    expect(m.nodes).toBe(29);
    expect(m.gpus).toBe(232);
  });

  it('Ascend 950PR sizes 25 nodes and carries the same legal caution', () => {
    const m = computeModel({ ...DEFAULTS, platform: 'ascend950' });
    expect(m.nodes).toBe(25);
    expect(m.gpus).toBe(200);
    expect(PLATFORMS.ascend950.caution).toBe(PLATFORMS.ascend.caution);
  });

  it('DeepSeek does not fit a single H100 node (671 GB > 640 GB)', () => {
    const fit = memoryFit({ ...DEFAULTS, llm: 'deepseek', platform: 'h100' });
    expect(fit.status).toBe('no-fit');
    expect(fit.minUnits).toBeGreaterThanOrEqual(2);
  });

  it('custom 900 GB on H200 fits raw HBM but violates headroom → tight', () => {
    const fit = memoryFit({ ...DEFAULTS, llm: 'custom', customWeightsGb: 900 });
    expect(fit.status).toBe('tight');
  });

  it('GB200 uses the rack as the serving unit', () => {
    const fit = memoryFit({ ...DEFAULTS, platform: 'gb200' });
    expect(fit.unitLabel).toBe('rack');
    expect(fit.nodeHbmGb).toBe(186 * 72);
  });
});

describe('TCO vs throughput sweep', () => {
  const rows = tcoVsThroughput(DEFAULTS);

  it('produces one row per TPM step with monotone nodes and on-prem cost', () => {
    expect(rows.length).toBe(50);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].nodes).toBeGreaterThanOrEqual(rows[i - 1].nodes);
      expect(rows[i].onprem).toBeGreaterThanOrEqual(rows[i - 1].onprem);
    }
  });

  it('the tpm=10 row matches computeModel(DEFAULTS)', () => {
    const row = rows.find((r) => r.tpm === 10);
    expect(row.onprem).toBeCloseTo(computeModel(DEFAULTS).onprem / 1e6, 6);
    expect(row.nodes).toBe(17);
  });

  it('forces direct mode so the sweep is valid in derived mode too', () => {
    const derived = tcoVsThroughput({ ...DEFAULTS, demandMode: 'derived' });
    expect(derived).toEqual(rows);
  });
});

describe('sensitivity tornado', () => {
  const t = sensitivityTornado(DEFAULTS);

  it('base equals the on-prem total and rows are ranked by span', () => {
    expect(t.base).toBe(computeModel(DEFAULTS).onprem);
    for (let i = 1; i < t.rows.length; i++) {
      expect(t.rows[i - 1].span).toBeGreaterThanOrEqual(t.rows[i].span);
    }
  });

  it('all spans are non-negative and each row has low/high', () => {
    for (const r of t.rows) {
      expect(r.span).toBeGreaterThanOrEqual(0);
      expect(r.span).toBeCloseTo(Math.abs(r.high - r.low), 6);
    }
  });

  it('more GPU throughput (perfMult) lowers cost — direction is inverted', () => {
    const row = t.rows.find((r) => r.key === 'perfMult');
    expect(row.high).toBeLessThanOrEqual(row.low);
  });

  it('works in derived demand mode via the direct-mode tpm override', () => {
    const td = sensitivityTornado({ ...DEFAULTS, demandMode: 'derived' });
    const tpmRow = td.rows.find((r) => r.key === 'tpm');
    expect(tpmRow.span).toBeGreaterThanOrEqual(0);
    expect(td.base).toBe(computeModel({ ...DEFAULTS, demandMode: 'derived' }).onprem);
  });
});

describe('platform matrix', () => {
  it('one row per platform, each matching computeModel for that platform', () => {
    const rows = platformMatrix(DEFAULTS);
    expect(rows.map((r) => r.id)).toEqual(PLATFORM_ORDER);
    for (const row of rows) {
      const m = computeModel({ ...DEFAULTS, platform: row.id });
      expect(row.nodes).toBe(m.nodes);
      expect(row.gpus).toBe(m.gpus);
      expect(row.onprem).toBe(m.onprem);
      expect(row.effTokPerGpu).toBe(m.effTokPerGpu);
      expect(row.fit).toBe(m.fit.status);
    }
  });

  it('reflects the selected LLM (GLM-5.2 no-fits H100 in the matrix)', () => {
    const rows = platformMatrix({ ...DEFAULTS, llm: 'glm52' });
    expect(rows.find((r) => r.id === 'h100').fit).toBe('no-fit');
    expect(rows.find((r) => r.id === 'h200').fit).toBe('fits');
  });

  it('every catalog model declares context and license for the spec panel', () => {
    for (const model of Object.values(MODELS)) {
      if (model.custom) continue;
      expect(model.contextK).toBeGreaterThan(0);
      expect(model.license).toBeTruthy();
    }
  });
});

describe('Azure MaaS comparison', () => {
  const rows = maasComparison(DEFAULTS);

  it('covers GPT-5.5 and Claude Sonnet 5 on Azure, cheapest first', () => {
    expect(rows.map((r) => r.id)).toEqual(['sonnet5Azure', 'gpt55Azure']);
    expect(maasBenchmarks().every((p) => p.maas && p.deployment)).toBe(true);
  });

  it('cost = 5-yr token volume × blended price', () => {
    const tokensM = 10 * 60 * CONSTANTS.HOURS_PER_YEAR * CONSTANTS.HORIZON_YEARS;
    for (const r of rows) {
      expect(r.tokensM).toBeCloseTo(tokensM, 6);
      expect(r.cost).toBeCloseTo(tokensM * r.blended, 3);
    }
  });

  it('MaaS is an order of magnitude above on-prem at the 10M TPM baseline', () => {
    for (const r of rows) expect(r.ratio).toBeGreaterThan(5);
  });

  it('MaaS only wins at very low volume (break-even under 1M TPM)', () => {
    for (const r of rows) {
      expect(r.beTpm).toBeGreaterThan(0);
      expect(r.beTpm).toBeLessThan(1);
    }
  });
});

describe('API price benchmarks', () => {
  it('blend follows the 3:1 input:output convention', () => {
    const p = API_PRICES.glm45;
    expect(blendedApiPrice(p)).toBeCloseTo(p.inputPerM * INPUT_SHARE + p.outputPerM * (1 - INPUT_SHARE), 10);
  });

  it('every entry is sourced, dated, and positive; benchmarks sorted ascending', () => {
    for (const p of Object.values(API_PRICES)) {
      expect(p.source).toBeTruthy();
      expect(p.asOf).toBeTruthy();
      expect(blendedApiPrice(p)).toBeGreaterThan(0);
    }
    const b = apiBenchmarks();
    for (let i = 1; i < b.length; i++) expect(b[i].blended).toBeGreaterThanOrEqual(b[i - 1].blended);
  });
});
