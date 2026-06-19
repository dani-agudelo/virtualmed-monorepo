import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  decodeToken,
  getTokenRole,
  getTokenStatus,
  getTokenEmail,
  getTokenPermissions,
  isTokenExpired,
  isTokenValid,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
  isUserActive,
  getTokenValidationStatus,
  getCookie,
  getTokenFromCookie,
  getDashboardPathByRole,
  waitForCookie,
} from '@/lib/auth-utils';
import { UserRole } from '@/constants/userRole';
import { UserStatus } from '@/constants/userStatus';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Genera un JWT fake con el payload dado.
 * No está firmado — solo sirve para tests de decodificación.
 */
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

const FUTURE_EXP = Math.floor(Date.now() / 1000) + 3600; // 1 hora en el futuro
const PAST_EXP = Math.floor(Date.now() / 1000) - 3600;   // 1 hora en el pasado

const validPayload = {
  sub: 'user-123',
  email: 'test@example.com',
  role: UserRole.PATIENT,
  status: UserStatus.ACTIVE,
  fullname: 'Juan Pérez',
  permission: ['read:profile', 'edit:profile'],
  exp: FUTURE_EXP,
  iat: Math.floor(Date.now() / 1000),
};

const validToken = makeJwt(validPayload);
const expiredToken = makeJwt({ ...validPayload, exp: PAST_EXP });
const noExpToken = makeJwt({ ...validPayload, exp: undefined });
const incompleteToken = makeJwt({ sub: 'user-123' }); // sin email, role, status

// ============================================================================
// Tests
// ============================================================================

describe('auth-utils', () => {

  describe('decodeToken', () => {
    it('debe decodificar un token válido y retornar el payload', () => {
      const decoded = decodeToken(validToken);
      expect(decoded).not.toBeNull();
      expect(decoded?.email).toBe('test@example.com');
      expect(decoded?.role).toBe(UserRole.PATIENT);
    });

    it('debe retornar null si el token es inválido', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = decodeToken('not-a-jwt');
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it('debe retornar null si el token está vacío', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = decodeToken('');
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------

  describe('getTokenRole', () => {
    it('debe retornar el rol del token', () => {
      expect(getTokenRole(validToken)).toBe(UserRole.PATIENT);
    });

    it('debe retornar null si el token no tiene rol', () => {
      expect(getTokenRole(incompleteToken)).toBeNull();
    });
  });

  // --------------------------------------------------------------------------

  describe('getTokenStatus', () => {
    it('debe retornar el status del token', () => {
      expect(getTokenStatus(validToken)).toBe('Active');
    });

    it('debe retornar null si el token no tiene status', () => {
      expect(getTokenStatus(incompleteToken)).toBeNull();
    });
  });

  // --------------------------------------------------------------------------

  describe('getTokenEmail', () => {
    it('debe retornar el email del token', () => {
      expect(getTokenEmail(validToken)).toBe('test@example.com');
    });

    it('debe retornar null si el token no tiene email', () => {
      expect(getTokenEmail(incompleteToken)).toBeNull();
    });
  });

  // --------------------------------------------------------------------------

  describe('getTokenPermissions', () => {
    it('debe retornar los permisos del token', () => {
      const permissions = getTokenPermissions(validToken);
      expect(permissions).toContain('read:profile');
      expect(permissions).toContain('edit:profile');
    });

    it('debe retornar array vacío si el token no tiene permisos', () => {
      expect(getTokenPermissions(incompleteToken)).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------

  describe('isTokenExpired', () => {
    it('debe retornar false para un token vigente', () => {
      expect(isTokenExpired(validToken)).toBe(false);
    });

    it('debe retornar true para un token expirado', () => {
      expect(isTokenExpired(expiredToken)).toBe(true);
    });

    it('debe retornar true si el token no tiene exp', () => {
      expect(isTokenExpired(noExpToken)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------

  describe('isTokenValid', () => {
    it('debe retornar true para un token completo y vigente', () => {
      expect(isTokenValid(validToken)).toBe(true);
    });

    it('debe retornar false para un token expirado', () => {
      expect(isTokenValid(expiredToken)).toBe(false);
    });

    it('debe retornar false para un token sin campos requeridos', () => {
      expect(isTokenValid(incompleteToken)).toBe(false);
    });

    it('debe retornar false para un string vacío', () => {
      expect(isTokenValid('')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------

  describe('hasPermission', () => {
    it('debe retornar true si el usuario tiene el permiso', () => {
      expect(hasPermission(validToken, 'read:profile')).toBe(true);
    });

    it('debe retornar false si el usuario no tiene el permiso', () => {
      expect(hasPermission(validToken, 'delete:user')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------

  describe('hasAnyPermission', () => {
    it('debe retornar true si tiene al menos uno de los permisos', () => {
      expect(hasAnyPermission(validToken, ['read:profile', 'delete:user'])).toBe(true);
    });

    it('debe retornar false si no tiene ninguno de los permisos', () => {
      expect(hasAnyPermission(validToken, ['delete:user', 'admin:panel'])).toBe(false);
    });
  });

  // --------------------------------------------------------------------------

  describe('hasAllPermissions', () => {
    it('debe retornar true si tiene todos los permisos', () => {
      expect(hasAllPermissions(validToken, ['read:profile', 'edit:profile'])).toBe(true);
    });

    it('debe retornar false si le falta algún permiso', () => {
      expect(hasAllPermissions(validToken, ['read:profile', 'delete:user'])).toBe(false);
    });
  });

  // --------------------------------------------------------------------------

  describe('hasRole', () => {
    it('debe retornar true si el usuario tiene el rol correcto', () => {
      expect(hasRole(validToken, UserRole.PATIENT)).toBe(true);
    });

    it('debe retornar false si el usuario tiene un rol diferente', () => {
      expect(hasRole(validToken, UserRole.DOCTOR)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------

  describe('isUserActive', () => {
    it('debe retornar true si el status es Active', () => {
      expect(isUserActive(validToken)).toBe(true);
    });

    it('debe retornar false si el status es Inactive', () => {
      const inactiveToken = makeJwt({ ...validPayload, status: 'Inactive' });
      expect(isUserActive(inactiveToken)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------

  describe('getTokenValidationStatus', () => {
    it('debe retornar el estado completo de un token válido', () => {
      const result = getTokenValidationStatus(validToken);
      expect(result.isValid).toBe(true);
      expect(result.isExpired).toBe(false);
      expect(result.role).toBe(UserRole.PATIENT);
      expect(result.status).toBe('Active');
    });

    it('debe retornar isValid false y isExpired true para token expirado', () => {
      const result = getTokenValidationStatus(expiredToken);
      expect(result.isValid).toBe(false);
      expect(result.isExpired).toBe(true);
    });
  });

  // --------------------------------------------------------------------------

  describe('getDashboardPathByRole', () => {
    it('debe retornar la ruta de admin para rol ADMIN', () => {
      expect(getDashboardPathByRole(UserRole.ADMIN)).toBe('/dashboard/admin');
    });

    it('debe retornar /login para rol no soportado', () => {
      expect(getDashboardPathByRole('UnknownRole')).toBe('/login');
    });
  });

  // --------------------------------------------------------------------------

  describe('getCookie', () => {
    beforeEach(() => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '',
      });
    });

    it('debe retornar el valor de una cookie existente', () => {
      document.cookie = 'token=abc123; other=xyz';
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'token=abc123; other=xyz',
      });

      expect(getCookie('token')).toBe('abc123');
    });

    it('debe retornar null si la cookie no existe', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'other=xyz',
      });

      expect(getCookie('token')).toBeNull();
    });

    it('debe retornar null en entorno sin document', () => {
      const originalDocument = global.document;
      // @ts-ignore
      global.document = undefined;
      expect(getCookie('token')).toBeNull();
      global.document = originalDocument;
    });
  });

  // --------------------------------------------------------------------------

  describe('getTokenFromCookie', () => {
    it('debe retornar el token desde la cookie', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'token=my-jwt-token',
      });

      expect(getTokenFromCookie()).toBe('my-jwt-token');
    });

    it('debe retornar null si no hay cookie de token', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '',
      });

      expect(getTokenFromCookie()).toBeNull();
    });
  });

  // --------------------------------------------------------------------------

  describe('waitForCookie', () => {
    beforeEach(() => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '',
      });
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('debe resolver true inmediatamente si la cookie ya existe', async () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'token=abc123',
      });

      const result = await waitForCookie('token');
      expect(result).toBe(true);
    });

    it('debe resolver true cuando la cookie aparece antes del timeout', async () => {
      const promise = waitForCookie('token', 1000);

      // Simular que la cookie aparece después de 100ms
      setTimeout(() => {
        Object.defineProperty(document, 'cookie', {
          writable: true,
          value: 'token=abc123',
        });
      }, 100);

      await vi.runAllTimersAsync();
      expect(await promise).toBe(true);
    });

    it('debe resolver false si la cookie no aparece antes del timeout', async () => {
      const promise = waitForCookie('token', 500);

      await vi.runAllTimersAsync();
      expect(await promise).toBe(false);
    });
  });
});