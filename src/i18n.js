// i18n.js — display-layer locale support: English/USD and Thai/THB.
// The model (src/model/tco.js) is USD-native; THB is a *display conversion only*
// at FX_THB. No math here beyond formatting — golden rule still holds.

export const FX_THB = 33.4; // THB per USD, early-July 2026 spot — display only

export function moneyFormatter(locale) {
  const th = locale === 'th';
  const sym = th ? '฿' : '$';
  const rate = th ? FX_THB : 1;
  const m = (usd) => {
    const v = usd * rate;
    if (Math.abs(v) >= 999.5e6) return sym + (v / 1e9).toFixed(2) + 'B';
    return sym + (v / 1e6).toFixed(th ? 0 : 1) + 'M';
  };
  const axisM = (usdM) => {                 // chart values already in USD millions
    const v = usdM * 1e6 * rate;
    if (v === 0) return sym + '0M';
    if (Math.abs(v) >= 999.5e6) return sym + (v / 1e9).toFixed(1) + 'B';
    if (Math.abs(v) >= 9.95e6) return sym + Math.round(v / 1e6) + 'M';
    return sym + (v / 1e6).toFixed(1) + 'M';
  };
  return {
    sym, rate, m, axisM,
    deltaM: (usdM) => (usdM >= 0 ? '+' : '−') + m(Math.abs(usdM) * 1e6),
    perTok: (usd) => sym + (usd * rate).toFixed(usd * rate < 10 ? 2 : 1),
  };
}

export const T = {
  en: {
    locale: 'en',
    kicker: 'AI Infrastructure Planning',
    title: 'GPU Infrastructure TCO Calculator',
    subtitle: (plat, model, tpm) => `On-Premise ${plat} vs Azure · Serving ${model} at ${tpm}M TPM · 5-year horizon`,
    // stat cards
    stFleet: 'Fleet Sizing', stOnprem: 'On-Prem 5-yr TCO', stRi3: 'Azure 3-yr RI', stPayg: 'Azure PAYG',
    stBe: 'Break-even vs 3-yr RI', stBeSub: 'on-prem pulls ahead', capex: 'CAPEX', xOnprem: '× on-prem',
    unitNode: 'node', unitNodes: 'nodes', unitRack: 'rack', unitRacks: 'racks',
    // selectors
    selPlatform: 'Accelerator Platform', selModel: 'LLM Model', selDemand: 'Demand Input',
    demandDirect: 'Direct TPM', demandDerived: 'From workload',
    derivedNote: (tpm) => `Derived demand: ${tpm}M TPM at peak`,
    customNote: 'Set tok/s/GPU and weights under LLM Serving below',
    modelSpec: (m) => `${m.totalB}B total · ${m.activeB}B active · ${m.precision} · ${m.weightsGb} GB weights`,
    ascendCaution: 'US BIS GP10 (13 May 2025): worldwide-use export-control violation — legal sign-off required',
    // sections / controls (en falls back to the labels in tco.js)
    sections: {}, controls: {},
    inputsUsdNote: '',
    // model card
    cardModel: (label) => `Model — ${label}`,
    spTotal: 'Total params', spActive: 'Active params', spPrecision: 'Precision', spWeights: 'Weights',
    spContext: 'Context', spLicense: 'License', spFactor: 'Throughput factor',
    spCustomTok: 'tok/s/GPU (H200 ref)',
    matrixNote: 'Fleet and cost per platform for the current workload; ◂ marks the selected platform. Throughput factor is the bandwidth-rule multiplier vs the GLM-4.5 calibration.',
    mxPlatform: 'Platform', mxTok: 'Eff. tok/s/GPU', mxFleet: 'Fleet', mxTco: 'On-Prem 5-yr', mxMemory: 'Memory',
    fitFits: 'Fits', fitTight: 'Tight', fitNoFit: 'Does not fit',
    memLine: (w, tot, unit) => `Weights ${w} GB of ${tot} GB HBM per ${unit}`,
    memMarker: (usable) => `Marker = usable limit after KV/batch headroom (${usable} GB).`,
    memNoFit: (unit, n) => `Model weights alone exceed one ${unit}'s HBM — each replica needs ≥${n} ${unit}s (multi-${unit} serving). Throughput estimates are optimistic in this regime.`,
    memTight: (pct) => `Weights fit, but leave less than the configured ${pct}% KV/batch headroom — expect smaller batches and lower sustained throughput.`,
    // charts
    chTco: (sym) => `5-Year TCO Comparison (${sym}M)`,
    chBreakdown: (sym) => `On-Prem TCO Breakdown (${sym}M)`,
    chSweep: '5-Year TCO vs Throughput (node-count steps)',
    chTornado: 'Sensitivity Tornado — On-Prem TCO, drivers ±20%',
    chCurve: 'Cumulative Cost over 60 Months — Break-Even',
    chSens: 'Sensitivity — Effective Cost per Million Tokens vs Utilization · Public API Reference Lines',
    axMonth: 'Month', axMtpm: 'M TPM', axUtil: 'Sustained utilization', axNodes: 'Nodes',
    lgOnprem: 'On-Prem', lgPayg: 'Azure PAYG', lgRi1: 'Azure 1-yr RI', lgRi3: 'Azure 3-yr RI',
    lgDown: 'TCO downside', lgUp: 'TCO upside', current: 'current', design: 'design',
    beNever: 'never', beMo: (v) => `~${v} mo`, beVs: 'Break-even vs', vs: 'vs',
    tornadoBase: (v) => `base ${v}`, vsBase: 'vs base',
    tornadoNote: 'Zero-width TPM/utilization bars are real: node count moves in ceil() steps, so ±20% can land on the same fleet.',
    sensNote: 'On-prem cost is fixed, so cost per token falls as utilization rises. Below ~40–50%, Azure Reserved is cheaper — the key test before committing to on-prem. Dashed lines are published API list prices (3:1 in/out blend, July 2026) — directional only: APIs bill actual tokens with no idle cost.',
    breakdown: { servers: 'Servers', net: 'Network/Storage', elec: 'Electricity', colo: 'Colocation', maint: 'Maintenance', staff: 'Staff', spares: 'Spares' },
    controlsFooter: 'Defaults from the sourced 5-yr TCO analysis. Azure RI rates proxied from H100 discounts. Model throughput scaled from active-weight bytes (see models.js) — benchmark before committing. Huawei Ascend included at gray-market planning rates; the 13 May 2025 US BIS GP10 ruling makes worldwide use an export-control violation — requires explicit legal/compliance sign-off.',
    pageFooter: 'All figures are planning estimates. Throughput varies 2–3× with sequence length, batch size, and latency SLO — and the model-throughput scaling here is a first-order bandwidth rule. Benchmark your chosen model on your own traffic mix before committing. See CLAUDE.md and README.md for the full sourced assumptions.',
  },
  th: {
    locale: 'th',
    kicker: 'การวางแผนโครงสร้างพื้นฐาน AI',
    title: 'เครื่องคำนวณ TCO โครงสร้างพื้นฐาน GPU',
    subtitle: (plat, model, tpm) => `On-Premise ${plat} เทียบกับ Azure · ให้บริการ ${model} ที่ ${tpm}M TPM · ระยะเวลา 5 ปี`,
    stFleet: 'ขนาดฟลีต', stOnprem: 'TCO 5 ปี (On-Prem)', stRi3: 'Azure 3-yr RI', stPayg: 'Azure PAYG',
    stBe: 'จุดคุ้มทุนเทียบ 3-yr RI', stBeSub: 'on-prem เริ่มถูกกว่า', capex: 'CAPEX', xOnprem: '× ของ on-prem',
    unitNode: 'โหนด', unitNodes: 'โหนด', unitRack: 'แร็ค', unitRacks: 'แร็ค',
    selPlatform: 'แพลตฟอร์มตัวเร่งประมวลผล', selModel: 'โมเดล LLM', selDemand: 'รูปแบบความต้องการ',
    demandDirect: 'กำหนด TPM ตรง', demandDerived: 'คำนวณจากปริมาณงาน',
    derivedNote: (tpm) => `ความต้องการที่คำนวณได้: ${tpm}M TPM ที่ช่วงพีค`,
    customNote: 'กำหนด tok/s/GPU และขนาดโมเดลในหัวข้อ "การให้บริการ LLM" ด้านล่าง',
    modelSpec: (m) => `รวม ${m.totalB}B · แอคทีฟ ${m.activeB}B · ${m.precision} · น้ำหนัก ${m.weightsGb} GB`,
    ascendCaution: 'US BIS GP10 (13 พ.ค. 2025): การใช้งานทั่วโลกเป็นการละเมิดมาตรการควบคุมการส่งออกของสหรัฐฯ — ต้องผ่านการอนุมัติด้านกฎหมาย/กำกับดูแลก่อน',
    sections: {
      'Workload': 'ปริมาณงาน', 'LLM Serving': 'การให้บริการ LLM',
      'On-Prem · Hardware': 'On-Prem · ฮาร์ดแวร์', 'On-Prem · Operating': 'On-Prem · ค่าดำเนินงาน', 'Azure': 'Azure',
    },
    controls: {
      tpm: 'ปริมาณโทเคน', util: 'เป้าหมายการใช้งาน', dauK: 'ผู้ใช้งานต่อวัน (DAU)',
      reqPerUser: 'คำขอ/ผู้ใช้/วัน', tokPerReq: 'โทเคน/คำขอ', peakFactor: 'พีคต่อค่าเฉลี่ย',
      customTokPerGpu: 'tok/s/GPU กำหนดเอง (อิง H200)', customWeightsGb: 'ขนาดน้ำหนักโมเดลกำหนดเอง',
      kvHeadroomPct: 'พื้นที่เผื่อ KV/batch', netStorage: 'เครือข่าย/สตอเรจ/แร็ค', pue: 'PUE',
      elecRate: 'ค่าไฟฟ้า', coloRate: 'ค่าโคโลเคชัน', maintPct: 'ค่าบำรุงรักษา/ปี', fte: 'พนักงาน (FTE)',
      ftecost: 'ค่าใช้จ่าย/FTE/ปี', spares: 'สำรองอะไหล่', ri1Disc: 'ส่วนลด RI 1 ปี', ri3Disc: 'ส่วนลด RI 3 ปี',
      egress: 'ค่า Egress + สตอเรจ',
    },
    inputsUsdNote: 'ค่าอินพุตทุกตัวเป็นสกุล USD; ยอดเงินที่แสดงผลแปลงเป็นบาทที่ 33.4 THB/USD',
    cardModel: (label) => `โมเดล — ${label}`,
    spTotal: 'พารามิเตอร์รวม', spActive: 'พารามิเตอร์แอคทีฟ', spPrecision: 'ความละเอียด', spWeights: 'ขนาดน้ำหนัก',
    spContext: 'คอนเท็กซ์', spLicense: 'ไลเซนส์', spFactor: 'ตัวคูณความเร็ว',
    spCustomTok: 'tok/s/GPU (อิง H200)',
    matrixNote: 'ขนาดฟลีตและต้นทุนของแต่ละแพลตฟอร์มที่ปริมาณงานปัจจุบัน; ◂ คือแพลตฟอร์มที่เลือก ตัวคูณความเร็วอ้างอิงจากการคาลิเบรตด้วย GLM-4.5',
    mxPlatform: 'แพลตฟอร์ม', mxTok: 'tok/s/GPU สุทธิ', mxFleet: 'ฟลีต', mxTco: 'TCO 5 ปี', mxMemory: 'หน่วยความจำ',
    fitFits: 'พอ', fitTight: 'ตึง', fitNoFit: 'ไม่พอ',
    memLine: (w, tot, unit) => `น้ำหนักโมเดล ${w} GB จาก HBM ${tot} GB ต่อ${unit}`,
    memMarker: (usable) => `เส้นแบ่ง = ขีดจำกัดใช้งานได้หลังหักพื้นที่เผื่อ KV/batch (${usable} GB)`,
    memNoFit: (unit, n) => `น้ำหนักโมเดลเกินความจุ HBM ของหนึ่ง${unit} — แต่ละเรพลิกาต้องใช้ ≥${n} ${unit} (multi-node serving) ประมาณการความเร็วในโหมดนี้ค่อนข้างมองโลกในแง่ดี`,
    memTight: (pct) => `น้ำหนักโมเดลใส่ได้ แต่เหลือพื้นที่น้อยกว่าที่ตั้งไว้ ${pct}% — คาดว่า batch เล็กลงและความเร็วต่อเนื่องลดลง`,
    chTco: (sym) => `เปรียบเทียบ TCO 5 ปี (${sym}M)`,
    chBreakdown: (sym) => `องค์ประกอบ TCO On-Prem (${sym}M)`,
    chSweep: 'TCO 5 ปี เทียบปริมาณงาน (ขั้นตามจำนวนโหนด)',
    chTornado: 'แผนภูมิทอร์นาโด — TCO On-Prem, แต่ละปัจจัย ±20%',
    chCurve: 'ต้นทุนสะสม 60 เดือน — จุดคุ้มทุน',
    chSens: 'ต้นทุนต่อล้านโทเคน เทียบอัตราการใช้งาน · เส้นอ้างอิงราคา API สาธารณะ',
    axMonth: 'เดือน', axMtpm: 'M TPM', axUtil: 'อัตราการใช้งานต่อเนื่อง', axNodes: 'โหนด',
    lgOnprem: 'On-Prem', lgPayg: 'Azure PAYG', lgRi1: 'Azure 1-yr RI', lgRi3: 'Azure 3-yr RI',
    lgDown: 'TCO ลดลง', lgUp: 'TCO เพิ่มขึ้น', current: 'ปัจจุบัน', design: 'จุดออกแบบ',
    beNever: 'ไม่คุ้มทุน', beMo: (v) => `~${v} เดือน`, beVs: 'คุ้มทุนเทียบ', vs: 'เทียบ',
    tornadoBase: (v) => `ฐาน ${v}`, vsBase: 'จากฐาน',
    tornadoNote: 'แท่ง TPM/การใช้งานที่กว้างเป็นศูนย์คือพฤติกรรมจริง: จำนวนโหนดขยับเป็นขั้น (ceil) ดังนั้น ±20% อาจได้ฟลีตขนาดเดิม',
    sensNote: 'ต้นทุน on-prem คงที่ ดังนั้นต้นทุนต่อโทเคนจะลดลงเมื่อการใช้งานสูงขึ้น ต่ำกว่า ~40–50% คลาวด์แบบ Reserved ถูกกว่า — เป็นเงื่อนไขสำคัญก่อนตัดสินใจลงทุน on-prem เส้นประคือราคา API สาธารณะ (สัดส่วน in/out 3:1, ก.ค. 2026) — ใช้เทียบทิศทางเท่านั้น: API คิดเงินตามโทเคนจริงโดยไม่มีต้นทุนช่วงว่างงาน',
    breakdown: { servers: 'เซิร์ฟเวอร์', net: 'เครือข่าย/สตอเรจ', elec: 'ค่าไฟฟ้า', colo: 'โคโลเคชัน', maint: 'บำรุงรักษา', staff: 'พนักงาน', spares: 'อะไหล่สำรอง' },
    controlsFooter: 'ค่าเริ่มต้นมาจากการวิเคราะห์ TCO 5 ปีพร้อมแหล่งอ้างอิง อัตรา RI ของ Azure ประมาณจากส่วนลด H100 ความเร็วโมเดลปรับตามขนาดพารามิเตอร์แอคทีฟ (ดู models.js) — ควรทำ benchmark ก่อนตัดสินใจ Huawei Ascend รวมอยู่ในการคำนวณด้วยราคาประมาณการตลาดเทา; คำวินิจฉัย US BIS GP10 (13 พ.ค. 2025) ทำให้การใช้งานทั่วโลกเป็นการละเมิดมาตรการควบคุมการส่งออก — ต้องผ่านการอนุมัติด้านกฎหมาย/กำกับดูแลอย่างชัดเจน',
    pageFooter: 'ตัวเลขทั้งหมดเป็นประมาณการเพื่อการวางแผน ความเร็วจริงแปรผัน 2–3 เท่าตามความยาว sequence, ขนาด batch และ SLO ด้านเวลาตอบสนอง — และการปรับความเร็วตามโมเดลเป็นกฎประมาณการอันดับหนึ่งเท่านั้น ควร benchmark โมเดลที่เลือกด้วยทราฟฟิกจริงก่อนตัดสินใจ ดูสมมติฐานพร้อมแหล่งอ้างอิงทั้งหมดใน CLAUDE.md และ README.md',
  },
};
