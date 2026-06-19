import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../login/loginForm';
import { authService } from '@/lib/api/auth.service';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { waitForCookie } from '@/lib/auth-utils';
import axios from 'axios';
import { UserRole } from '@/constants/userRole';
import { UserStatus } from '@/constants/userStatus';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/lib/api/auth.service', () => ({
  authService: {
    login: vi.fn(),
  },
}));
vi.mock('@/hooks/use-toast');
vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('@/store/auth.store', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/lib/auth-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-utils')>();
  return {
    ...actual,
    waitForCookie: vi.fn(),
  };
});

// ============================================================================
// Fixtures
// ============================================================================

const mockPatientToken = {
  accessToken: 'token-123',
  refreshToken: 'refresh-123',
  expiresInSeconds: 3600,
};

const mockPatientUser = {
  fullName: 'Juan Pérez',
  role: UserRole.PATIENT,
  status: UserStatus.ACTIVE,
};

const mockDoctorUser = {
  fullName: 'Dra. García',
  role: UserRole.DOCTOR,
  status: UserStatus.ACTIVE,
};

const mockAdminUser = {
  fullName: 'Admin Root',
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
};

// ============================================================================
// Test suite
// ============================================================================

describe('LoginForm', () => {
  const mockToast = vi.fn();
  const mockPush = vi.fn();
  const mockSetToken = vi.fn();
  const mockSetRefreshToken = vi.fn();
  const mockSetTempTwoFactorToken = vi.fn();
  const mockDecodeAndBuildUser = vi.fn();
  const localStorageSetItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  const localStorageRemoveItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});
  const localStorageGetItem = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageSetItem.mockImplementation(() => {});
    localStorageRemoveItem.mockImplementation(() => {});
    localStorageGetItem.mockReturnValue(null);

    (useToast as ReturnType<typeof vi.fn>).mockReturnValue({ toast: mockToast });
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ push: mockPush });
    vi.mocked(useAuthStore).mockReturnValue({
      setToken: mockSetToken,
      setRefreshToken: mockSetRefreshToken,
      setTempTwoFactorToken: mockSetTempTwoFactorToken,
      decodeAndBuildUser: mockDecodeAndBuildUser,
    } as any);

    mockDecodeAndBuildUser.mockReturnValue(mockPatientUser);
    vi.mocked(waitForCookie).mockResolvedValue(true);
    vi.mocked(authService.login).mockResolvedValue(mockPatientToken as any);

    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});
  });

  // --------------------------------------------------------------------------

  describe('Renderizado', () => {
    it('debe renderizar todos los campos del formulario', () => {
      render(<LoginForm />);

      expect(document.getElementById('email')).toBeInTheDocument();
      expect(document.getElementById('password')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /recuerda mi correo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
    });

    it('debe renderizar los links de registro', () => {
      render(<LoginForm />);

      expect(screen.getByRole('link', { name: /paciente/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /médico/i })).toBeInTheDocument();
    });

    it('debe tener los campos vacíos por defecto', () => {
      render(<LoginForm />);

      expect(document.getElementById('email')).toHaveValue('');
      expect(document.getElementById('password')).toHaveValue('');
    });

    it('debe prellenar el email si existe en localStorage', () => {
      localStorageGetItem.mockReturnValue('saved@example.com');
      render(<LoginForm />);

      expect(document.getElementById('email')).toHaveValue('saved@example.com');
    });
  });

  // --------------------------------------------------------------------------

  describe('Validación', () => {
    it('debe mostrar error con email inválido', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await user.type(document.getElementById('email') as HTMLInputElement, 'no-es-email');
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(screen.getByText(/correo inválido/i)).toBeInTheDocument();
      });
    });

    it('debe mostrar error si la contraseña está vacía', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(screen.getByText(/la contraseña es requerida/i)).toBeInTheDocument();
      });
    });

    it('no debe enviar el formulario con campos vacíos', async () => {
      render(<LoginForm />);
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(authService.login).not.toHaveBeenCalled();
      });
    });
  });

  // --------------------------------------------------------------------------

  describe('Submit — flujo exitoso', () => {
    it('debe llamar a authService.login con las credenciales correctas', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await fillLoginForm(user);
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(vi.mocked(authService.login)).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'Password123!',
        });
      });
    });

    it('debe redirigir a /dashboard/patient si el rol es PATIENT', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await fillLoginForm(user);
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/patient');
      });
    });

    it('debe redirigir a /dashboard/doctor si el rol es DOCTOR', async () => {
      mockDecodeAndBuildUser.mockReturnValue(mockDoctorUser);
      const user = userEvent.setup();
      render(<LoginForm />);

      await fillLoginForm(user);
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/doctor');
      });
    });

    it('debe redirigir a /dashboard/admin si el rol es ADMIN', async () => {
      mockDecodeAndBuildUser.mockReturnValue(mockAdminUser);
      const user = userEvent.setup();
      render(<LoginForm />);

      await fillLoginForm(user);
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/admin');
      });
    });

    it('debe mostrar toast de bienvenida con el nombre del usuario', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await fillLoginForm(user);
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Bienvenido',
            description: expect.stringContaining('Juan Pérez'),
          })
        );
      });
    });

    it('debe guardar el email en localStorage cuando "recuerda mi correo" está activo', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await fillLoginForm(user, { rememberMe: true });
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(localStorageSetItem).toHaveBeenCalledWith('rememberEmail', 'test@example.com');
      });
    });

    it('debe eliminar el email de localStorage cuando "recuerda mi correo" está inactivo', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await fillLoginForm(user);
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(localStorageRemoveItem).toHaveBeenCalledWith('rememberEmail');
      });
    });
  });

  // --------------------------------------------------------------------------

  describe('Submit — casos especiales', () => {
    it('debe redirigir a /verify-2fa si la respuesta requiere 2FA', async () => {
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        tempTwoFactorToken: 'temp-token-123',
      } as any);

      const user = userEvent.setup();
      render(<LoginForm />);

      await fillLoginForm(user);
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login/2fa');
      });

      expect(mockSetTempTwoFactorToken).toHaveBeenCalledWith('temp-token-123');
    });

    it('debe mostrar error de cuenta inactiva', async () => {
      mockDecodeAndBuildUser.mockReturnValue({ ...mockPatientUser, status: UserStatus.INACTIVE });
      const user = userEvent.setup();
      render(<LoginForm />);

      await fillLoginForm(user);
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Tu cuenta está pendiente o inactiva. Contacta con soporte.',
            variant: 'destructive',
          })
        );
      });
    });

    it('debe mostrar error si la cookie no está lista tras el login', async () => {
      vi.mocked(waitForCookie).mockResolvedValue(false);
      const user = userEvent.setup();
      render(<LoginForm />);

      await fillLoginForm(user);
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error de sesión',
            variant: 'destructive',
          })
        );
      });
    });
  });

  // --------------------------------------------------------------------------

  describe('Submit — manejo de errores', () => {
    it('debe mostrar error de credenciales incorrectas con 401', async () => {
      vi.mocked(authService.login).mockRejectedValueOnce(
        new axios.AxiosError('Unauthorized', '401', undefined, undefined, {
          status: 401,
          data: {},
        } as any)
      );

      const user = userEvent.setup();
      render(<LoginForm />);

      await fillLoginForm(user);
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: expect.stringMatching(/correo o contraseña incorrectos/i),
            variant: 'destructive',
          })
        );
      });
    });

    it('debe mostrar mensaje de error genérico ante errores de red', async () => {
      vi.mocked(authService.login).mockRejectedValueOnce(new Error('Network Error'));

      const user = userEvent.setup();
      render(<LoginForm />);

      await fillLoginForm(user);
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            variant: 'destructive',
          })
        );
      });
    });
  });

  // --------------------------------------------------------------------------

  describe('UI interactiva', () => {
    it('debe alternar visibilidad de contraseña', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const passwordInput = document.getElementById('password') as HTMLInputElement;
      expect(passwordInput).toHaveAttribute('type', 'password');

      await user.click(screen.getByRole('button', { name: /mostrar contraseña/i }));
      expect(passwordInput).toHaveAttribute('type', 'text');

      await user.click(screen.getByRole('button', { name: /ocultar contraseña/i }));
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('debe deshabilitar los campos mientras se envía el formulario', async () => {
      vi.mocked(authService.login).mockReturnValue(new Promise(() => {}));

      const user = userEvent.setup();
      render(<LoginForm />);

      await fillLoginForm(user);

      await act(async () => {
        fireEvent.submit(document.querySelector('form')!);
      });

      expect(document.getElementById('email')).toBeDisabled();
      expect(document.getElementById('password')).toBeDisabled();
      expect(screen.getByRole('button', { name: /iniciando sesión/i })).toBeDisabled();
    });
  });
});

// ============================================================================
// Helpers
// ============================================================================

async function fillLoginForm(
  user: ReturnType<typeof userEvent.setup>,
  options: { rememberMe?: boolean } = {}
) {
  const { rememberMe = false } = options;

  await user.type(document.getElementById('email') as HTMLInputElement, 'test@example.com');
  await user.type(document.getElementById('password') as HTMLInputElement, 'Password123!');

  if (rememberMe) {
    await user.click(screen.getByRole('checkbox', { name: /recuerda mi correo/i }));
  }
}