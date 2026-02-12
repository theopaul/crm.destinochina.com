import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PUBLIC_PATHS = ['/login', '/auth/callback']
const WEBHOOK_PREFIX = '/api/webhooks'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow webhook endpoints to pass through without auth
  if (pathname.startsWith(WEBHOOK_PREFIX)) {
    return NextResponse.next()
  }

  const { user, supabaseResponse } = await updateSession(request)

  // Allow public paths
  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  )

  if (!user && !isPublicPath) {
    // Not authenticated and trying to access a protected route
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    // Already authenticated, redirect to desk
    const url = request.nextUrl.clone()
    url.pathname = '/desk'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets (images, svg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
