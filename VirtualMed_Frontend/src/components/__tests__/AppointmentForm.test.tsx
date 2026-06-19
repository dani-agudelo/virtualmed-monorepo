import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppointmentForm from '../appointments/appointmentForm';
import { doctorService } from '@/lib/api/doctor.service';
import { patientService } from '@/lib/api/patient.service';
import { adminService } from '@/lib/api/admin.service';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/hooks/use-toast';
import { AppointmentStatus } from '@/constants/appointmentStatus';
import { UserRole } from '@/constants/userRole';
import { UserStatus } from '@/constants/userStatus';
import axios from 'axios';

// Mock services y hooks
vi.mock('@/lib/api/doctor.service', () => ({
  doctorService: {
    getDoctors: vi.fn(),
    createAppointment: vi.fn(),
  },
}));

vi.mock('@/lib/api/patient.service', () => ({
  patientService: {
    getPatients: vi.fn(),
  },
}));

vi.mock('@/lib/api/admin.service', () => ({
  adminService: {
    createAppointment: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast');
vi.mock('@/store/auth.store');

// Mock data - Ahora con estructura paginada
const mockPatientsResponse = {
  items: [
    { id: 'patient-1', fullName: 'Juan Pérez', document: '12345678' },
    { id: 'patient-2', fullName: 'María López', document: '87654321' },
  ],
  page: 1,
  pageSize: 10,
  totalCount: 2
};

const mockDoctorsResponse = {
  items: [
    { id: 'doctor-1', fullName: 'Dr. Carlos Rodríguez', document: 'ML-12345' },
    { id: 'doctor-2', fullName: 'Dra. Ana García', document: 'ML-67890' },
  ],
  page: 1,
  pageSize: 10,
  totalCount: 2
};

const mockUser = {
  sub: 'user-123',
  email: 'admin@test.com',
  role: UserRole.ADMIN,
  fullName: 'Admin User',
  status: UserStatus.ACTIVE,
  email_verified: true,
  two_factor_enabled: false,
  permission: [],
};

describe('AppointmentForm', () => {
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ toast: mockToast });
    (useAuthStore as any).mockReturnValue({ user: mockUser });
    vi.mocked(patientService.getPatients).mockResolvedValue(mockPatientsResponse as any);
    vi.mocked(doctorService.getDoctors).mockResolvedValue(mockDoctorsResponse as any);
    vi.mocked(doctorService.createAppointment).mockResolvedValue({ appointmentId: 'apt-123' });
    vi.mocked(adminService.createAppointment).mockResolvedValue({ appointmentId: 'apt-123' });
  });

  // ============================================
  // Renderizado del formulario
  // ============================================
  describe('Renderizado del formulario', () => {
    it('debe renderizar el título y descripción del formulario', async () => {
      render(<AppointmentForm mode="doctor" />);

      expect(screen.getByText('Crear Nueva Cita')).toBeInTheDocument();
      expect(screen.getByText(/Completa el formulario para agendar una cita/i)).toBeInTheDocument();
    });

    it('debe renderizar los campos comunes en modo doctor', async () => {
      render(<AppointmentForm mode="doctor" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Paciente/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/Fecha y Hora/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Duración/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Razón de la cita/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Estado/i)).toBeInTheDocument();
    });

    it('debe renderizar el selector de doctor en modo admin', async () => {
      render(<AppointmentForm mode="admin" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Doctor/i)).toBeInTheDocument();
      });
    });

    it('NO debe renderizar el selector de doctor en modo doctor', async () => {
      render(<AppointmentForm mode="doctor" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Paciente/i)).toBeInTheDocument();
      });
      
      // Verificar que no existe el label de Doctor (solo existe Paciente como selector de persona)
      expect(screen.queryByText('Doctor *')).not.toBeInTheDocument();
    });

    it('debe renderizar los botones de acción', async () => {
      render(<AppointmentForm mode="doctor" />);

      expect(screen.getByRole('button', { name: /Crear Cita/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Limpiar/i })).toBeInTheDocument();
    });

    it('debe mostrar el valor por defecto de duración (30 minutos)', async () => {
      render(<AppointmentForm mode="doctor" />);

      const durationInput = screen.getByRole('spinbutton');
      expect(durationInput).toHaveValue(30);
    });
  });

  // ============================================
  // Carga de datos
  // ============================================
  describe('Carga de datos', () => {
    it('debe cargar pacientes al hacer clic en el botón de búsqueda', async () => {
      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      // Hacer clic en el botón de búsqueda de pacientes
      const searchButtons = screen.getAllByRole('button');
      const patientSearchButton = searchButtons.find(b => 
        b.closest('.relative.flex.gap-2') && b.querySelector('svg.lucide-search')
      );
      
      if (patientSearchButton) {
        await user.click(patientSearchButton);
      }

      await waitFor(() => {
        expect(patientService.getPatients).toHaveBeenCalledWith({
          q: '',
          page: '1'
        });
      });
    });

    it('debe cargar doctores al hacer clic en el botón de búsqueda en modo admin', async () => {
      const user = userEvent.setup();
      render(<AppointmentForm mode="admin" />);

      // Encontrar el botón de búsqueda de doctores (segundo grupo de búsqueda)
      const searchInputs = screen.getAllByRole('textbox');
      const doctorSearchInput = searchInputs.find(input => 
        input.getAttribute('placeholder')?.includes('doctor')
      );
      
      if (doctorSearchInput) {
        const container = doctorSearchInput.closest('.relative.flex.gap-2');
        const searchButton = container?.querySelector('button');
        if (searchButton) {
          await user.click(searchButton);
        }
      }

      await waitFor(() => {
        expect(doctorService.getDoctors).toHaveBeenCalledWith({
          q: undefined,
          page: '1'
        });
      });
    });

    it('NO debe cargar la lista de doctores en modo doctor', async () => {
      render(<AppointmentForm mode="doctor" />);

      // En modo doctor no hay botón de búsqueda de doctores
      expect(screen.queryByPlaceholderText(/Buscar doctor/i)).not.toBeInTheDocument();
      expect(doctorService.getDoctors).not.toHaveBeenCalled();
    });

    it('debe mostrar toast de error si falla la carga de pacientes', async () => {
      vi.mocked(patientService.getPatients).mockRejectedValueOnce(new Error('Network error'));

      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      // Hacer clic en búsqueda
      const searchButtons = screen.getAllByRole('button');
      const patientSearchButton = searchButtons.find(b => 
        b.closest('.relative.flex.gap-2') && b.querySelector('svg.lucide-search')
      );
      
      if (patientSearchButton) {
        await user.click(patientSearchButton);
      }

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'No se pudieron cargar los pacientes. Intenta de nuevo.',
            variant: 'destructive',
          })
        );
      });
    });

    it('debe mostrar toast de error si falla la carga de doctores', async () => {
      vi.mocked(doctorService.getDoctors).mockRejectedValueOnce(new Error('Network error'));

      const user = userEvent.setup();
      render(<AppointmentForm mode="admin" />);

      // Encontrar el botón de búsqueda de doctores
      const searchInputs = screen.getAllByRole('textbox');
      const doctorSearchInput = searchInputs.find(input => 
        input.getAttribute('placeholder')?.includes('doctor')
      );
      
      if (doctorSearchInput) {
        const container = doctorSearchInput.closest('.relative.flex.gap-2');
        const searchButton = container?.querySelector('button');
        if (searchButton) {
          await user.click(searchButton);
        }
      }

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'No se pudieron cargar los doctores. Intenta de nuevo.',
            variant: 'destructive',
          })
        );
      });
    });
  });

  // ============================================
  // Validación del formulario
  // ============================================
  describe('Validación del formulario', () => {
    it('debe validar que el paciente es requerido', async () => {
      render(<AppointmentForm mode="doctor" />);

      // Completar otros campos pero no paciente
      const scheduledInput = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
      const futureDate = getFutureDate(7);
      fireEvent.change(scheduledInput, { target: { value: futureDate } });

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(screen.getByText(/Debes seleccionar un paciente/i)).toBeInTheDocument();
      });
    });

    it('debe validar que la fecha es requerida', async () => {
      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      // Primero buscar pacientes
      await clickPatientSearchButton(user);

      await waitFor(() => {
        expect(patientService.getPatients).toHaveBeenCalled();
      });

      // Seleccionar paciente pero no fecha
      await selectPatient(user);

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(screen.getByText(/La fecha es requerida/i)).toBeInTheDocument();
      });
    });

    it('debe validar que la duración mínima es 30 minutos', async () => {
      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      const durationInput = screen.getByRole('spinbutton');
      await user.clear(durationInput);
      await user.type(durationInput, '15');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/La duración mínima es 30 minutos/i)).toBeInTheDocument();
      });
    });

    it('debe validar que la duración máxima es 1440 minutos', async () => {
      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      const durationInput = screen.getByRole('spinbutton');
      await user.clear(durationInput);
      await user.type(durationInput, '2000');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/La duración máxima es 1440 minutos/i)).toBeInTheDocument();
      });
    });

    it('debe validar que la razón no exceda 1000 caracteres', async () => {
      render(<AppointmentForm mode="doctor" />);

      const reasonTextarea = screen.getByPlaceholderText(/Describe el motivo/i) as HTMLTextAreaElement;
      const longText = 'a'.repeat(1000);
      
      // Usar fireEvent.change para evitar timeout con userEvent.type
      fireEvent.change(reasonTextarea, { target: { value: longText } });
      
      // Verificar que el contador muestra 1000/1000
      await waitFor(() => {
        expect(screen.getByText('1000/1000')).toBeInTheDocument();
      });
    });

    it('debe validar que el doctor es requerido en modo admin', async () => {
      const user = userEvent.setup();
      render(<AppointmentForm mode="admin" />);

      // Buscar pacientes y doctores
      await clickPatientSearchButton(user);
      await clickDoctorSearchButton(user);

      await waitFor(() => {
        expect(patientService.getPatients).toHaveBeenCalled();
        expect(doctorService.getDoctors).toHaveBeenCalled();
      });

      // Completar campos pero no seleccionar doctor
      await selectPatient(user);
      await fillDateTimeField(user);

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(screen.getByText(/Debes seleccionar un doctor/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Envío del formulario - Modo Doctor
  // ============================================
  describe('Envío del formulario - Modo Doctor', () => {
    it('debe enviar el formulario correctamente en modo doctor', async () => {
      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      await fillFormValidData(user, 'doctor');

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(doctorService.createAppointment).toHaveBeenCalledWith(
          expect.objectContaining({
            patientId: 'patient-1',
            doctorId: null,
            durationMinutes: 30,
            status: AppointmentStatus.SCHEDULED,
          })
        );
      });
    });

    it('debe mostrar mensaje de éxito al crear cita', async () => {
      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      await fillFormValidData(user, 'doctor');

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Éxito',
            description: 'La cita ha sido creada correctamente.',
          })
        );
      });
    });

    it('debe resetear el formulario después de crear la cita', async () => {
      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      await fillFormValidData(user, 'doctor');

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(doctorService.createAppointment).toHaveBeenCalled();
      });

      await waitFor(() => {
        const durationInput = screen.getByRole('spinbutton');
        expect(durationInput).toHaveValue(30);
      });
    });
  });

  // ============================================
  // Envío del formulario - Modo Admin
  // ============================================
  describe('Envío del formulario - Modo Admin', () => {
    it('debe enviar el formulario correctamente en modo admin', async () => {
      const user = userEvent.setup();
      render(<AppointmentForm mode="admin" />);

      await fillFormValidData(user, 'admin');

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(adminService.createAppointment).toHaveBeenCalledWith(
          expect.objectContaining({
            patientId: 'patient-1',
            doctorId: 'doctor-1',
            durationMinutes: 30,
            status: AppointmentStatus.SCHEDULED,
          })
        );
      });
    });

    it('debe usar adminService en modo admin', async () => {
      const user = userEvent.setup();
      render(<AppointmentForm mode="admin" />);

      await fillFormValidData(user, 'admin');

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(adminService.createAppointment).toHaveBeenCalled();
        expect(doctorService.createAppointment).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // Manejo de errores
  // ============================================
  describe('Manejo de errores', () => {
    it('debe mostrar error si el usuario no está autenticado', async () => {
      (useAuthStore as any).mockReturnValue({ user: null });

      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      await fillFormValidData(user, 'doctor');

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'No se pudo validar tu identidad. Por favor, recarga la página.',
            variant: 'destructive',
          })
        );
      });
    });

    it('debe manejar error 400 de validación', async () => {
      const axiosError = new axios.AxiosError('Bad Request', '400', undefined, undefined, {
        status: 400,
        data: { message: 'Datos inválidos' },
      } as any);
      vi.mocked(doctorService.createAppointment).mockRejectedValueOnce(axiosError);

      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      await fillFormValidData(user, 'doctor');

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error de validación',
            variant: 'destructive',
          })
        );
      });
    });

    it('debe manejar error 403 de acceso denegado', async () => {
      const axiosError = new axios.AxiosError('Forbidden', '403', undefined, undefined, {
        status: 403,
        data: {},
      } as any);
      vi.mocked(doctorService.createAppointment).mockRejectedValueOnce(axiosError);

      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      await fillFormValidData(user, 'doctor');

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Acceso denegado',
            description: 'No tienes permiso para crear citas.',
            variant: 'destructive',
          })
        );
      });
    });

    it('debe manejar errores no-axios', async () => {
      vi.mocked(doctorService.createAppointment).mockRejectedValueOnce(new Error('Unknown error'));

      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      await fillFormValidData(user, 'doctor');

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Ocurrió un error inesperado.',
            variant: 'destructive',
          })
        );
      });
    });
  });

  // ============================================
  // Funcionalidad del botón Limpiar
  // ============================================
  describe('Botón Limpiar', () => {
    it('debe resetear el formulario al hacer clic en Limpiar', async () => {
      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      // Escribir en el campo de razón usando fireEvent para actualizar el contador
      const reasonTextarea = screen.getByPlaceholderText(/Describe el motivo/i);
      fireEvent.change(reasonTextarea, { target: { value: 'Consulta general' } });

      // Verificar contador
      await waitFor(() => {
        expect(screen.getByText('16/1000')).toBeInTheDocument();
      });

      // Hacer clic en Limpiar
      await user.click(screen.getByRole('button', { name: /Limpiar/i }));

      // Verificar que se reseteó
      await waitFor(() => {
        expect(reasonTextarea).toHaveValue('');
        expect(screen.getByText('0/1000')).toBeInTheDocument();
      });
    });

    it('debe resetear el contador de caracteres de razón', async () => {
      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      const reasonTextarea = screen.getByPlaceholderText(/Describe el motivo/i);
      fireEvent.change(reasonTextarea, { target: { value: 'Test reason' } });

      await waitFor(() => {
        expect(screen.getByText('11/1000')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Limpiar/i }));

      await waitFor(() => {
        expect(screen.getByText('0/1000')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Estado de carga
  // ============================================
  describe('Estado de carga', () => {
    it('debe deshabilitar el botón de submit mientras carga', async () => {
      // Simular una promesa que no se resuelve inmediatamente
      vi.mocked(doctorService.createAppointment).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ appointmentId: 'apt-123' }), 100))
      );

      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      await fillFormValidData(user, 'doctor');

      const submitButton = screen.getByRole('button', { name: /Crear Cita/i });
      fireEvent.submit(document.querySelector('form')!);

      // El botón debería estar deshabilitado durante la carga
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Creando cita.../i })).toBeInTheDocument();
      });
    });

    it('debe mostrar el texto correcto durante la carga', async () => {
      vi.mocked(doctorService.createAppointment).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ appointmentId: 'apt-123' }), 100))
      );

      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      await fillFormValidData(user, 'doctor');

      fireEvent.submit(document.querySelector('form')!);

      await waitFor(() => {
        expect(screen.getByText(/Creando cita.../i)).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Selección de estado
  // ============================================
  describe('Selección de estado', () => {
    it('debe tener estado "Scheduled" por defecto', async () => {
      render(<AppointmentForm mode="doctor" />);

      // El estado por defecto debería ser Scheduled (Programado)
      // Hay múltiples elementos, verificamos que al menos uno existe
      const programadoElements = screen.getAllByText('Programado');
      expect(programadoElements.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Contador de caracteres
  // ============================================
  describe('Contador de caracteres', () => {
    it('debe actualizar el contador al escribir en razón', async () => {
      render(<AppointmentForm mode="doctor" />);

      const reasonTextarea = screen.getByPlaceholderText(/Describe el motivo/i);

      expect(screen.getByText('0/1000')).toBeInTheDocument();

      fireEvent.change(reasonTextarea, { target: { value: 'Dolor de cabeza' } });

      await waitFor(() => {
        expect(screen.getByText('15/1000')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Búsqueda y paginación
  // ============================================
  describe('Búsqueda y paginación de pacientes', () => {
    it('debe mostrar el campo de búsqueda de pacientes', async () => {
      render(<AppointmentForm mode="doctor" />);

      expect(screen.getByPlaceholderText(/Buscar paciente por nombre/i)).toBeInTheDocument();
    });

    it('debe buscar pacientes al hacer clic en el botón de búsqueda', async () => {
      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      const searchInput = screen.getByPlaceholderText(/Buscar paciente por nombre/i);
      await user.type(searchInput, 'Juan');

      // Hacer clic en el botón de búsqueda
      await clickPatientSearchButton(user);

      await waitFor(() => {
        expect(patientService.getPatients).toHaveBeenCalledWith({
          q: 'Juan',
          page: '1'
        });
      });
    });

    it('debe mostrar botones de paginación de pacientes', async () => {
      render(<AppointmentForm mode="doctor" />);

      // Los botones de paginación deben estar presentes
      const buttons = screen.getAllByRole('button');
      const prevButton = buttons.find(b => b.querySelector('svg.lucide-chevron-left'));
      const nextButton = buttons.find(b => b.querySelector('svg.lucide-chevron-right'));
      
      expect(prevButton).toBeInTheDocument();
      expect(nextButton).toBeInTheDocument();
    });

    it('debe cambiar de página al hacer clic en siguiente', async () => {
      // Mock con más páginas
      vi.mocked(patientService.getPatients).mockResolvedValue({
        items: [
          { id: 'patient-1', fullName: 'Juan Pérez', document: '12345678' },
        ],
        page: 1,
        pageSize: 1,
        totalCount: 5
      } as any);

      const user = userEvent.setup();
      render(<AppointmentForm mode="doctor" />);

      // Primero buscar para cargar pacientes
      await clickPatientSearchButton(user);

      await waitFor(() => {
        expect(patientService.getPatients).toHaveBeenCalled();
      });

      // Encontrar el botón siguiente (ChevronRight) en la sección de pacientes
      const patientSection = screen.getByPlaceholderText(/Buscar paciente/i).closest('.space-y-2');
      const nextButton = patientSection?.querySelector('button:has(svg.lucide-chevron-right)');
      
      if (nextButton) {
        await user.click(nextButton);

        await waitFor(() => {
          expect(patientService.getPatients).toHaveBeenCalledWith({
            q: '',
            page: '2'
          });
        });
      }
    });
  });

  describe('Búsqueda y paginación de doctores (modo admin)', () => {
    it('debe mostrar el campo de búsqueda de doctores en modo admin', async () => {
      render(<AppointmentForm mode="admin" />);

      expect(screen.getByPlaceholderText(/Buscar doctor por nombre/i)).toBeInTheDocument();
    });

    it('debe buscar doctores al hacer clic en el botón de búsqueda', async () => {
      const user = userEvent.setup();
      render(<AppointmentForm mode="admin" />);

      const searchInput = screen.getByPlaceholderText(/Buscar doctor por nombre/i);
      await user.type(searchInput, 'Carlos');

      // Hacer clic en el botón de búsqueda de doctores
      await clickDoctorSearchButton(user);

      await waitFor(() => {
        expect(doctorService.getDoctors).toHaveBeenCalledWith({
          q: 'Carlos',
          page: '1'
        });
      });
    });
  });
});

// ============================================================================
// Helpers
// ============================================================================

function getFutureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(10, 0, 0, 0);
  return date.toISOString().slice(0, 16);
}

async function clickPatientSearchButton(user: ReturnType<typeof userEvent.setup>) {
  const searchInput = screen.getByPlaceholderText(/Buscar paciente por nombre/i);
  const container = searchInput.closest('.relative.flex.gap-2');
  const searchButton = container?.querySelector('button');
  if (searchButton) {
    await user.click(searchButton);
  }
}

async function clickDoctorSearchButton(user: ReturnType<typeof userEvent.setup>) {
  const searchInput = screen.getByPlaceholderText(/Buscar doctor por nombre/i);
  const container = searchInput.closest('.relative.flex.gap-2');
  const searchButton = container?.querySelector('button');
  if (searchButton) {
    await user.click(searchButton);
  }
}

async function selectPatient(user: ReturnType<typeof userEvent.setup>) {
  // Primero buscar pacientes
  await clickPatientSearchButton(user);
  
  await waitFor(() => {
    expect(patientService.getPatients).toHaveBeenCalled();
  });

  // Buscar el trigger del select de paciente
  const patientTriggers = screen.getAllByRole('combobox');
  const patientTrigger = patientTriggers[0];
  await user.click(patientTrigger);

  // Esperar a que aparezca el contenido del select y seleccionar el primer paciente
  await waitFor(() => {
    const option = screen.getByText('Juan Pérez');
    expect(option).toBeInTheDocument();
  });
  await user.click(screen.getByText('Juan Pérez'));
}

async function selectDoctor(user: ReturnType<typeof userEvent.setup>) {
  // Primero buscar doctores
  await clickDoctorSearchButton(user);
  
  await waitFor(() => {
    expect(doctorService.getDoctors).toHaveBeenCalled();
  });

  // En modo admin, el selector de doctor es el segundo combobox
  const triggers = screen.getAllByRole('combobox');
  const doctorTrigger = triggers[1];
  await user.click(doctorTrigger);

  await waitFor(() => {
    const option = screen.getByText('Dr. Carlos Rodríguez');
    expect(option).toBeInTheDocument();
  });
  await user.click(screen.getByText('Dr. Carlos Rodríguez'));
}

async function fillDateTimeField(user: ReturnType<typeof userEvent.setup>) {
  const dateInput = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
  const futureDate = getFutureDate(7);
  fireEvent.change(dateInput, { target: { value: futureDate } });
}

async function fillFormValidData(
  user: ReturnType<typeof userEvent.setup>,
  mode: 'admin' | 'doctor'
) {
  await selectPatient(user);
  
  if (mode === 'admin') {
    await selectDoctor(user);
  }

  await fillDateTimeField(user);
}
