import { jwtDecode } from 'jwt-decode';
import { UserRole } from '@/constants/userRole';
import { UserStatus } from '@/constants/userStatus';

interface DecodedToken {
  sub?: string;
  email?: string;
  role?: string;
  status?: string;
  fullName?: string;
  two_factor_enabled?: boolean;
  permission?: string[];
  iat?: number;
  exp?: number;
  [key: string]: any;
}

/**
 * Decodifica un JWT y extrae su payload
 */
export function decodeToken(token: string): DecodedToken | null {
  try {
    const decoded = jwtDecode<DecodedToken>(token);
    return decoded;
  } catch (error) {
    console.error('Error decodificando token:', error);
    return null;
  }
}

/**
 * Obtiene el rol del token decodificado
 */
export function getTokenRole(token: string): string | null {
  const decoded = decodeToken(token);
  return decoded?.role || null;
}

/**
 * Obtiene el status del token decodificado
 */
export function getTokenStatus(token: string): string | null {
  const decoded = decodeToken(token);
  return decoded?.status || null;
}

/**
 * Obtiene el email del token decodificado
 */
export function getTokenEmail(token: string): string | null {
  const decoded = decodeToken(token);
  return decoded?.email || null;
}

/**
 * Obtiene los permisos del token decodificado
 */
export function getTokenPermissions(token: string): string[] {
  const decoded = decodeToken(token);
  return decoded?.permission || [];
}

/**
 * Verifica si el token ha expirado
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded?.exp) return true;
  
  const now = Math.floor(Date.now() / 1000);
  return decoded.exp < now;
}

/**
 * Verifica si el token es válido (no expirado y tiene datos completos)
 */
export function isTokenValid(token: string): boolean {
  if (!token) return false;
  
  const decoded = decodeToken(token);
  if (!decoded) return false;
  
  // Check required fields
  if (!decoded.sub || !decoded.email || !decoded.role || !decoded.status) {
    return false;
  }
  
  // Check if expired
  return !isTokenExpired(token);
}

/**
 * Verifica si el usuario tiene un permiso específico
 */
export function hasPermission(token: string, permission: string): boolean {
  const permissions = getTokenPermissions(token);
  return permissions.includes(permission);
}

/**
 * Verifica si el usuario tiene alguno de los permisos especificados
 */
export function hasAnyPermission(token: string, permissions: string[]): boolean {
  const userPermissions = getTokenPermissions(token);
  return permissions.some((permission) => userPermissions.includes(permission));
}

/**
 * Verifica si el usuario tiene todos los permisos especificados
 */
export function hasAllPermissions(token: string, permissions: string[]): boolean {
  const userPermissions = getTokenPermissions(token);
  return permissions.every((permission) => userPermissions.includes(permission));
}

/**
 * Verifica si el usuario tiene el rol especificado
 */
export function hasRole(token: string, role: UserRole): boolean {
  const userRole = getTokenRole(token);
  return userRole === role;
}

/**
 * Verifica si el usuario está activo (status = Active)
 */
export function isUserActive(token: string): boolean {
  const status = getTokenStatus(token);
  return status === UserStatus.ACTIVE;
}

/**
 * Retorna el estado de validación completo de un JWT
 */
export function getTokenValidationStatus(token: string): {
  isValid: boolean;
  isExpired: boolean;
  role: string | null;
  status: string | null;
} {
  return {
    isValid: isTokenValid(token),
    isExpired: isTokenExpired(token),
    role: getTokenRole(token),
    status: getTokenStatus(token),
  };
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.substring(name.length + 1)) : null;
}

/**
 * Obtiene y decodifica el token desde la cookie
 */
export function getTokenFromCookie(): string | null {
  return getCookie('token');
}

export function getDashboardPathByRole(role?: string | null): string {
  switch (role) {
    case UserRole.ADMIN:
      return '/dashboard/admin';
    case UserRole.DOCTOR:
      return '/dashboard/doctor';
    case UserRole.PATIENT:
      return '/dashboard/patient';
    case UserRole.ADMIN:
      return '/dashboard/admin';
    default:
      return '/login';
  }
}

export const waitForCookie = (cookieName: string, timeout = 1000): Promise<boolean> => {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (document.cookie.includes(cookieName)) {
        resolve(true);
      } else if (Date.now() - start > timeout) {
        resolve(false);
      } else {
        setTimeout(check, 20);
      }
    };
    check();
  });
};
