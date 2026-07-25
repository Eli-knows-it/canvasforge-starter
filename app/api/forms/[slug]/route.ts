import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function clean(value: FormDataEntryValue) {
  return String(value).replace(/[<>]/g, '').trim().slice(0, 5000);
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!supabaseUrl || !serviceKey || !resendKey || !fromEmail) {
    return NextResponse.json({ error: 'Form delivery is not configured.' }, { status: 503 });
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded')) {
    return NextResponse.json({ error: 'Unsupported form format.' }, { status: 415 });
  }

  const form = await request.formData();
  if (form.get('_cf_website')) return NextResponse.json({ message: 'Thanks! Your message was sent.' });

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: site } = await supabase
    .from('sites')
    .select('name, form_email, is_published')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (!site?.form_email) return NextResponse.json({ error: 'This website has not configured a form recipient.' }, { status: 400 });

  const fields = Array.from(form.entries())
    .filter(([key, value]) => key !== '_cf_website' && typeof value === 'string')
    .slice(0, 40)
    .map(([key, value]) => ({ key: clean(key).slice(0, 100), value: clean(value) }));

  if (!fields.length) return NextResponse.json({ error: 'The form was empty.' }, { status: 400 });
  const replyTo = fields.find((field) => field.key.toLowerCase() === 'email')?.value;
  const text = fields.map((field) => `${field.key}: ${field.value}`).join('\n\n');
  const html = fields.map((field) => `<p><strong>${field.key}</strong><br>${field.value.replace(/\n/g, '<br>')}</p>`).join('');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: [site.form_email],
      reply_to: replyTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo) ? replyTo : undefined,
      subject: `New website form submission — ${site.name}`,
      text,
      html
    })
  });

  if (!response.ok) {
    console.error('Resend error', await response.text());
    return NextResponse.json({ error: 'The message could not be delivered.' }, { status: 502 });
  }
  return NextResponse.json({ message: 'Thanks! Your message was sent.' });
}
