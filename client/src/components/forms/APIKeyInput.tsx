import { Eye, EyeOff, Key } from 'lucide-react';
import { useState } from 'react';

interface APIKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export const APIKeyInput = ({ value, onChange, error }: APIKeyInputProps) => {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="mb-6">
      <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
        <Key size={12} />
        API Key
      </label>
      <div className="relative">
        <input
          type={showKey ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your API key"
          className={`input-dark pr-12 ${error ? 'border-red-500/50 focus:border-red-500' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
};
