import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'flat';
}

export const Card = ({ variant = 'default', className = '', children, ...props }: CardProps) => {
  const baseClasses = 'rounded-2xl';

  const variantClasses = {
    default: 'bg-white shadow-xl border border-slate-100 p-8',
    elevated: 'bg-white shadow-2xl border border-slate-100 p-8',
    flat: 'bg-white border border-slate-200 p-6',
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
};
