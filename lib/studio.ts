const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5551989601662';

export function whatsappUrl(message: string, phone = WHATSAPP_NUMBER) {
  const digits = (phone || '').replace(/\D/g, '');
  const recipient = /^\d{10,15}$/.test(digits) ? digits : '5551989601662';
  return `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
}

export const studio = {
  name: 'Lara Varisa - Lash Designer',
  bookingUrl: whatsappUrl('Olá, Lara! Quero agendar meu horário.'),
  whatsapp: 'Agendar pelo WhatsApp',
  whatsappNumber: WHATSAPP_NUMBER,
  whatsappFormatted: '(51) 98960-1662',
  instagram: '@laravarisa.lashes',
  instagramUrl: 'https://www.instagram.com/laravarisa.lashes/',
  email: 'contato@laravarisa.com.br',
  emailUrl: 'mailto:contato@laravarisa.com.br',
  address: 'Atendimento presencial na Zona Norte',
  city: 'Porto Alegre, RS — Endereço completo enviado no agendamento',
  hours: 'Segunda a sábado · com agendamento',
  mapEmbedUrl:
    'https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1sZona+Norte,+Porto+Alegre+-+RS',
  directionsUrl:
    'https://www.google.com/maps/search/?api=1&query=Zona+Norte%2C+Porto+Alegre+-+RS',
};

export type StudioSettings = typeof studio;

export function formatStudioSettings(dbSettings?: Record<string, any> | null): StudioSettings {
  if (!dbSettings) return studio;

  const phone = (dbSettings.whatsapp_phone || dbSettings.studio_phone || WHATSAPP_NUMBER).replace(/\D/g, '');
  const formattedPhone = phone.length >= 10
    ? phone.replace(/^55/, '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    : studio.whatsappFormatted;

  const email = (dbSettings.studio_email || studio.email).trim();

  return {
    name: dbSettings.studio_name?.trim() || studio.name,
    bookingUrl: whatsappUrl('Olá, Lara! Quero agendar meu horário.', phone),
    whatsapp: 'Agendar pelo WhatsApp',
    whatsappNumber: phone || WHATSAPP_NUMBER,
    whatsappFormatted: formattedPhone,
    instagram: dbSettings.studio_instagram?.trim() || studio.instagram,
    instagramUrl: dbSettings.studio_instagram_url?.trim() || studio.instagramUrl,
    email,
    emailUrl: `mailto:${email}`,
    address: dbSettings.studio_address?.trim() || studio.address,
    city: dbSettings.studio_city?.trim() || studio.city,
    hours: dbSettings.studio_hours?.trim() || studio.hours,
    mapEmbedUrl: dbSettings.studio_map_url?.trim() || studio.mapEmbedUrl,
    directionsUrl: dbSettings.studio_directions_url?.trim() || studio.directionsUrl,
  };
}

export type ContactMessage = {
  name: string;
  email: string;
  phone: string;
  message: string;
};
export function composeMessage(data: ContactMessage) {
  return `Olá, Lara! Meu nome é ${data.name.trim()}.\nE-mail: ${data.email.trim()}${data.phone.trim() ? `\nTelefone: ${data.phone.trim()}` : ''}\n\n${data.message.trim()}`;
}
export function contactUrl(data: ContactMessage, phone?: string) {
  return whatsappUrl(composeMessage(data), phone);
}

