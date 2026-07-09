// apiPrices.js — Public API price benchmarks for the $/M-token sensitivity chart.
//
// Follows the platforms.js pattern: pure data + tiny helpers, consumed by the UI as
// reference lines. Prices are published list rates, web-verified on the asOf date.
//
// Apples-to-oranges caveat (shown in the UI): self-hosted $/M-token divides fleet TCO
// by tokens *generated* at the assumed utilization, while API prices bill actual
// input+output tokens with no idle cost — the comparison is directional, not exact.

// Blend assumes a 3:1 input:output token mix (common serving benchmark convention).
export const INPUT_SHARE = 0.75;

export const API_PRICES = {
  deepseekV4Flash: {
    id: 'deepseekV4Flash', label: 'DeepSeek V4 Flash',
    inputPerM: 0.14, outputPerM: 0.28,
    source: 'api-docs.deepseek.com pricing', asOf: '2026-07',
  },
  glm45: {
    id: 'glm45', label: 'GLM-4.5 (Z.ai)',
    inputPerM: 0.60, outputPerM: 2.20,
    source: 'docs.z.ai pricing', asOf: '2026-07',
  },
  gpt54: {
    id: 'gpt54', label: 'GPT-5.4',
    inputPerM: 2.50, outputPerM: 15.00,
    source: 'developers.openai.com pricing', asOf: '2026-07',
  },
};

export const blendedApiPrice = (p, inputShare = INPUT_SHARE) =>
  p.inputPerM * inputShare + p.outputPerM * (1 - inputShare);

/** Reference lines for charts: [{id, label, blended}] cheapest first. */
export const apiBenchmarks = () =>
  Object.values(API_PRICES)
    .map((p) => ({ id: p.id, label: p.label, blended: blendedApiPrice(p) }))
    .sort((a, b) => a.blended - b.blended);
