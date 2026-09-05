import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  try {
    const body = await request.json();
    
    const payload = {
      client_name: body.client_name,
      client_phone: body.client_phone,
      has_allergies: body.has_allergies === 'true',
      allergies_detail: body.allergies_detail || null,
      pregnant: body.pregnant === 'true',
      eye_surgery: body.eye_surgery === 'true',
      thyroid_issues: body.thyroid_issues === 'true',
      signature: body.signature,
    };

    const { error } = await supabase.from('anamnesis').insert([payload]);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'JSON Invalido' }, { status: 400 });
  }
}
