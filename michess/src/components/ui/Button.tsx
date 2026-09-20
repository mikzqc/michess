import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-50';
  
  const variants = {
    primary: 'bg-accent text-white hover:bg-accent-hover shadow-sm',
    secondary: 'bg-surface-3 text-content-1 hover:bg-border-1 shadow-sm',
    ghost: 'hover:bg-surface-3 text-content-2 hover:text-content-1',
    destructive: 'bg-error/20 text-error hover:bg-error/30 border border-error/50 hover:border-error',
    outline: 'border border-border-2 text-content-1 hover:bg-surface-3'
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs rounded-md',
    md: 'h-10 px-4 py-2 text-sm rounded-lg',
    lg: 'h-12 px-6 py-3 text-base rounded-xl',
    icon: 'h-10 w-10 rounded-lg flex-shrink-0'
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
