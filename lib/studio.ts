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
  address: 'Atendimento presencial em São Paulo',
  city: 'Endereço completo enviado após o agendamento',
  hours: 'Segunda a sábado · com agendamento',
  mapEmbedUrl:
    'https://www.google.com/maps?q=S%C3%A3o%20Paulo%2C%20SP&output=embed',
  directionsUrl:
    'https://www.google.com/maps/search/?api=1&query=S%C3%A3o+Paulo%2C+SP',
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
