import { NextRequest, NextResponse } from 'next/server';

const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'canvasforge.com').toLowerCase();

export function proxy(request: NextRequest) {
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  const path = request.nextUrl.pathname;
  if (path.startsWith('/api/') || path.startsWith('/_next/') || path.startsWith('/site/') || path.includes('.')) {
    return NextResponse.next();
  }

  const suffix = `.${rootDomain}`;
  if (host.endsWith(suffix)) {
    const slug = host.slice(0, -suffix.length);
    if (slug && slug !== 'www' && !slug.includes('.')) {
      const url = request.nextUrl.clone();
      url.pathname = `/site/${slug}${path === '/' ? '' : path}`;
      return NextResponse.rewrite(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
