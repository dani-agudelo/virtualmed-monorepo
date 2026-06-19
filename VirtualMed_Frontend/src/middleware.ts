// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtDecode } from 'jwt-decode';
import { UserRole } from '@/constants/userRole';
import { getDashboardPathByRole } from '@/lib/auth-utils';

interface DecodedToken {
  role?: string;
  status?: string;
  exp?: number;
  [key: string]: any;
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const pathname = request.nextUrl.pathname;

  const redirectToLogin = () => NextResponse.redirect(new URL('/login', request.url));

  const clearAuthCookies = (response: NextResponse) => {
    response.cookies.delete('token');
    response.cookies.delete('refreshToken');
    return response;
  };

  const isLoginRoute = pathname.startsWith('/login');

  // Sin token → solo se permite entrar a login
  if (!token) {
    return isLoginRoute ? NextResponse.next() : redirectToLogin();
  }

  let decoded: DecodedToken;
  try {
    decoded = jwtDecode<DecodedToken>(token);
  } catch {
    // Token malformado → limpiar cookies
    const res = clearAuthCookies(isLoginRoute ? NextResponse.next() : redirectToLogin());
    return res;
  }

  // Token expirado → limpiar y redirigir
  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp && decoded.exp < now) {
    const res = clearAuthCookies(isLoginRoute ? NextResponse.next() : redirectToLogin());
    return res;
  }

  const userRole = decoded.role;
  const correctPath = getDashboardPathByRole(userRole);

  if (isLoginRoute) {
    return NextResponse.redirect(new URL(correctPath, request.url));
  }

  // Si intenta acceder a un dashboard que no le corresponde
  // → redirigir a su dashboard correcto
  if (pathname.startsWith('/dashboard/patient') && userRole !== UserRole.PATIENT) {
    return NextResponse.redirect(
      new URL(correctPath, request.url)
    );
  }

  if (pathname.startsWith('/dashboard/doctor') && userRole !== UserRole.DOCTOR) {
    return NextResponse.redirect(
      new URL(correctPath, request.url)
    );
  }

  if (pathname.startsWith('/dashboard/admin') && userRole !== UserRole.ADMIN) {
    return NextResponse.redirect(
      new URL(correctPath, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login/:path*'],
};