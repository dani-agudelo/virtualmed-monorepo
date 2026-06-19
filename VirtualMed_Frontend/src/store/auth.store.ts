// src/store/auth.store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { decodeToken } from '@/lib/auth-utils';
import { User } from '@/types';
import { UserRole } from "@/constants/userRole";
import { UserStatus } from '@/constants/userStatus';

const TOKEN_COOKIE = 'token';
const REFRESH_TOKEN_COOKIE = 'refreshToken';
const TEMP_TWO_FACTOR_COOKIE = 'tempTwoFactorToken';
const ONE_MONTH = 60 * 60 * 24 * 30;
const TEN_MINUTES = 60 * 10;

function setCookie(name: string, value: string, maxAge: number) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0`;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.substring(name.length + 1)) : null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  _hasHydrated: boolean;

  setHasHydrated: (state: boolean) => void;
  decodeAndBuildUser: (token: string) => User;
  setToken: (token: string, expiresIn: number) => void;
  setRefreshToken: (refreshToken: string) => void;
  setTempTwoFactorToken: (tempToken: string) => void;
  getTempTwoFactorToken: () => string | null;
  clearTempTwoFactorToken: () => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      decodeAndBuildUser: (token: string): User => {
        const decoded = decodeToken(token);
        if (!decoded) throw new Error('Token inválido');

        const user: User = {
          sub: decoded.sub!,
          email: decoded.email!,
          role: decoded.role as UserRole,
          fullName: decoded.fullname!,
          status: decoded.status as UserStatus.ACTIVE | UserStatus.PENDING | UserStatus.INACTIVE,
          email_verified: decoded.email_verified ?? false,
          two_factor_enabled: decoded.two_factor_enabled ?? false,
          permission: decoded.permission ?? [],
        };
        set({ user });
        return user;
      },

      setToken: (token: string, expiresIn: number) => {
        setCookie(TOKEN_COOKIE, token, expiresIn);
        set({ isAuthenticated: true, isLoading: false });
      },

      setRefreshToken: (refreshToken) => {
        setCookie(REFRESH_TOKEN_COOKIE, refreshToken, ONE_MONTH);
      },

      setTempTwoFactorToken: (tempToken: string) => {
        setCookie(TEMP_TWO_FACTOR_COOKIE, tempToken, TEN_MINUTES);
      },

      getTempTwoFactorToken: () => {
        return getCookie(TEMP_TWO_FACTOR_COOKIE);
      },

      clearTempTwoFactorToken: () => {
        deleteCookie(TEMP_TWO_FACTOR_COOKIE);
      },

      logout: () => {
        deleteCookie(TOKEN_COOKIE);
        deleteCookie(REFRESH_TOKEN_COOKIE);
        deleteCookie(TEMP_TWO_FACTOR_COOKIE);
        set({
          user: null,
          isAuthenticated: false,
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state, error) => {
        state?.setHasHydrated(true); // Marca cuando Zustand terminó de hidratar
      },
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          // En SSR retorna un storage vacío que no hace nada
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
