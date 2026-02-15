import { CheckCircle, X } from 'lucide-react';
import { useState } from 'react';

interface SuccessBannerProps {
  message: string;
  details?: string;
  onDismiss?: () => void;
}

export const SuccessBanner = ({ message, details, onDismiss }: SuccessBannerProps) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  return (
    <div
      className="rounded-xl p-4 flex items-start gap-3 fade-in"
      style={{
        background: 'var(--success-glow)',
        border: '1px solid rgba(52, 211, 153, 0.2)',
      }}
    >
      <CheckCircle className="flex-shrink-0 mt-0.5" size={18} style={{ color: 'var(--success)' }} />
      <div className="flex-1">
        <p className="font-medium text-sm" style={{ color: 'var(--success)' }}>{message}</p>
        {details && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{details}</p>}
      </div>
      {onDismiss && (
        <button
          onClick={handleDismiss}
          className="transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};
