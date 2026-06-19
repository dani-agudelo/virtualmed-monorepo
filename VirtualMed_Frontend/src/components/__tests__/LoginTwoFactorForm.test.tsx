import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginTwoFactorPage from '../../app/login/2fa/page';
import { authService } from '@/lib/api/auth.service';
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
    login2FA: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

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
  accessToken: 'token-2fa-123',
  refreshToken: 'refresh-2fa-123',
  expiresInSeconds: 3600,
};

const mockPatientUser = {
  fullname: 'Juan Pérez',
  role: UserRole.PATIENT,
  status: UserStatus.ACTIVE,
};

const mockDoctorUser = {
  fullname: 'Dra. García',
  role: UserRole.DOCTOR,
  status: UserStatus.ACTIVE,
};

const mockAdminUser = {
  fullname: 'Admin Root',
  role: UserRole.ADMIN,
  status: 'Active',
};

// ============================================================================
// Test suite
// ============================================================================

describe('LoginTwoFactorPage', () => {
  const mockPush = vi.fn();
  const mockSetToken = vi.fn();
  const mockSetRefreshToken = vi.fn();
  const mockDecodeAndBuildUser = vi.fn();
  const mockGetTempTwoFactorToken = vi.fn();
  const mockClearTempTwoFactorToken = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTempTwoFactorToken.mockReturnValue('temp-2fa-token-123');

    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
    });

    vi.mocked(useAuthStore).mockReturnValue({
      decodeAndBuildUser: mockDecodeAndBuildUser,
      setToken: mockSetToken,
      setRefreshToken: mockSetRefreshToken,
      getTempTwoFactorToken: mockGetTempTwoFactorToken,
      clearTempTwoFactorToken: mockClearTempTwoFactorToken,
    } as any);

    mockDecodeAndBuildUser.mockReturnValue(mockPatientUser);
    vi.mocked(waitForCookie).mockResolvedValue(true);
    vi.mocked(authService.login2FA).mockResolvedValue(mockPatientToken as any);
  });

  // --------------------------------------------------------------------------

  describe('Renderizado', () => {
    it('debe renderizar el header con el icono de escudo', () => {
      render(<LoginTwoFactorPage />);

      expect(screen.getByText('Verificación en dos pasos')).toBeInTheDocument();
      expect(screen.getByText('Ingresa tu código de autenticación')).toBeInTheDocument();
    });

    it('debe renderizar 6 inputs para el OTP', () => {
      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]');
      expect(inputs).toHaveLength(6);

      inputs.forEach((input) => {
        expect(input).toHaveAttribute('inputMode', 'numeric');
        expect(input).toHaveAttribute('maxLength', '1');
      });
    });

    it('debe renderizar el botón de verificación deshabilitado por defecto', () => {
      render(<LoginTwoFactorPage />);

      const button = screen.getByRole('button', { name: /verificar código/i });
      expect(button).toBeDisabled();
    });

    it('debe renderizar el texto de ayuda', () => {
      render(<LoginTwoFactorPage />);

      expect(screen.getByText(/consulta el código en tu aplicacion de autenticación/i)).toBeInTheDocument();
    });

    it('debe renderizar los indicadores de seguridad', () => {
      render(<LoginTwoFactorPage />);

      expect(screen.getByText('Encriptado end-to-end')).toBeInTheDocument();
      expect(screen.getByText('HIPAA compliant')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------

  describe('Entrada de OTP', () => {
    it('debe aceptar solo números en los inputs', async () => {
      const user = userEvent.setup();
      render(<LoginTwoFactorPage />);

      const firstInput = document.querySelectorAll('input[type="text"]')[0] as HTMLInputElement;

      await user.type(firstInput, 'a');
      expect(firstInput.value).toBe('');

      await user.type(firstInput, '5');
      expect(firstInput.value).toBe('5');
    });

    it('debe limitar a 1 dígito por input', async () => {
      const user = userEvent.setup();
      render(<LoginTwoFactorPage />);

      const firstInput = document.querySelectorAll('input[type="text"]')[0] as HTMLInputElement;

      await user.type(firstInput, '12');
      expect(firstInput.value).toBe('1');
    });

    it('debe auto-enfocarse al siguiente input después de escribir un dígito', async () => {
      const user = userEvent.setup();
      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      await user.type(inputs[0], '1');
      expect(document.activeElement).toBe(inputs[1]);

      await user.type(inputs[1], '2');
      expect(document.activeElement).toBe(inputs[2]);
    });

    it('debe llenar todos los 6 dígitos correctamente', async () => {
      const user = userEvent.setup();
      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
      const code = '123456';

      for (let i = 0; i < code.length; i++) {
        await user.type(inputs[i], code[i]);
      }

      inputs.forEach((input, index) => {
        expect(input.value).toBe(code[index]);
      });
    });
  });

  // --------------------------------------------------------------------------

  describe('Navegación de inputs', () => {
    it('debe navegar al input anterior con tecla Backspace cuando está vacío', async () => {
      const user = userEvent.setup();
      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      await user.type(inputs[0], '1');
      await user.type(inputs[1], '2');

      inputs[2].focus();
      fireEvent.keyDown(inputs[2], { key: 'Backspace' });

      expect(document.activeElement).toBe(inputs[1]);
    });

    it('debe navegar con flecha derecha', async () => {
      const user = userEvent.setup();
      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      inputs[0].focus();
      fireEvent.keyDown(inputs[0], { key: 'ArrowRight' });

      expect(document.activeElement).toBe(inputs[1]);
    });

    it('debe navegar con flecha izquierda', async () => {
      const user = userEvent.setup();
      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      inputs[2].focus();
      fireEvent.keyDown(inputs[2], { key: 'ArrowLeft' });

      expect(document.activeElement).toBe(inputs[1]);
    });

    it('no debe navegar a índices fuera del rango', async () => {
      const user = userEvent.setup();
      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      inputs[0].focus();
      fireEvent.keyDown(inputs[0], { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(inputs[0]);

      inputs[5].focus();
      fireEvent.keyDown(inputs[5], { key: 'ArrowRight' });
      expect(document.activeElement).toBe(inputs[5]);
    });
  });

  // --------------------------------------------------------------------------

  describe('Paste de OTP', () => {
    it('debe pegar 6 dígitos correctamente', async () => {
      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
      const code = '123456';

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer(),
      });
      pasteEvent.clipboardData?.setData('text/plain', code);

      fireEvent.paste(inputs[0], pasteEvent as any);

      await waitFor(() => {
        inputs.forEach((input, index) => {
          expect(input.value).toBe(code[index]);
        });
      });
    });

    it('debe enfocar el último input después de pegar', async () => {
      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
      const code = '123456';

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer(),
      });
      pasteEvent.clipboardData?.setData('text/plain', code);

      fireEvent.paste(inputs[0], pasteEvent as any);

      await waitFor(() => {
        expect(document.activeElement).toBe(inputs[5]);
      });
    });

    it('debe ignorar caracteres no numéricos al pegar', async () => {
      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
      const mixedCode = 'a1b2c3d4e5f6';

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer(),
      });
      pasteEvent.clipboardData?.setData('text/plain', mixedCode);

      fireEvent.paste(inputs[0], pasteEvent as any);

      await waitFor(() => {
        expect(inputs[0].value).toBe('1');
        expect(inputs[1].value).toBe('2');
        expect(inputs[2].value).toBe('3');
        expect(inputs[3].value).toBe('4');
        expect(inputs[4].value).toBe('5');
        expect(inputs[5].value).toBe('6');
      });
    });

    it('no debe pegar si el código no tiene exactamente 6 dígitos', async () => {
      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
      const shortCode = '12345';

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer(),
      });
      pasteEvent.clipboardData?.setData('text/plain', shortCode);

      fireEvent.paste(inputs[0], pasteEvent as any);

      await waitFor(() => {
        inputs.forEach((input) => {
          expect(input.value).toBe('');
        });
      });
    });
  });

  // --------------------------------------------------------------------------

  describe('Validación del botón', () => {
    it('debe deshabilitar el botón cuando el OTP está incompleto', async () => {
      const user = userEvent.setup();
      render(<LoginTwoFactorPage />);

      const button = screen.getByRole('button', { name: /verificar código/i });
      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      expect(button).toBeDisabled();

      for (let i = 0; i < 5; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      expect(button).toBeDisabled();
    });

    it('debe habilitar el botón cuando se han ingresado los 6 dígitos', async () => {
      const user = userEvent.setup();
      render(<LoginTwoFactorPage />);

      const button = screen.getByRole('button', { name: /verificar código/i });
      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      expect(button).toBeEnabled();
    });

    it('debe deshabilitar el botón mientras se está verificando', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login2FA).mockReturnValue(new Promise(() => {}));

      render(<LoginTwoFactorPage />);

      const button = screen.getByRole('button', { name: /verificar código/i });
      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await act(async () => {
        await user.click(button);
      });

      expect(button).toBeDisabled();
    });
  });

  // --------------------------------------------------------------------------

  describe('Verificación exitosa', () => {
    it('debe llamar a authService.login2FA con el código y token temporal', async () => {
      const user = userEvent.setup();
      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await user.click(screen.getByRole('button', { name: /verificar código/i }));

      await waitFor(() => {
        expect(vi.mocked(authService.login2FA)).toHaveBeenCalledWith({
          code: '123456',
          tempTwoFactorToken: 'temp-2fa-token-123',
        });
      });
    });

    it('debe guardar el refresh token en el store', async () => {
      const user = userEvent.setup();
      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await user.click(screen.getByRole('button', { name: /verificar código/i }));

      await waitFor(() => {
        expect(mockSetRefreshToken).toHaveBeenCalledWith('refresh-2fa-123');
      });
    });

    it('debe establecer el token de acceso en el store', async () => {
      const user = userEvent.setup();
      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await user.click(screen.getByRole('button', { name: /verificar código/i }));

      await waitFor(() => {
        expect(mockSetToken).toHaveBeenCalledWith('token-2fa-123', 3600);
      });
    });

    it('debe remover el token temporal usando el auth store', async () => {
      const user = userEvent.setup();
      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await user.click(screen.getByRole('button', { name: /verificar código/i }));

      await waitFor(() => {
        expect(mockClearTempTwoFactorToken).toHaveBeenCalled();
      });
    });

    it('debe redirigir a /dashboard/patient si el rol es PATIENT', async () => {
      const user = userEvent.setup();
      mockDecodeAndBuildUser.mockReturnValue(mockPatientUser);

      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await user.click(screen.getByRole('button', { name: /verificar código/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/patient');
      });
    });

    it('debe redirigir a /dashboard/doctor si el rol es DOCTOR', async () => {
      const user = userEvent.setup();
      mockDecodeAndBuildUser.mockReturnValue(mockDoctorUser);

      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await user.click(screen.getByRole('button', { name: /verificar código/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/doctor');
      });
    });

    it('debe redirigir a /dashboard/admin si el rol es ADMIN', async () => {
      const user = userEvent.setup();
      mockDecodeAndBuildUser.mockReturnValue(mockAdminUser);

      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await user.click(screen.getByRole('button', { name: /verificar código/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/admin');
      });
    });
  });

  // --------------------------------------------------------------------------

  describe('Casos especiales', () => {
    it('debe mostrar error si el token temporal expiró', async () => {
      const user = userEvent.setup();
      mockGetTempTwoFactorToken.mockReturnValue(null);

      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await user.click(screen.getByRole('button', { name: /verificar código/i }));

      await waitFor(() => {
        expect(screen.getByText(/tu sesión de verificación expiró/i)).toBeInTheDocument();
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });

    it('debe mostrar error si la cookie no está lista tras la verificación', async () => {
      const user = userEvent.setup();
      vi.mocked(waitForCookie).mockResolvedValue(false);

      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await user.click(screen.getByRole('button', { name: /verificar código/i }));

      await waitFor(() => {
        expect(screen.getByText(/no se pudo completar la sesión/i)).toBeInTheDocument();
      });
    });

    it('debe mostrar error si el código ingresado no es válido', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login2FA).mockRejectedValueOnce(
        new axios.AxiosError('Invalid code', '400')
      );

      render(<LoginTwoFactorPage />);

      const inputs = document.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;

      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await user.click(screen.getByRole('button', { name: /verificar código/i }));

      await waitFor(() => {
        expect(screen.getByText(/el código ingresado no es válido o ha expirado/i)).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------

  describe('Cambio de texto de botón', () => {
    it('debe mostrar "Verificar código" por defecto', () => {
      render(<LoginTwoFactorPage />);

      expect(screen.getByRole('button', { name: /verificar código/i })).toBeInTheDocument();
    });
  });
});
