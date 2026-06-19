import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DoctorRegistrationForm from '../registration/doctorRegistrationForm';
import { authService } from '@/lib/api/auth.service';
import { MEDICAL_SPECIALTIES } from '@/constants/specialties';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/lib/api/auth.service', () => ({
  authService: {
    registerDoctor: vi.fn(),
  },
}));
vi.stubGlobal('alert', vi.fn());

// ============================================================================
// Helpers
// ============================================================================

function makeFile(name = 'credenciales.pdf', type = 'application/pdf'): File {
  return new File(['contenido'], name, { type });
}

async function fillFormWithValidData(
  user: ReturnType<typeof userEvent.setup>,
  options: { includeFile?: boolean } = {}
) {
  const { includeFile = true } = options;

  await user.type(document.querySelector('input[name="fullName"]') as HTMLInputElement, 'Dr. Juan Pérez');
  await user.type(document.querySelector('input[name="email"]') as HTMLInputElement, 'doctor@example.com');

  // Contraseña — usar fireEvent porque el input type="password" no tiene rol textbox
  fireEvent.change(document.querySelector('input[name="password"]')!, {
    target: { value: 'Password123!' },
  });
  fireEvent.change(document.querySelector('input[name="confirmPassword"]')!, {
    target: { value: 'Password123!' },
  });

  await user.type(
    document.querySelector('input[name="professionalLicense"]') as HTMLInputElement,
    'RETHUS-123456'
  );

  // Seleccionar especialidad
  fireEvent.change(document.querySelector('select[name="specialty"]')!, {
    target: { value: MEDICAL_SPECIALTIES[0] },
  });

  // Subir archivo
  if (includeFile) {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    await user.upload(fileInput, makeFile());
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('DoctorRegistrationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.registerDoctor).mockResolvedValue(undefined as any);
  });

  // --------------------------------------------------------------------------

  describe('Renderizado', () => {
    it('debe renderizar todos los campos del formulario', () => {
      render(<DoctorRegistrationForm />);

      expect(document.querySelector('input[name="fullName"]')).toBeInTheDocument();
      expect(document.querySelector('input[name="email"]')).toBeInTheDocument();
      expect(document.querySelector('input[name="password"]')).toBeInTheDocument();
      expect(document.querySelector('input[name="confirmPassword"]')).toBeInTheDocument();
      expect(document.querySelector('input[name="professionalLicense"]')).toBeInTheDocument();
      expect(document.querySelector('select[name="specialty"]')).toBeInTheDocument();
    });

    it('debe renderizar el botón de submit deshabilitado inicialmente', () => {
      render(<DoctorRegistrationForm />);
      expect(screen.getByRole('button', { name: /completar registro/i })).toBeDisabled();
    });

    it('debe renderizar la zona de carga de archivos', () => {
      render(<DoctorRegistrationForm />);
      expect(screen.getByText(/haz clic para cargar o arrastra y suelta/i)).toBeInTheDocument();
    });

    it('debe renderizar las opciones de especialidad', () => {
      render(<DoctorRegistrationForm />);
      MEDICAL_SPECIALTIES.forEach((specialty) => {
      expect(screen.getByRole('option', { name: specialty })).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------

  describe('Validación de contraseña', () => {
    it('debe mostrar los requisitos de contraseña al enfocar el campo', async () => {
      render(<DoctorRegistrationForm />);

      const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;
      fireEvent.focus(passwordInput);
      fireEvent.change(passwordInput, { target: { value: 'a' } });

      await waitFor(() => {
        expect(screen.getByText(/mínimo 8 caracteres/i)).toBeInTheDocument();
        expect(screen.getByText(/al menos una letra mayúscula/i)).toBeInTheDocument();
        expect(screen.getByText(/al menos una letra minúscula/i)).toBeInTheDocument();
        expect(screen.getByText(/al menos un número/i)).toBeInTheDocument();
        expect(screen.getByText(/al menos un carácter especial/i)).toBeInTheDocument();
      });
    });

    it('debe marcar en verde los requisitos cumplidos', async () => {
      render(<DoctorRegistrationForm />);

      const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;
      fireEvent.focus(passwordInput);
      fireEvent.change(passwordInput, { target: { value: 'Password123!' } });

      await waitFor(() => {
        // Todos los requisitos deben estar en verde — verificar que el ícono Check aparece
        const checkIcons = document.querySelectorAll('.text-green-600');
        expect(checkIcons.length).toBeGreaterThan(0);
      });
    });

    it('debe mostrar error cuando las contraseñas no coinciden', async () => {
      render(<DoctorRegistrationForm />);

      fireEvent.change(document.querySelector('input[name="password"]')!, {
        target: { value: 'Password123!' },
      });
      fireEvent.change(document.querySelector('input[name="confirmPassword"]')!, {
        target: { value: 'OtraPassword123!' },
      });

      await waitFor(() => {
        expect(screen.getByText(/las contraseñas no coinciden/i)).toBeInTheDocument();
      });
    });

    it('debe mostrar confirmación cuando las contraseñas coinciden', async () => {
      render(<DoctorRegistrationForm />);

      fireEvent.change(document.querySelector('input[name="password"]')!, {
        target: { value: 'Password123!' },
      });
      fireEvent.change(document.querySelector('input[name="confirmPassword"]')!, {
        target: { value: 'Password123!' },
      });

      await waitFor(() => {
        expect(screen.getByText(/las contraseñas coinciden/i)).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------

  describe('Carga de archivos', () => {
    it('debe mostrar el nombre del archivo al seleccionarlo', async () => {
      const user = userEvent.setup();
      render(<DoctorRegistrationForm />);

      const fileInput = document.getElementById('fileInput') as HTMLInputElement;
      await user.upload(fileInput, makeFile('mi-licencia.pdf'));

      await waitFor(() => {
        expect(screen.getByText(/archivo seleccionado: mi-licencia.pdf/i)).toBeInTheDocument();
      });
    });

    it('debe activar el estado de dragging al arrastrar sobre la zona', async () => {
      render(<DoctorRegistrationForm />);

      const dropZone = screen.getByText(/haz clic para cargar/i).closest('div')!;
      fireEvent.dragOver(dropZone, { preventDefault: () => {} });

      await waitFor(() => {
        expect(dropZone).toHaveClass('border-primary');
      });
    });

    it('debe desactivar el estado de dragging al salir de la zona', async () => {
      render(<DoctorRegistrationForm />);

      const dropZone = screen.getByText(/haz clic para cargar/i).closest('div')!;
      fireEvent.dragOver(dropZone, { preventDefault: () => {} });
      fireEvent.dragLeave(dropZone);

      await waitFor(() => {
        expect(dropZone).not.toHaveClass('border-primary');
      });
    });

    it('debe aceptar un archivo al soltarlo en la zona de drop', async () => {
      render(<DoctorRegistrationForm />);

      const dropZone = screen.getByText(/haz clic para cargar/i).closest('div')!;
      const file = makeFile('dropped-file.pdf');

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      });

      await waitFor(() => {
        expect(screen.getByText(/archivo seleccionado: dropped-file.pdf/i)).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------

  describe('Habilitación del botón de submit', () => {
    it('debe habilitar el botón cuando todos los campos están completos', async () => {
      const user = userEvent.setup();
      render(<DoctorRegistrationForm />);

      await fillFormWithValidData(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /completar registro/i })).not.toBeDisabled();
      });
    });

    it('debe mantener el botón deshabilitado sin archivo', async () => {
      const user = userEvent.setup();
      render(<DoctorRegistrationForm />);

      await fillFormWithValidData(user, { includeFile: false });

      expect(screen.getByRole('button', { name: /completar registro/i })).toBeDisabled();
    });

    it('debe mantener el botón deshabilitado con contraseña inválida', async () => {
      const user = userEvent.setup();
      render(<DoctorRegistrationForm />);

      await user.type(document.querySelector('input[name="fullName"]') as HTMLInputElement, 'Dr. Juan');
      fireEvent.change(document.querySelector('input[name="password"]')!, {
        target: { value: 'weak' },
      });

      expect(screen.getByRole('button', { name: /completar registro/i })).toBeDisabled();
      });
    });

  // --------------------------------------------------------------------------

  describe('Submit del formulario', () => {
    it('debe llamar a authService.registerDoctor con los datos correctos', async () => {
      const user = userEvent.setup();
      render(<DoctorRegistrationForm />);

      await fillFormWithValidData(user);
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(vi.mocked(authService.registerDoctor)).toHaveBeenCalledWith(
          expect.objectContaining({
            fullName: 'Dr. Juan Pérez',
            email: 'doctor@example.com',
            password: 'Password123!',
            professionalLicense: 'RETHUS-123456',
            specialty: MEDICAL_SPECIALTIES[0],
          })
        );
      });
    });

    it('debe incluir el archivo en la llamada al servicio', async () => {
      const user = userEvent.setup();
      render(<DoctorRegistrationForm />);

      await fillFormWithValidData(user);
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(vi.mocked(authService.registerDoctor)).toHaveBeenCalledWith(
          expect.objectContaining({
            supportingDocument: expect.any(File),
          })
        );
      });
    });

    it('debe mostrar la pantalla de éxito tras registrarse', async () => {
      const user = userEvent.setup();
      render(<DoctorRegistrationForm />);

      await fillFormWithValidData(user);
      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(screen.getByText(/registro enviado/i)).toBeInTheDocument();
        expect(screen.getByText(/pendiente de aprobación/i)).toBeInTheDocument();
      });
    });

    it('debe mostrar alerta de error si el servicio falla', async () => {
      vi.mocked(authService.registerDoctor).mockRejectedValueOnce(new Error('API Error'));

      const user = userEvent.setup();
      render(<DoctorRegistrationForm />);

      await fillFormWithValidData(user);
        fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(vi.mocked(window.alert)).toHaveBeenCalledWith(
          expect.stringMatching(/error al registrar doctor/i)
        );
      });
    });

    it('debe deshabilitar el botón mientras se envía el formulario', async () => {
      vi.mocked(authService.registerDoctor).mockReturnValue(new Promise(() => {}));

      const user = userEvent.setup();
      render(<DoctorRegistrationForm />);

      await fillFormWithValidData(user);

      await act(async () => {
        fireEvent.submit(document.querySelector('form')!);
      });

      expect(screen.getByRole('button', { name: /enviando/i })).toBeDisabled();
      });

    it('no debe enviar el formulario si está incompleto', async () => {
      render(<DoctorRegistrationForm />);

      expect(screen.getByRole('button', { name: /completar registro/i })).toBeDisabled();
      expect(vi.mocked(authService.registerDoctor)).not.toHaveBeenCalled();
    });
  });
});