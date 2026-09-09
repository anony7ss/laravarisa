'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function PublicThemeGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || !pathname.startsWith('/admin')) {
      if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
      }
      if (document.documentElement.style.backgroundColor) {
        document.documentElement.style.backgroundColor = '';
      }
      if (document.documentElement.style.color) {
        document.documentElement.style.color = '';
      }
      if (document.documentElement.style.colorScheme) {
        document.documentElement.style.colorScheme = '';
      }

      if (document.body) {
        if (document.body.classList.contains('dark')) {
          document.body.classList.remove('dark');
        }
        if (document.body.style.backgroundColor) {
          document.body.style.backgroundColor = '';
        }
        if (document.body.style.color) {
          document.body.style.color = '';
        }
      }
    }
  }, [pathname]);

  return null;
}
