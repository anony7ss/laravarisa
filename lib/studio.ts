export const studio = {
  bookingUrl:
    'https://wa.me/?text=Ol%C3%A1%2C%20Lara!%20Quero%20agendar%20meu%20hor%C3%A1rio.',
  instagram: 'Instagram',
  instagramUrl: 'https://www.instagram.com/',
  whatsapp: 'Agendar pelo WhatsApp',
  whatsappNumber: '',
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
  const message = composeMessage(data);
  const number = studio.whatsappNumber.replace(/\D/g, '');
  const recipient = /^\d{10,15}$/.test(number) ? number : '';
  return `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
}
