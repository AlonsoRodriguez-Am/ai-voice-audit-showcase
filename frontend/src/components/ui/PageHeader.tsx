import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--tx-1)', letterSpacing: '-0.5px', lineHeight: '1.2', margin: 0 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ color: 'var(--tx-3)', fontWeight: 500, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <span style={{ width: '4px', height: '4px', backgroundColor: 'var(--accent)', borderRadius: '50%' }} />
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
