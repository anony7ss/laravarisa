import { whatsappUrl } from './studio';

export type LashService = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string;
  duration: string;
  maintenance: string;
  intensity: 1 | 2 | 3;
};

export const services: LashService[] = [
  {
    id: 'fio-a-fio',
    name: 'Fio a fio',
    category: 'Natural',
    description: 'Definição delicada para realçar o olhar com leveza.',
    price: 'R$ 120',
    duration: '2h',
    maintenance: 'A cada 15 a 20 dias',
    intensity: 1,
  },
  {
    id: 'volume-brasileiro',
    name: 'Volume brasileiro',
    category: 'Marcante',
    description: 'Volume equilibrado, com textura e pontas bem definidas.',
    price: 'R$ 150',
    duration: '2h',
    maintenance: 'A cada 15 a 20 dias',
    intensity: 2,
  },
  {
    id: 'volume-egipcio',
    name: 'Volume egípcio',
    category: 'Texturizado',
    description: 'Camadas leves que criam profundidade sem pesar o olhar.',
    price: 'R$ 165',
    duration: '2h15',
    maintenance: 'A cada 15 a 20 dias',
    intensity: 2,
  },
  {
    id: 'fox-eyes',
    name: 'Fox eyes',
    category: 'Alongado',
    description: 'Mapeamento que alonga visualmente o canto externo dos olhos.',
    price: 'R$ 170',
    duration: '2h15',
    maintenance: 'A cada 15 a 20 dias',
    intensity: 2,
  },
  {
    id: 'volume-russo',
    name: 'Volume russo',
    category: 'Intenso',
    description: 'Mais densidade e acabamento cheio para um olhar expressivo.',
    price: 'R$ 190',
    duration: '2h30',
    maintenance: 'A cada 15 dias',
    intensity: 3,
  },
  {
    id: 'lash-lifting',
    name: 'Lash lifting',
    category: 'Fios naturais',
    description: 'Curvatura e alinhamento dos cílios naturais, sem extensão.',
    price: 'R$ 130',
    duration: '1h15',
    maintenance: 'Novo procedimento em 6 a 8 semanas',
    intensity: 1,
  },
  {
    id: 'manutencao',
    name: 'Manutenção',
    category: 'Cuidado',
    description: 'Reposição dos fios para renovar o desenho e o acabamento.',
    price: 'A partir de R$ 85',
    duration: '1h30',
    maintenance: 'Conforme avaliação',
    intensity: 2,
  },
  {
    id: 'remocao',
    name: 'Remoção segura',
    category: 'Cuidado',
    description:
      'Retirada profissional das extensões preservando os fios naturais.',
    price: 'R$ 45',
    duration: '40min',
    maintenance: 'Sessão única',
    intensity: 1,
  },
];

export function serviceWhatsAppUrl(service: LashService) {
  return whatsappUrl(
    `Olá, Lara! Quero agendar o serviço ${service.name} (${service.price}, duração aproximada de ${service.duration}). Pode me enviar os horários disponíveis?`,
  );
}
