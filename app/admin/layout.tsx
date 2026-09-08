import { cookies } from 'next/headers';
import './admin.css';

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('admin-theme')?.value;
  const isDark = themeCookie === 'dark';

  return (
    <div className={`admin-root${isDark ? ' dark' : ''}`}>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var c=(document.cookie.match(/(?:^|; )admin-theme=([^;]*)/)||[])[1];var l=localStorage.getItem('admin-theme');var t=c||l;if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){var r=document.currentScript.parentElement;if(r)r.classList.add('dark');document.documentElement.classList.add('dark');}}catch(e){}})();`,
        }}
      />
      {children}
    </div>
  );
}
