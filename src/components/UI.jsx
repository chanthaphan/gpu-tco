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

export function PlatformSelector({ platforms, order, value, onChange }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: COLORS.teal, textTransform: 'uppercase',
        letterSpacing: 0.6, marginBottom: 10, borderBottom: '1.5px solid #0E7C7B22', paddingBottom: 4,
      }}>Accelerator Platform</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {order.map((id) => {
          const active = id === value;
          return (
            <button key={id} onClick={() => onChange(id)}
              style={{
                fontSize: 11.5, fontWeight: 700, padding: '8px 6px', borderRadius: 8, cursor: 'pointer',
                border: active ? `2px solid ${COLORS.navy}` : '1px solid #d5d8dc',
                background: active ? COLORS.navy : '#fff',
                color: active ? '#fff' : '#445', transition: 'all .12s',
              }}>
              {platforms[id].label}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: COLORS.grey, marginTop: 6 }}>
        {platforms[value].tokPerGpu.toLocaleString()} tok/s/GPU · {platforms[value].gpusPerNode} GPU/{platforms[value].rackBased ? 'rack' : 'node'} · ${(platforms[value].nodeCost / 1e6).toFixed(2)}M/{platforms[value].rackBased ? 'rack' : 'node'}
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
