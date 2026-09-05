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
  email: '',
  address: 'Atendimento presencial',
  city: 'Local confirmado no agendamento',
  hours: 'Segunda a sábado · com agendamento',
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
