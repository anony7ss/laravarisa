import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal-page';
import styles from '@/components/legal-page.module.css';

export const metadata: Metadata = {
  title: 'Política de Cookies — Lara Varisa',
  description: 'Como o site Lara Varisa utiliza cookies essenciais e métricas opcionais.',
};

const sections: LegalSection[] = [
  {
    id: 'sobre-cookies',
    title: 'O que são cookies?',
    navTitle: 'O que são cookies',
    content: (
      <p>
        Cookies são pequenos arquivos usados para manter o site funcionando,
        lembrar preferências e, quando autorizados, entender de forma agregada
        como as páginas são utilizadas.
      </p>
    ),
  },
  {
    id: 'categorias',
    title: 'Categorias utilizadas',
    navTitle: 'Categorias utilizadas',
    content: (
      <div className={styles.dataGrid}>
        <div className={styles.detail}>
          <h3>Essenciais</h3>
          <p>
            Necessários para segurança, sessão, preferências e funcionamento do
            agendamento. Permanecem ativos.
          </p>
        </div>
        <div className={styles.detail}>
          <h3>Métricas opcionais</h3>
          <p>
            Podem medir visitas e desempenho de forma agregada. Só são ativadas
            quando você escolhe aceitar.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'suas-escolhas',
    title: 'Como mudar sua escolha',
    navTitle: 'Como mudar sua escolha',
    content: (
      <p>
        Você pode apagar os dados do site no navegador e escolher novamente
        quando o aviso aparecer. Para solicitar informações ou exercer direitos
        sobre dados pessoais, consulte a{' '}
        <Link href="/privacidade">Política de Privacidade</Link>.
      </p>
    ),
  },
];

export default function CookiesPolicyPage() {
  return (
    <LegalPage
      kind="cookies"
      description="Como o site Lara Varisa utiliza cookies essenciais e métricas opcionais."
      sections={sections}
    />
  );
}
