import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function triggerHaptic(type: 'light' | 'medium' | 'success' = 'light') {
  if (typeof window === 'undefined' || !navigator.vibrate) return;
  try {
    if (type === 'light') navigator.vibrate(12);
    else if (type === 'medium') navigator.vibrate(28);
    else if (type === 'success') navigator.vibrate([35, 45, 55]);
  } catch {
    // Ignore unsupported devices
  }
}

