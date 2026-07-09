// models.js — LLM model definitions.
//
// Follows the platforms.js pattern: data module → model reads it → UI control → tests.
// Platform tokPerGpu figures are calibrated to serving the reference model (GLM-4.5,
// 32B active params at FP8 ≈ 1.0 byte/param). Other models scale throughput by how many
// bytes of active weights each decoded token must stream from HBM:
//
//   speedFactor = clamp(REF.activeB × REF.bytesPerParam / (activeB × bytesPerParam), SPEED_CLAMP)
//
// Decode is HBM-bandwidth-bound, so this first-order rule is reasonable for planning.
// Limitations (documented in CLAUDE.md): ignores prefill compute, attention/KV bandwidth,
// expert-parallel efficiency, speculative decoding, and multi-node interconnect penalties
// when a model doesn't fit one node. Benchmark on your own traffic mix before committing.

export const REF = { activeB: 32, bytesPerParam: 1.0 }; // GLM-4.5 FP8 anchor

// Tiny active sets become compute/overhead/SLO-bound rather than bandwidth-bound,
// so the analytical speedup is capped; the floor guards absurd slowdowns symmetrically.
export const SPEED_CLAMP = [0.25, 4.0];

export const MODELS = {
  glm45: {
    id: 'glm45', label: 'GLM-4.5',
    totalB: 355, activeB: 32, bytesPerParam: 1.0, precision: 'FP8', weightsGb: 355,
  },
  deepseek: {
    id: 'deepseek', label: 'DeepSeek-V3/R1',
    totalB: 671, activeB: 37, bytesPerParam: 1.0, precision: 'FP8', weightsGb: 671,
  },
  qwen3: {
    id: 'qwen3', label: 'Qwen3-235B-A22B',
    totalB: 235, activeB: 22, bytesPerParam: 1.0, precision: 'FP8', weightsGb: 235,
  },
  llama4mav: {
    id: 'llama4mav', label: 'Llama 4 Maverick',
    totalB: 400, activeB: 17, bytesPerParam: 1.0, precision: 'FP8', weightsGb: 400,
  },
  gptoss: {
    id: 'gptoss', label: 'GPT-OSS-120B',
    totalB: 117, activeB: 5.1, bytesPerParam: 0.55, precision: 'MXFP4', weightsGb: 65, // raw factor ~11× — hits SPEED_CLAMP max
  },
  // Custom: throughput and weights come from the customTokPerGpu / customWeightsGb inputs.
  custom: { id: 'custom', label: 'Custom', custom: true },
};

export const MODEL_ORDER = ['glm45', 'deepseek', 'qwen3', 'llama4mav', 'gptoss', 'custom'];
export const DEFAULT_MODEL = 'glm45';
