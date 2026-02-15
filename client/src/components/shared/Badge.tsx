interface BadgeProps {
  variant?: 'primary' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
}

export const Badge = ({ variant = 'primary', children }: BadgeProps) => {
  const styles: Record<string, { bg: string; border: string; color: string }> = {
    primary: {
      bg: 'var(--accent-glow)',
      border: 'rgba(99, 102, 241, 0.2)',
      color: 'var(--accent-light)',
    },
    success: {
      bg: 'var(--success-glow)',
      border: 'rgba(52, 211, 153, 0.2)',
      color: 'var(--success)',
    },
    warning: {
      bg: 'rgba(251, 191, 36, 0.1)',
      border: 'rgba(251, 191, 36, 0.2)',
      color: 'var(--warn)',
    },
    error: {
      bg: 'rgba(248, 113, 113, 0.1)',
      border: 'rgba(248, 113, 113, 0.2)',
      color: 'var(--error)',
    },
  };

  const s = styles[variant] || styles.primary;

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {children}
    </span>
  );
};
