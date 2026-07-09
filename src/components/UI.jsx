export const COLORS = {
  navy: '#0B2545', gold: '#C9A227', teal: '#0E7C7B',
  red: '#B0413E', grey: '#8A8D91', blue: '#3D6FB4',
};

export function Slider({ label, value, min, max, step, unit, fmt, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <label style={{ fontSize: 12.5, color: '#334', fontWeight: 600 }}>{label}</label>
        <span style={{ fontSize: 12.5, color: COLORS.navy, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {fmt(value)}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: COLORS.teal, cursor: 'pointer' }}
      />
    </div>
  );
}

export function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: COLORS.teal, textTransform: 'uppercase',
        letterSpacing: 0.6, marginBottom: 10, borderBottom: '1.5px solid #0E7C7B22', paddingBottom: 4,
      }}>{title}</div>
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 10, padding: '12px 14px', flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 10.5, color: COLORS.grey, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || COLORS.navy, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: COLORS.grey, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function SelectorGrid({ title, options, value, onChange, footer }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: COLORS.teal, textTransform: 'uppercase',
        letterSpacing: 0.6, marginBottom: 10, borderBottom: '1.5px solid #0E7C7B22', paddingBottom: 4,
      }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {options.map(({ id, label }) => {
          const active = id === value;
          return (
            <button key={id} onClick={() => onChange(id)}
              style={{
                fontSize: 11.5, fontWeight: 700, padding: '8px 6px', borderRadius: 8, cursor: 'pointer',
                border: active ? `2px solid ${COLORS.navy}` : '1px solid #d5d8dc',
                background: active ? COLORS.navy : '#fff',
                color: active ? '#fff' : '#445', transition: 'all .12s',
              }}>
              {label}
            </button>
          );
        })}
      </div>
      {footer && <div style={{ fontSize: 10.5, color: COLORS.grey, marginTop: 6 }}>{footer}</div>}
    </div>
  );
}

export function PlatformSelector({ platforms, order, value, onChange }) {
  const p = platforms[value];
  const unit = p.rackBased ? 'rack' : 'node';
  return (
    <SelectorGrid title="Accelerator Platform" options={order.map((id) => platforms[id])}
      value={value} onChange={onChange}
      footer={`${p.tokPerGpu.toLocaleString()} tok/s/GPU · ${p.gpusPerNode} GPU/${unit} · $${(p.nodeCost / 1e6).toFixed(2)}M/${unit}`} />
  );
}

export function ModelSelector({ models, order, value, onChange }) {
  const m = models[value];
  return (
    <SelectorGrid title="LLM Model" options={order.map((id) => models[id])}
      value={value} onChange={onChange}
      footer={m.custom
        ? 'Set tok/s/GPU and weights under LLM Serving below'
        : `${m.totalB}B total · ${m.activeB}B active · ${m.precision} · ${m.weightsGb} GB weights`} />
  );
}

const FIT_STYLES = {
  'fits': { color: COLORS.teal, text: 'Fits' },
  'tight': { color: COLORS.gold, text: 'Tight' },
  'no-fit': { color: COLORS.red, text: 'Does not fit' },
};

export function MemoryFitBar({ fit }) {
  const { color, text } = FIT_STYLES[fit.status];
  const weightsPct = Math.min(100, (fit.weightsGb / fit.nodeHbmGb) * 100);
  const usablePct = (fit.usableGb / fit.nodeHbmGb) * 100;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#334' }}>
          Weights {fit.weightsGb.toLocaleString()} GB of {fit.nodeHbmGb.toLocaleString()} GB HBM per {fit.unitLabel}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.4 }}>{text}</span>
      </div>
      <div style={{ position: 'relative', height: 14, background: '#e8eaed', borderRadius: 7, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${weightsPct}%`, background: color, borderRadius: 7 }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${usablePct}%`, width: 2, background: '#555' }}
          title="KV/batch headroom boundary" />
      </div>
      <div style={{ fontSize: 10.5, color: COLORS.grey, marginTop: 4 }}>
        Marker = usable limit after KV/batch headroom ({fit.usableGb.toFixed(0)} GB).
      </div>
    </div>
  );
}

export function Card({ title, children, style }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: 16, marginBottom: 16, ...style }}>
      {title && <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, marginBottom: 8 }}>{title}</div>}
      {children}
    </div>
  );
}
