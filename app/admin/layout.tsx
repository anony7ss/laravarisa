import { cookies } from 'next/headers';
import './admin.css';

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('admin-theme')?.value;
  const isDark = themeCookie !== 'light';

  return (
    <div
      className={`admin-root${isDark ? ' dark' : ''}`}
      style={isDark ? { backgroundColor: '#11110f', color: '#f7f7f2', minHeight: '100dvh' } : { minHeight: '100dvh' }}
      suppressHydrationWarning
    >
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var c=(document.cookie.match(/(?:^|; )admin-theme=([^;]*)/)||[])[1];var l=localStorage.getItem('admin-theme');var t=c||l;if(t!=='light'){var r=document.currentScript.parentElement;if(r)r.classList.add('dark');document.documentElement.classList.add('dark');document.documentElement.style.backgroundColor='#11110f';document.documentElement.style.colorScheme='dark';if(document.body){document.body.classList.add('dark');document.body.style.backgroundColor='#11110f';}}}catch(e){}})();`,
        }}
      />
      {children}
    </div>
  );
}
