import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PatientRegistrationForm from '../registration/PatientRegistrationForm';
import { authService } from '@/lib/api/auth.service';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { PatientRegisterResponse } from '@/types/index';
import axios from 'axios';

// Mock service y hooks
vi.mock('@/lib/api/auth.service', () => ({
  authService: {
    registerPacient: vi.fn()
  }
}));
vi.mock('@/lib/api/auth.service');
vi.mock('@/hooks/use-toast');
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

describe('PatientRegistrationForm', () => {
  const mockToast = vi.fn();
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ toast: mockToast });
    (useRouter as any).mockReturnValue({ push: mockPush });
    vi.mocked(authService.registerPacient).mockResolvedValue({
      patientId: '00000000-0000-0000-0000-000000000001',
    } as PatientRegisterResponse);
  });

  describe('Renderizado del formulario', () => {
    it('debe renderizar todos los campos del formulario', () => {
      render(<PatientRegistrationForm />);

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^contraseña/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/apellido/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/fecha/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/teléfono/i)).toBeInTheDocument();
    });

    it('debe renderizar el botón de submit', () => {
      render(<PatientRegistrationForm />);
      expect(screen.getByRole('button', { name: /registrarme/i })).toBeInTheDocument();
    });

    it('debe tener valores por defecto en los campos', () => {
      render(<PatientRegistrationForm />);
      expect(screen.getByLabelText(/email/i)).toHaveValue('');
    });
  });

  describe('Validación del formulario', () => {
    it('debe validar email inválido', async () => {
      const user = userEvent.setup();
      render(<PatientRegistrationForm />);

      await user.type(screen.getByLabelText(/email/i), 'invalid-email');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/correo inválido/i)).toBeInTheDocument();
      });
    });

    it('debe validar contraseña muy corta', async () => {
      const user = userEvent.setup();
      render(<PatientRegistrationForm />);

      await user.type(screen.getByLabelText(/^contraseña/i), 'short');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/8 caracteres/i)).toBeInTheDocument();
      });
    });

    it('debe validar que las contraseñas coincidan', async () => {
      const user = userEvent.setup();
      render(<PatientRegistrationForm />);

      await user.type(screen.getByLabelText(/^contraseña/i), 'Password123');
      await user.type(screen.getByLabelText(/confirmar contraseña/i), 'DifferentPassword123');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/no coinciden/i)).toBeInTheDocument();
      });
    });

    it('debe validar teléfono con 10 dígitos', async () => {
      const user = userEvent.setup();
      render(<PatientRegistrationForm />);

      await user.type(screen.getByLabelText(/teléfono/i), '123');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/10 dígitos/i)).toBeInTheDocument();
      });
    });

    it('debe validar que la fecha sea en el pasado', async () => {
      const user = userEvent.setup();
      render(<PatientRegistrationForm />);

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      await user.type(screen.getByLabelText(/fecha/i), futureDateStr);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/anterior a hoy/i)).toBeInTheDocument();
      });
    });
  });

  describe('Submit del formulario', () => {
    it('debe enviar el formulario con datos válidos', async () => {
      const user = userEvent.setup();
      render(<PatientRegistrationForm />);

      await fillFormWithValidData(user);

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(vi.mocked(authService.registerPacient)).toHaveBeenCalled();
      });
    });

    it('debe mostrar mensaje de éxito al registrarse', async () => {
      const user = userEvent.setup();
      render(<PatientRegistrationForm />);

      await fillFormWithValidData(user);

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.any(String) }));
      });
    });

    it('debe redirigir a login después de registrarse', async () => {
      const user = userEvent.setup();
      render(<PatientRegistrationForm />);

      await fillFormWithValidData(user);

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });

    it('debe manejar errores de API', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(authService.registerPacient).mockRejectedValueOnce(new axios.AxiosError('API Error', '500'));
      
      const user = userEvent.setup();
      render(<PatientRegistrationForm />);
      await fillFormWithValidData(user);

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      }, { timeout: 3000 });
      consoleSpy.mockRestore();
    });

    it('debe mostrar error cuando no acepta política de privacidad', async () => {
      const user = userEvent.setup();
      render(<PatientRegistrationForm />);

      await fillFormWithValidData(user, { acceptPrivacy: false });

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(screen.getByText(/política de privacidad/i)).toBeInTheDocument();
      });
    });

    it('debe mostrar error cuando no autoriza tratamiento de datos', async () => {
      const user = userEvent.setup();
      render(<PatientRegistrationForm />);

      await fillFormWithValidData(user, { authorizeData: false });

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(screen.getByText(/tratamiento de datos/i)).toBeInTheDocument();
      });
    });

    it('debe alternar visibilidad de contraseña', async () => {
      const user = userEvent.setup();
      render(<PatientRegistrationForm />);

      const passwordInput = screen.getByLabelText(/^contraseña/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      const [firstToggle] = screen.getAllByRole('button', { name: /mostrar|ocultar/i });
      await user.click(firstToggle);
      expect(passwordInput).toHaveAttribute('type', 'text');

      await user.click(firstToggle);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('debe alternar visibilidad de confirmación de contraseña', async () => {
      const user = userEvent.setup();
      render(<PatientRegistrationForm />);

      const confirmInput = screen.getByLabelText(/confirmar contraseña/i);
      expect(confirmInput).toHaveAttribute('type', 'password');

      const [, secondToggle] = screen.getAllByRole('button', { name: /mostrar|ocultar/i });
      await user.click(secondToggle);
      expect(confirmInput).toHaveAttribute('type', 'text');

      await user.click(secondToggle);
      expect(confirmInput).toHaveAttribute('type', 'password');
    });

    it('debe revalidar confirmPassword cuando cambia password', async () => {
      const user = userEvent.setup();
      render(<PatientRegistrationForm />);

      const passwordInput = screen.getByLabelText(/^contraseña/i);
      const confirmInput = screen.getByLabelText(/confirmar contraseña/i);

      await user.type(passwordInput, 'InitialPassword123');
      await user.type(confirmInput, 'DifferentPassword123');
      
      // Cambiar password
      await user.clear(passwordInput);
      await user.type(passwordInput, 'NewPassword123');
      await user.tab();

      // Debe revalidar y mostrar error
      await waitFor(() => {
        expect(screen.getByText(/no coinciden/i)).toBeInTheDocument();
      });
    });
    it('no debe enviar el formulario con campos vacíos', async () => {
      const user = userEvent.setup();
      render(<PatientRegistrationForm />);

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(vi.mocked(authService.registerPacient)).not.toHaveBeenCalled();
      });
    });
  });
});

// ============================================================================
// Helpers
// ============================================================================

async function fillFormWithValidData(
  user: ReturnType<typeof userEvent.setup>,
  options: { acceptPrivacy?: boolean; authorizeData?: boolean } = {}
) {
  const { acceptPrivacy = true, authorizeData = true } = options;
  
  await user.type(screen.getByLabelText(/email/i), 'test@example.com');
  await user.type(screen.getByLabelText(/^contraseña/i), 'Password123!');
  await user.type(screen.getByLabelText(/confirmar contraseña/i), 'Password123!');
  await user.type(screen.getByLabelText(/nombre/i), 'Juan');
  await user.type(screen.getByLabelText(/apellido/i), 'Pérez');
  await user.type(screen.getByLabelText(/fecha/i), '1990-05-15');
  await user.type(screen.getByLabelText(/teléfono/i), '3001234567');

  // Check the checkboxes based on parameters
  const checkboxes = screen.getAllByRole('checkbox');
  if (acceptPrivacy && checkboxes[0]) {
    await user.click(checkboxes[0]);
  }
  if (authorizeData && checkboxes[1]) {
    await user.click(checkboxes[1]);
  }
}
