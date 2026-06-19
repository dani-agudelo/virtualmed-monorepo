import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import LoginPage from '../../app/login/page';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/hooks/use-toast';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('@/store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

vi.mock('@/components/login/loginForm', () => ({
  LoginForm: () => React.createElement('div', null, 'Login Form Mock'),
}));

describe('LoginPage', () => {
  const mockPush = vi.fn();
  const mockReplace = vi.fn();
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    });

    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    } as any);

    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
    } as any);

    vi.mocked(useSearchParams).mockReturnValue({
      get: vi.fn().mockReturnValue(null),
    } as any);
  });

  it('debe mostrar toast de sesión expirada y limpiar query param cuando reason=session-expired', async () => {
    vi.mocked(useSearchParams).mockReturnValue({
      get: vi.fn((key: string) => (key === 'reason' ? 'session-expired' : null)),
    } as any);

    render(<LoginPage />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Sesión expirada',
          description: 'Tu sesión ha expirado. Inicia sesión nuevamente.',
          variant: 'destructive',
        })
      );
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });
});
