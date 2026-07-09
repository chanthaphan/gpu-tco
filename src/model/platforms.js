// platforms.js — Accelerator platform definitions.
//
// WORKED EXAMPLE (added as a reference pattern for extending the model):
// This is how you add a hardware-platform dimension to the calculator. Each platform
// carries its own throughput, node economics, power draw, and matching Azure SKU rate.
// The UI exposes a selector; computeModel() reads the active platform's specs.
//
// Sources for throughput/pricing are in CLAUDE.md. Blackwell (B200/GB200) numbers are
// derated vendor/community figures — treat as planning estimates, not guarantees.

export const PLATFORMS = {
  h100: {
    id: 'h100',
    label: 'NVIDIA H100',
    tokPerGpu: 1200,     // sustained tok/s/GPU, vLLM FP8 (community)
    gpusPerNode: 8,      // HGX 8-GPU node
    nodeCost: 300000,    // USD per 8xH100 node
    nodeKw: 10.0,        // kW IT draw per node
    hbmGb: 80,           // HBM3 per GPU
    azurePaygHr: 98.32,  // Azure ND H100 v5 PAYG $/hr/node [ref 12]
    rackBased: false,
  },
  h200: {
    id: 'h200',
    label: 'NVIDIA H200',
    tokPerGpu: 2200,     // vLLM wide-EP, CoreWeave H200 [ref 3]
    gpusPerNode: 8,
    nodeCost: 340000,
    nodeKw: 10.2,
    hbmGb: 141,          // HBM3e per GPU
    azurePaygHr: 110.24, // Azure ND H200 v5 PAYG [ref 11,12]
    rackBased: false,
  },
  b200: {
    id: 'b200',
    label: 'NVIDIA B200',
    tokPerGpu: 2500,     // TRT-LLM FP4, derated [ref 6]
    gpusPerNode: 8,
    nodeCost: 480000,    // planning estimate (Blackwell pricing volatile)
    nodeKw: 14.3,        // higher per-node draw
    hbmGb: 192,          // HBM3e per GPU
    azurePaygHr: 160.0,  // planning estimate; confirm when Azure lists ND GB/B-series
    rackBased: false,
  },
  gb200: {
    id: 'gb200',
    label: 'NVIDIA GB200 NVL72',
    tokPerGpu: 5000,     // SGLang FP8+NVFP4, derated from peak [ref 7]
    gpusPerNode: 72,     // rack-scale unit (NVL72), not an 8-GPU node
    nodeCost: 3200000,   // per NVL72 rack, planning estimate
    nodeKw: 120.0,       // per rack IT draw (~120 kW)
    hbmGb: 186,          // HBM3e per Blackwell GPU in NVL72 (planning estimate)
    azurePaygHr: 1150.0, // per-rack-equivalent planning estimate
    rackBased: true,
  },
  ascend: {
    id: 'ascend',
    label: 'Huawei Ascend 910C',
    tokPerGpu: 1300,     // sustained/derated from Huawei's 1,943 tok/s/NPU decode (CloudMatrix-Infer)
    gpusPerNode: 8,      // 8-NPU Atlas-class server
    nodeCost: 220000,    // gray-market planning estimate (~180-200K CNY/chip reported); no official list price
    nodeKw: 8.5,         // ~800W/NPU + overhead; system-level efficiency well below Blackwell
    hbmGb: 128,          // per 910C package
    azurePaygHr: 65.0,   // no Azure Ascend SKU — equivalent Azure H200 capacity for one Ascend node
    rackBased: false,
    // Included per explicit instruction (Jul 2026). US BIS GP10 guidance (13 May 2025)
    // makes worldwide use of Ascend 910-series an export-control violation — surface
    // this caution wherever the platform is selectable; do not remove it.
    caution: 'US BIS GP10 (13 May 2025): worldwide-use export-control violation — legal sign-off required',
  },
};

export const PLATFORM_ORDER = ['h100', 'h200', 'b200', 'gb200', 'ascend'];
export const DEFAULT_PLATFORM = 'h200';
