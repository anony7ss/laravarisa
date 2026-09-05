const WHATSAPP_NUMBER = '';

export function whatsappUrl(message: string) {
  const number = WHATSAPP_NUMBER.replace(/\D/g, '');
  const recipient = /^\d{10,15}$/.test(number) ? number : '';
  return `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
}

export const studio = {
  bookingUrl: whatsappUrl('Olá, Lara! Quero agendar meu horário.'),
  whatsapp: 'Agendar pelo WhatsApp',
  whatsappNumber: WHATSAPP_NUMBER,
  instagram: '@laravarisa.lashes',
  instagramUrl: 'https://www.instagram.com/laravarisa.lashes/',
  email: 'contato@laravarisa.com.br',
  emailUrl: 'mailto:contato@laravarisa.com.br',
  address: 'Atendimento presencial na Zona Norte',
  city: 'Porto Alegre, RS — Endereço completo enviado no agendamento',
  hours: 'Segunda a sábado · com agendamento',
  mapEmbedUrl:
    'https://www.google.com/maps?q=Zona%20Norte%2C%20Porto%20Alegre%20-%20RS&output=embed',
  directionsUrl:
    'https://www.google.com/maps/search/?api=1&query=Zona+Norte%2C+Porto+Alegre+-+RS',
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
  return whatsappUrl(composeMessage(data));
}
