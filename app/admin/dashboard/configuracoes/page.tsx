import { requireStaff } from '@/lib/admin-auth';
import { SettingsManager } from '@/components/admin/settings-manager';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const context = await requireStaff();
  const supabase = context.supabase;

  const { data: settings } = await supabase
    .from('site_settings')
    // Keep the server component payload explicit. The settings table also
    // contains private operational values (for example the Lara phone and
    // notification templates); only fields consumed by the admin form are
    // serialized to the browser.
    .select('id,promo_active,promo_text,promo_conditions,promo_link_text,promo_link_url,booking_enabled,booking_closed_message,open_days,open_time,close_time,break_start,break_end,buffer_minutes,slot_interval_minutes,min_lead_hours,max_future_days,whatsapp_phone,lara_phone,notify_lara_on_new_booking,notify_lara_on_human_transfer,notify_admin_sound,whatsapp_confirmation_message,whatsapp_booking_message,booking_alert,studio_name,studio_instagram,studio_instagram_url,studio_email,studio_address,studio_city,studio_hours,studio_map_url,studio_directions_url,reminder_active,reminder_hours_before,reminder_message_template,reminder_same_day_active,reminder_same_day_hours_before,reminder_same_day_message_template,post_care_active,post_care_hours_after,google_review_url,post_care_message_template,notify_on_status_change,msg_cancelled_template,msg_no_show_template,msg_completed_template,whatsapp_audio_mode,whatsapp_audio_voice,booking_layout_style,booking_theme,booking_bg_color,booking_card_bg,booking_primary_color,booking_accent_color,booking_text_color,booking_border_color,booking_font_heading,booking_font_body,booking_cover_url,booking_avatar_url,booking_title,booking_subtitle,booking_location_label,booking_promo_tag,booking_guarantee_text')
    .eq('id', 'global')
    .single();

  return (
    <div className="admin-page">
      <div className="admin-page-title">
        <div>
          <p className="admin-kicker">PREFERÊNCIAS</p>
          <h1>Configurações</h1>
        </div>
      </div>
      <SettingsManager initialSettings={settings || {}} role={context.profile.role} />
    </div>
  );
}
