export const studio = {
  demo: true,
  bookingUrl: '',
  instagram: '@laravarisa.exemplo',
  instagramUrl: '',
  whatsapp: '+55 (00) 00000-0000',
  whatsappNumber: '',
  email: 'contato@example.com',
  address: 'Rua Exemplo, 123 · Centro',
  city: 'São Paulo · SP',
  mapsUrl: '',
  hours: 'Segunda a sábado · com agendamento',
  contactMode: 'whatsapp' as 'whatsapp' | 'email',
};
export type ContactMessage = {
  name: string;
  email: string;
  phone: string;
  message: string;
};
export function composeMessage(data: ContactMessage) {
  return `Olá, Lara! Meu nome é ${data.name.trim()}.\nE-mail: ${data.email.trim()}${data.phone.trim() ? `\nTelefone: ${data.phone.trim()}` : ''}\n\n${data.message.trim()}`;
}
export function contactUrl(data: ContactMessage) {
  if (studio.demo) return null;
  const message = composeMessage(data);
  if (studio.contactMode === 'whatsapp') {
    const number = studio.whatsappNumber.replace(/\D/g, '');
    return /^\d{10,15}$/.test(number)
      ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
      : null;
  }
  return studio.email && !studio.email.endsWith('@example.com')
    ? `mailto:${studio.email}?subject=${encodeURIComponent('Contato pelo site — ' + data.name.trim())}&body=${encodeURIComponent(message)}`
    : null;
}
