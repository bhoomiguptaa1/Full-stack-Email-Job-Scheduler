import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const VARIANT_CLASSES = {
  primary:   'bg-slate-900 text-white hover:bg-slate-800 border border-slate-900 shadow-sm focus-visible:ring-slate-900',
  secondary: 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm focus-visible:ring-slate-400',
  ghost:     'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent focus-visible:ring-slate-400',
  danger:    'bg-rose-600 text-white hover:bg-rose-700 border border-rose-600 shadow-sm focus-visible:ring-rose-600',
};

const SIZE_CLASSES = {
  sm: 'h-8 px-2.5 text-xs rounded-md gap-1.5',
  md: 'h-9 px-3.5 text-sm rounded-lg gap-2',
  lg: 'h-10 px-4 text-sm rounded-lg gap-2',
};

export const Button = forwardRef(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
