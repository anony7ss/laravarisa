'use client';

export function RevenueChart({ data }: { data: { month: string; value: number; label: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <p className="admin-kicker">FINANCEIRO</p>
          <h2>Faturamento Estimado</h2>
        </div>
      </div>
      <div style={{ padding: '24px', paddingTop: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '160px', width: '100%' }}>
          {data.map((item, i) => {
            const height = (item.value / max) * 100;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--fg-muted)', fontWeight: 600 }}>{item.label}</span>
                <div 
                  style={{ 
                    width: '100%', 
                    height: `${Math.max(height, 5)}%`, 
                    backgroundColor: i === data.length - 1 ? 'var(--admin-orange)' : 'var(--border)', 
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 1s ease-out'
                  }} 
                />
                <span style={{ fontSize: '11px', color: 'var(--fg)', textTransform: 'uppercase' }}>{item.month}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
