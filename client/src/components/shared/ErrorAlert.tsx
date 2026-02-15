import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';

interface ErrorAlertProps {
  message: string;
  onDismiss?: () => void;
}

export const ErrorAlert = ({ message, onDismiss }: ErrorAlertProps) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
      <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
      <div className="flex-1">
        <p className="text-red-700 font-medium">Error</p>
        <p className="text-red-600 text-sm mt-1">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={handleDismiss}
          className="text-red-400 hover:text-red-600 transition-colors"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
};
