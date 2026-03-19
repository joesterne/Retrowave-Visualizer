import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface RetroButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

const RetroButton: React.FC<RetroButtonProps> = ({ className, variant = 'primary', ...props }) => {
  const variants = {
    primary: 'bg-[#444] text-[#00ff00] border-[#666] hover:bg-[#555] active:bg-[#333]',
    secondary: 'bg-[#333] text-[#aaa] border-[#444] hover:bg-[#444] active:bg-[#222]',
    danger: 'bg-[#622] text-[#f44] border-[#844] hover:bg-[#733] active:bg-[#511]',
  };

  return (
    <button
      className={cn(
        'px-3 py-1 border-2 font-mono text-xs uppercase tracking-wider transition-all active:translate-y-[1px] active:shadow-none shadow-[2px_2px_0px_rgba(0,0,0,0.5)]',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};

export default RetroButton;
