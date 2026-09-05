export type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'archived';
  created_at: string;
};
export type ClientRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  created_from_lead?: string | null;
  created_at: string;
};
export type ServiceRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price_label: string;
  duration_label: string;
  duration_minutes: number;
  maintenance: string;
  intensity: number;
  sort_order: number;
  active: boolean;
};
export type GalleryRow = {
  id: string;
  title: string;
  subtitle: string;
  image_path: string;
  before_image_path?: string | null;
  alt_text: string;
  object_position: string;
  zoom: number;
  sort_order: number;
  active: boolean;
  public_url?: string;
};
export type AppointmentRow = {
  id: string;
  client_id?: string | null;
  lead_id?: string | null;
  service_id?: string | null;
  client_name: string;
  client_phone: string;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes: string;
};
export type TestimonialRow = {
  id: string;
  client_name: string;
  client_role: string;
  content: string;
  rating: number;
  active: boolean;
  sort_order: number;
  created_at: string;
};
