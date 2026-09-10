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
    'https://maps.google.com/maps?q=-30.0125,-51.1685&hl=pt-BR&z=14&output=embed',
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

export type StudioScheduleInfo = {
  isOpenNow: boolean;
  isOpenToday: boolean;
  liveStatusText: string;
  openDaysLabel: string;
  hoursLabel: string;
  closedDaysLabel: string;
  openDays: number[];
  closedDays: number[];
  openTime: string;
  closeTime: string;
  bookingEnabled: boolean;
};

export function getStudioScheduleInfo(settings?: {
  open_days?: number[];
  open_time?: string;
  close_time?: string;
  booking_enabled?: boolean;
} | null): StudioScheduleInfo {
  const openDays = Array.isArray(settings?.open_days) ? settings!.open_days : [1, 2, 3, 4, 5, 6];
  const openTime = settings?.open_time || '09:00';
  const closeTime = settings?.close_time || '19:00';
  const bookingEnabled = settings?.booking_enabled !== false;

  const dayNamesShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dayNamesFull = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];

  if (openDays.length === 0) {
    return {
      isOpenNow: false,
      isOpenToday: false,
      liveStatusText: 'Agenda temporariamente fechada',
      openDaysLabel: 'Nenhum dia selecionado',
      hoursLabel: 'Sem expediente',
      closedDaysLabel: 'Todos os dias: Fechado',
      openDays,
      closedDays: [0, 1, 2, 3, 4, 5, 6],
      openTime,
      closeTime,
      bookingEnabled: false,
    };
  }

  const sorted = [...openDays].sort((a, b) => a - b);
  const isConsecutive = sorted.every((val, idx) => idx === 0 || val === sorted[idx - 1] + 1);

  let openDaysLabel = '';
  if (sorted.length === 7) {
    openDaysLabel = 'Todos os dias (Segunda a Domingo)';
  } else if (sorted.length === 6 && !sorted.includes(0)) {
    openDaysLabel = 'Segunda a Sábado';
  } else if (sorted.length === 5 && !sorted.includes(0) && !sorted.includes(6)) {
    openDaysLabel = 'Segunda a Sexta';
  } else if (isConsecutive && sorted.length > 1) {
    openDaysLabel = `${dayNamesFull[sorted[0]]} a ${dayNamesFull[sorted[sorted.length - 1]]}`;
  } else {
    openDaysLabel = sorted.map((d) => dayNamesShort[d]).join(', ');
  }

  const allDays = [0, 1, 2, 3, 4, 5, 6];
  const closedDays = allDays.filter((d) => !openDays.includes(d));
  let closedDaysLabel = '';
  if (closedDays.length === 0) {
    closedDaysLabel = 'Aberto todos os dias';
  } else if (closedDays.length === 1 && closedDays[0] === 0) {
    closedDaysLabel = 'Domingos: Fechado';
  } else {
    closedDaysLabel = `${closedDays.map((d) => dayNamesFull[d]).join(' e ')}: Fechado`;
  }

  // São Paulo timezone calculation
  let currentDow = 1;
  let currentMinutes = 0;
  try {
    const now = new Date();
    const spDateStr = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const spDate = new Date(spDateStr);
    currentDow = spDate.getDay();
    currentMinutes = spDate.getHours() * 60 + spDate.getMinutes();
  } catch {
    const now = new Date();
    currentDow = now.getDay();
    currentMinutes = now.getHours() * 60 + now.getMinutes();
  }

  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const openMin = (isNaN(openH) ? 9 : openH) * 60 + (isNaN(openM) ? 0 : openM);
  const closeMin = (isNaN(closeH) ? 19 : closeH) * 60 + (isNaN(closeM) ? 0 : closeM);

  const isOpenToday = openDays.includes(currentDow);
  const isWithinHours = currentMinutes >= openMin && currentMinutes < closeMin;
  const isOpenNow = bookingEnabled && isOpenToday && isWithinHours;

  let liveStatusText = 'Fechado agora';
  if (!bookingEnabled) {
    liveStatusText = 'Agendamentos pausados';
  } else if (isOpenNow) {
    liveStatusText = `Aberto agora · fecha às ${closeTime}`;
  } else if (isOpenToday && currentMinutes < openMin) {
    liveStatusText = `Abre hoje às ${openTime}`;
  } else if (isOpenToday && currentMinutes >= closeMin) {
    liveStatusText = `Encerrado por hoje · abre amanhã às ${openTime}`;
  } else {
    liveStatusText = 'Fechado no momento';
  }

  return {
    isOpenNow,
    isOpenToday,
    liveStatusText,
    openDaysLabel,
    hoursLabel: `${openTime} às ${closeTime}`,
    closedDaysLabel,
    openDays,
    closedDays,
    openTime,
    closeTime,
    bookingEnabled,
  };
}


