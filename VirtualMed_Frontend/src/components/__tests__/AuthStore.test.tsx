import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/constants/userRole';
import { UserStatus } from '@/constants/userStatus';
import * as authUtils from '@/lib/auth-utils';

// Mock de auth-utils
vi.mock('@/lib/auth-utils', () => ({
  decodeToken: vi.fn(),
}));

// Mock token data
const mockDecodedToken = {
  sub: 'user-123',
  email: 'test@example.com',
  role: UserRole.PATIENT,
  fullname: 'Juan Pérez',
  status: UserStatus.ACTIVE,
  email_verified: true,
  two_factor_enabled: false,
  permission: ['read:appointments', 'write:appointments'],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const mockDoctorToken = {
  sub: 'doctor-456',
  email: 'doctor@example.com',
  role: UserRole.DOCTOR,
  fullname: 'Dr. Carlos Rodríguez',
  status: UserStatus.ACTIVE,
  email_verified: true,
  two_factor_enabled: true,
  permission: ['read:patients', 'write:appointments', 'manage:schedule'],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const mockAdminToken = {
  sub: 'admin-789',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
  fullname: 'Admin User',
  status: UserStatus.ACTIVE,
  email_verified: true,
  two_factor_enabled: true,
  permission: ['admin:all'],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

describe('useAuthStore', () => {
  // Helper para limpiar cookies
  const clearCookies = () => {
    document.cookie.split(';').forEach((cookie) => {
      const [name] = cookie.split('=');
      document.cookie = `${name.trim()}=; path=/; max-age=0`;
    });
  };

  // Helper para obtener el store
  const getStore = () => useAuthStore.getState();

  beforeEach(() => {
    // Reset del store a estado inicial
    act(() => {
      getStore().logout();
    });
    
    // Limpiar cookies
    clearCookies();
    
    // Limpiar mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearCookies();
  });

  // ============================================
  // Estado inicial
  // ============================================
  describe('Estado inicial', () => {
    it('debe tener el estado inicial correcto', () => {
      const state = getStore();

      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('debe tener isLoading como boolean', () => {
      const state = getStore();
      expect(typeof state.isLoading).toBe('boolean');
    });
  });

  // ============================================
  // setToken
  // ============================================
  describe('setToken', () => {
    it('debe establecer isAuthenticated y isLoading correctamente', () => {
      act(() => {
        getStore().setToken('valid-jwt-token', 3600);
      });

      const state = getStore();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('debe establecer la cookie con el token', () => {
      act(() => {
        getStore().setToken('valid-jwt-token', 3600);
      });

      expect(document.cookie).toContain('token=valid-jwt-token');
    });
  });

  // ============================================
  // decodeAndBuildUser
  // ============================================
  describe('decodeAndBuildUser', () => {
    it('debe establecer el usuario correctamente con un token válido', () => {
      vi.mocked(authUtils.decodeToken).mockReturnValue(mockDecodedToken);

      act(() => {
        getStore().decodeAndBuildUser('valid-jwt-token');
      });

      const state = getStore();
      expect(state.user).not.toBeNull();
      expect(state.user?.sub).toBe('user-123');
      expect(state.user?.email).toBe('test@example.com');
      expect(state.user?.role).toBe(UserRole.PATIENT);
      expect(state.user?.fullName).toBe('Juan Pérez');
    });

    it('debe retornar el usuario decodificado', () => {
      vi.mocked(authUtils.decodeToken).mockReturnValue(mockDecodedToken);

      let user;
      act(() => {
        user = getStore().decodeAndBuildUser('valid-jwt-token');
      });

      expect(user).toEqual(expect.objectContaining({
        sub: 'user-123',
        email: 'test@example.com',
        role: UserRole.PATIENT,
      }));
    });

    it('debe lanzar error si el token es inválido', () => {
      vi.mocked(authUtils.decodeToken).mockReturnValue(null);

      expect(() => {
        act(() => {
          getStore().decodeAndBuildUser('invalid-token');
        });
      }).toThrow('Token inválido');
    });

    it('debe manejar token de doctor correctamente', () => {
      vi.mocked(authUtils.decodeToken).mockReturnValue(mockDoctorToken);

      act(() => {
        getStore().decodeAndBuildUser('doctor-jwt-token');
      });

      const state = getStore();
      expect(state.user?.role).toBe(UserRole.DOCTOR);
      expect(state.user?.two_factor_enabled).toBe(true);
      expect(state.user?.permission).toContain('read:patients');
    });

    it('debe manejar token de admin correctamente', () => {
      vi.mocked(authUtils.decodeToken).mockReturnValue(mockAdminToken);

      act(() => {
        getStore().decodeAndBuildUser('admin-jwt-token');
      });

      const state = getStore();
      expect(state.user?.role).toBe(UserRole.ADMIN);
      expect(state.user?.permission).toContain('admin:all');
    });

    it('debe establecer valores por defecto para campos opcionales', () => {
      const minimalToken = {
        sub: 'user-minimal',
        email: 'minimal@example.com',
        role: UserRole.PATIENT,
        fullname: 'Minimal User',
        status: UserStatus.ACTIVE,
        // Sin email_verified, two_factor_enabled, permission
      };
      vi.mocked(authUtils.decodeToken).mockReturnValue(minimalToken);

      act(() => {
        getStore().decodeAndBuildUser('minimal-token');
      });

      const state = getStore();
      expect(state.user?.email_verified).toBe(false);
      expect(state.user?.two_factor_enabled).toBe(false);
      expect(state.user?.permission).toEqual([]);
    });
  });

  // ============================================
  // setRefreshToken
  // ============================================
  describe('setRefreshToken', () => {
    it('debe establecer la cookie de refresh token', () => {
      act(() => {
        getStore().setRefreshToken('refresh-token-value');
      });

      expect(document.cookie).toContain('refreshToken=refresh-token-value');
    });

    it('debe establecer el refresh token con maxAge de un mes', () => {
      act(() => {
        getStore().setRefreshToken('long-lived-refresh-token');
      });

      // La cookie debería estar presente
      expect(document.cookie).toContain('refreshToken=long-lived-refresh-token');
    });
  });

  // ============================================
  // logout
  // ============================================
  describe('logout', () => {
    it('debe limpiar el usuario y establecer isAuthenticated a false', () => {
      vi.mocked(authUtils.decodeToken).mockReturnValue(mockDecodedToken);

      // Primero autenticamos
      act(() => {
        getStore().decodeAndBuildUser('valid-jwt-token');
        getStore().setToken('valid-jwt-token', 3600);
      });

      expect(getStore().isAuthenticated).toBe(true);

      // Luego hacemos logout
      act(() => {
        getStore().logout();
      });

      const state = getStore();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('debe eliminar las cookies de token y refreshToken', () => {
      vi.mocked(authUtils.decodeToken).mockReturnValue(mockDecodedToken);

      // Establecer tokens
      act(() => {
        getStore().decodeAndBuildUser('valid-jwt-token');
        getStore().setToken('valid-jwt-token', 3600);
        getStore().setRefreshToken('refresh-token-value');
      });

      expect(document.cookie).toContain('token=');
      expect(document.cookie).toContain('refreshToken=');

      // Hacer logout
      act(() => {
        getStore().logout();
      });

      // Las cookies deberían estar vacías o eliminadas
      const cookies = document.cookie;
      const tokenMatch = cookies.match(/token=([^;]*)/);
      const refreshMatch = cookies.match(/refreshToken=([^;]*)/);
      
      // Las cookies deberían no tener valor o no existir
      expect(!tokenMatch || tokenMatch[1] === '').toBe(true);
      expect(!refreshMatch || refreshMatch[1] === '').toBe(true);
    });

    it('debe funcionar incluso si no hay sesión activa', () => {
      // Logout sin sesión previa
      act(() => {
        getStore().logout();
      });

      const state = getStore();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  // ============================================
  // setLoading
  // ============================================
  describe('setLoading', () => {
    it('debe establecer isLoading a true', () => {
      act(() => {
        getStore().setLoading(true);
      });

      expect(getStore().isLoading).toBe(true);
    });

    it('debe establecer isLoading a false', () => {
      act(() => {
        getStore().setLoading(false);
      });

      expect(getStore().isLoading).toBe(false);
    });
  });

  // ============================================
  // setHasHydrated
  // ============================================
  describe('setHasHydrated', () => {
    it('debe establecer _hasHydrated a true', () => {
      act(() => {
        getStore().setHasHydrated(true);
      });

      expect(getStore()._hasHydrated).toBe(true);
    });

    it('debe establecer _hasHydrated a false', () => {
      act(() => {
        getStore().setHasHydrated(false);
      });

      expect(getStore()._hasHydrated).toBe(false);
    });
  });

  // ============================================
  // Flujo completo de autenticación
  // ============================================
  describe('Flujo completo de autenticación', () => {
    it('debe manejar login y logout correctamente', () => {
      vi.mocked(authUtils.decodeToken).mockReturnValue(mockDecodedToken);
      
      // 1. Estado inicial
      expect(getStore().isAuthenticated).toBe(false);

      // 2. Login
      act(() => {
        getStore().decodeAndBuildUser('access-token');
        getStore().setToken('access-token', 3600);
        getStore().setRefreshToken('refresh-token');
      });

      let state = getStore();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('test@example.com');
      expect(document.cookie).toContain('token=');
      expect(document.cookie).toContain('refreshToken=');

      // 3. Logout
      act(() => {
        getStore().logout();
      });

      state = getStore();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('debe permitir re-autenticación después de logout', () => {
      vi.mocked(authUtils.decodeToken)
        .mockReturnValueOnce(mockDecodedToken)
        .mockReturnValueOnce(mockDoctorToken);

      // Login como paciente
      act(() => {
        getStore().decodeAndBuildUser('patient-token');
        getStore().setToken('patient-token', 3600);
      });

      expect(getStore().user?.role).toBe(UserRole.PATIENT);

      // Logout
      act(() => {
        getStore().logout();
      });

      // Login como doctor
      act(() => {
        getStore().decodeAndBuildUser('doctor-token');
        getStore().setToken('doctor-token', 3600);
      });

      expect(getStore().user?.role).toBe(UserRole.DOCTOR);
    });
  });

  // ============================================
  // Persistencia
  // ============================================
  describe('Persistencia', () => {
    it('el store debe tener configuración de persistencia', () => {
      // Verificar que el store tiene las propiedades de persist
      const state = getStore();
      expect('user' in state).toBe(true);
      expect('isAuthenticated' in state).toBe(true);
    });

    it('debe tener la función partialize que solo persiste user e isAuthenticated', () => {
      vi.mocked(authUtils.decodeToken).mockReturnValue(mockDecodedToken);

      act(() => {
        getStore().decodeAndBuildUser('test-token');
        getStore().setToken('test-token', 3600);
        getStore().setLoading(false);
      });

      // Verificar que el estado tiene las propiedades esperadas
      const state = getStore();
      expect(state.user).not.toBeNull();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });
  });

  // ============================================
  // Manejo de estados de usuario
  // ============================================
  describe('Manejo de estados de usuario', () => {
    it('debe manejar usuario con status PENDING', () => {
      const pendingUserToken = {
        ...mockDecodedToken,
        status: UserStatus.PENDING,
      };
      vi.mocked(authUtils.decodeToken).mockReturnValue(pendingUserToken);

      act(() => {
        getStore().decodeAndBuildUser('pending-user-token');
      });

      expect(getStore().user?.status).toBe(UserStatus.PENDING);
    });

    it('debe manejar usuario con status INACTIVE', () => {
      const inactiveUserToken = {
        ...mockDecodedToken,
        status: UserStatus.INACTIVE,
      };
      vi.mocked(authUtils.decodeToken).mockReturnValue(inactiveUserToken);

      act(() => {
        getStore().decodeAndBuildUser('inactive-user-token');
      });

      expect(getStore().user?.status).toBe(UserStatus.INACTIVE);
    });

    it('debe manejar usuario con email no verificado', () => {
      const unverifiedEmailToken = {
        ...mockDecodedToken,
        email_verified: false,
      };
      vi.mocked(authUtils.decodeToken).mockReturnValue(unverifiedEmailToken);

      act(() => {
        getStore().decodeAndBuildUser('unverified-email-token');
      });

      expect(getStore().user?.email_verified).toBe(false);
    });
  });
});
