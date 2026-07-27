import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type FormField = {
  key: string;
  value: string;
};

function clean(value: unknown, maxLength = 5000): string {
  return String(value ?? '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function readFields(request: NextRequest): Promise<FormField[]> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = (await request.json()) as Record<string, unknown>;

    return Object.entries(body)
      .filter(([key, value]) => key !== '_cf_website' && typeof value !== 'object')
      .slice(0, 40)
      .map(([key, value]) => ({
        key: clean(key, 100),
        value: clean(value)
      }));
  }

  if (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded')
  ) {
    const form = await request.formData();

    if (form.get('_cf_website')) {
      return [];
    }

    return Array.from(form.entries())
      .filter(
        ([key, value]) =>
          key !== '_cf_website' && typeof value === 'string'
      )
      .slice(0, 40)
      .map(([key, value]) => ({
        key: clean(key, 100),
        value: clean(value)
      }));
  }

  throw new Error('UNSUPPORTED_FORM_FORMAT');
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!supabaseUrl || !serviceKey || !resendKey || !fromEmail) {
    return NextResponse.json(
      {
        error:
          'Form delivery is not configured. Check the Vercel email environment variables.'
      },
      { status: 503 }
    );
  }

  let fields: FormField[];

  try {
    fields = await readFields(request);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'UNSUPPORTED_FORM_FORMAT'
    ) {
      return NextResponse.json(
        { error: 'Unsupported form format.' },
        { status: 415 }
      );
    }

    return NextResponse.json(
      { error: 'The form submission could not be read.' },
      { status: 400 }
    );
  }

  // Honeypot submissions return success without sending.
  if (!fields.length) {
    return NextResponse.json({
      message: 'Thanks! Your message was sent.'
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('name, form_email, is_published')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (siteError) {
    console.error('Form site lookup failed:', siteError);

    return NextResponse.json(
      { error: 'The website form could not be loaded.' },
      { status: 500 }
    );
  }

  if (!site?.form_email) {
    return NextResponse.json(
      { error: 'This website has not configured a form recipient.' },
      { status: 400 }
    );
  }

  const replyTo =
    fields.find((field) => field.key.toLowerCase() === 'email')?.value || '';

  const text = fields
    .map((field) => `${field.key}: ${field.value}`)
    .join('\n\n');

  const html = fields
    .map(
      (field) =>
        `<p><strong>${field.key}</strong><br>${field.value.replace(/\n/g, '<br>')}</p>`
    )
    .join('');

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${resendKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [site.form_email],
      reply_to: isValidEmail(replyTo) ? replyTo : undefined,
      subject: `New website form submission — ${site.name}`,
      text,
      html
    })
  });

  if (!resendResponse.ok) {
    const resendError = await resendResponse.text();
    console.error('Resend email error:', resendError);

    return NextResponse.json(
      {
        error:
          'The message could not be delivered. Check the Vercel function logs and Resend configuration.'
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    message: 'Thanks! Your message was sent.'
  });
}
 
