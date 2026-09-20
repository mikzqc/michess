import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className = '', label, error, icon, ...props }, ref) => {
  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && <label className="text-sm font-semibold text-content-2">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`flex h-10 w-full rounded-lg border border-border-1 bg-surface-1 px-3 py-2 text-sm text-content-1 placeholder:text-content-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${icon ? 'pl-10' : ''} ${error ? 'border-error focus-visible:ring-error' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-error mt-0.5">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';
