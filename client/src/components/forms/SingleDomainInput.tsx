import { Globe } from 'lucide-react';

interface SingleDomainInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export const SingleDomainInput = ({ value, onChange, error }: SingleDomainInputProps) => {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
        <Globe size={12} />
        Domain
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="competitor.com"
        className={`input-dark mono text-sm ${error ? 'border-red-500/50 focus:border-red-500' : ''}`}
      />
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
};
