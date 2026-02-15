import { Layers } from 'lucide-react';

interface BatchDomainInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export const BatchDomainInput = ({ value, onChange, error }: BatchDomainInputProps) => {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
        <Layers size={12} />
        Domains
        <span className="normal-case tracking-normal ml-1" style={{ color: 'var(--text-tertiary)' }}>
          (one per line)
        </span>
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"competitor1.com\ncompetitor2.com\ncompetitor3.com"}
        rows={4}
        className={`input-dark mono text-sm resize-none ${error ? 'border-red-500/50 focus:border-red-500' : ''}`}
      />
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
};
