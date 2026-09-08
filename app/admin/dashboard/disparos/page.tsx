import { redirect } from 'next/navigation';

export default async function DisparosPage() {
  redirect('/admin/dashboard/whatsapp?tab=disparos');
}
