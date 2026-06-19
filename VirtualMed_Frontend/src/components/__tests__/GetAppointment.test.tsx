import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListAppointmentsComponent from '../appointments/getAppointment';
import { doctorService } from '@/lib/api/doctor.service';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { AppointmentStatus } from '@/constants/appointmentStatus';
import axios from 'axios';

// Mock services y hooks
vi.mock('@/lib/api/doctor.service', () => ({
  doctorService: {
    getAppointments: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast');
vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

beforeAll(() => {
  if (!global.ResizeObserver) {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
  }

  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

// Mock data
const mockAppointments = [
  {
    id: 'apt-1',
    patientId: 'patient-1',
    doctorId: 'doctor-1',
    doctorFullName: 'Dr. John Doe',
    patientFullName: 'Jane Smith',
    hasClinicalEncounter: false,
    scheduledAt: '2025-04-10T10:00:00.000Z',
    durationMinutes: 30,
    reason: 'Consulta general',
    status: AppointmentStatus.SCHEDULED,
    createdAt: '2025-04-01T10:00:00.000Z',
    updatedAt: '2025-04-01T10:00:00.000Z',
  },
  {
    id: 'apt-2',
    patientId: 'patient-2',
    doctorId: 'doctor-1',
    doctorFullName: 'Dr. Doe John',
    patientFullName: 'Smith Jane',
    hasClinicalEncounter: false,
    scheduledAt: '2025-04-11T14:00:00.000Z',
    durationMinutes: 45,
    reason: 'Revisión de exámenes',
    status: AppointmentStatus.CONFIRMED,
    createdAt: '2025-04-02T10:00:00.000Z',
    updatedAt: '2025-04-02T10:00:00.000Z',
  },
  {
    id: 'apt-3',
    patientId: 'patient-3',
    doctorId: 'doctor-1',
    doctorFullName: 'Dr. Marian Perez',
    patientFullName: 'Carlos Lopez',
    hasClinicalEncounter: false,
    scheduledAt: '2025-04-12T16:00:00.000Z',
    durationMinutes: 60,
    reason: null,
    status: AppointmentStatus.CANCELLED,
    createdAt: '2025-04-03T10:00:00.000Z',
    updatedAt: '2025-04-03T10:00:00.000Z',
  },
];

describe('ListAppointmentsComponent', () => {
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as ReturnType<typeof vi.fn>).mockReturnValue({ toast: mockToast });
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ push: vi.fn() });
    vi.mocked(doctorService.getAppointments).mockResolvedValue(mockAppointments);
  });

  // ============================================
  // Renderizado del componente
  // ============================================
  describe('Renderizado del componente', () => {
    it('debe renderizar el título y descripción', () => {
      render(<ListAppointmentsComponent />);

      expect(screen.getByText('Mis Citas')).toBeInTheDocument();
      expect(screen.getByText(/Filtra y visualiza tus citas/i)).toBeInTheDocument();
    });

    it('debe renderizar los campos de filtro', () => {
      render(<ListAppointmentsComponent />);

      expect(screen.getByText('Fecha Inicio *')).toBeInTheDocument();
      expect(screen.getByText('Fecha Fin *')).toBeInTheDocument();
      expect(screen.getByText('Estado')).toBeInTheDocument();
    });

    it('debe renderizar los botones de acción', () => {
      render(<ListAppointmentsComponent />);

      expect(screen.getByRole('button', { name: /Buscar/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Limpiar/i })).toBeInTheDocument();
    });

    it('debe mostrar mensaje inicial para completar filtros', () => {
      render(<ListAppointmentsComponent />);

      expect(
        screen.getByText(/Completa los filtros y haz clic en 'Buscar'/i)
      ).toBeInTheDocument();
    });

    it('debe renderizar el card de filtros con el ícono de búsqueda', () => {
      render(<ListAppointmentsComponent />);

      expect(screen.getByText('Filtros de búsqueda')).toBeInTheDocument();
    });
  });

  // ============================================
  // Validación de formulario
  // ============================================
  describe('Validación de formulario', () => {
    it('debe mostrar error cuando no se completan las fechas', async () => {
      render(<ListAppointmentsComponent />);

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Validación',
        description: 'Por favor, completa las fechas de inicio y fin.',
        variant: 'destructive',
      });
    });

    it('debe mostrar error cuando solo se completa fecha inicio', async () => {
      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Validación',
        description: 'Por favor, completa las fechas de inicio y fin.',
        variant: 'destructive',
      });
    });

    it('debe mostrar error cuando fecha inicio es mayor a fecha fin', async () => {
      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      
      fireEvent.change(inputs[0], { target: { value: '2025-04-15' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-01' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Validación',
        description: 'La fecha de inicio no puede ser mayor a la fecha de fin.',
        variant: 'destructive',
      });
    });
  });

  // ============================================
  // Búsqueda de citas
  // ============================================
  describe('Búsqueda de citas', () => {
    it('debe llamar al servicio con las fechas correctas', async () => {
      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-30' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(doctorService.getAppointments).toHaveBeenCalledWith({
          from: expect.stringContaining('2025-04-01'),
          to: expect.stringContaining('2025-04-30'),
        });
      });
    });

    it('debe mostrar el estado de carga mientras busca', async () => {
      vi.mocked(doctorService.getAppointments).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockAppointments), 100))
      );

      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-30' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      expect(screen.getByText('Buscando...')).toBeInTheDocument();
      expect(searchButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.queryByText('Buscando...')).not.toBeInTheDocument();
      });
    });

    it('debe mostrar las citas en la tabla después de buscar', async () => {
      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-30' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText('Consulta general')).toBeInTheDocument();
        expect(screen.getByText('Revisión de exámenes')).toBeInTheDocument();
      });
    });

    it('debe mostrar mensaje cuando no hay citas', async () => {
      vi.mocked(doctorService.getAppointments).mockResolvedValue([]);

      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-30' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Sin resultados',
          description: 'No se encontraron citas para el rango de fechas especificado.',
        });
      });
    });

    it('debe mostrar el conteo correcto de citas', async () => {
      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-30' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText('Citas (3)')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Filtrado por estado
  // ============================================
  describe('Filtrado por estado', () => {
    it('debe filtrar citas por estado después de buscar', async () => {
      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-30' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText('Citas (3)')).toBeInTheDocument();
      });

      // Seleccionar filtro de estado - abrir el select
      const statusSelect = screen.getByRole('combobox');
      await userEvent.click(statusSelect);

      // Seleccionar "Confirmado"
      const confirmedOption = await screen.findByRole('option', { name: /Confirmado/i });
      await userEvent.click(confirmedOption);

      await waitFor(() => {
        expect(screen.getByText('Citas (1)')).toBeInTheDocument();
        expect(screen.getByText('Revisión de exámenes')).toBeInTheDocument();
      });
    });

    it('debe mostrar todas las citas al seleccionar "Todos los estados"', async () => {
      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-30' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText('Citas (3)')).toBeInTheDocument();
      });

      // Abrir select y seleccionar un estado
      const statusSelect = screen.getByRole('combobox');
      await userEvent.click(statusSelect);
      
      const confirmedOption = await screen.findByRole('option', { name: /Confirmado/i });
      await userEvent.click(confirmedOption);

      await waitFor(() => {
        expect(screen.getByText('Citas (1)')).toBeInTheDocument();
      });

      // Volver a todos los estados
      await userEvent.click(statusSelect);
      const allOption = await screen.findByRole('option', { name: /Todos los estados/i });
      await userEvent.click(allOption);

      await waitFor(() => {
        expect(screen.getByText('Citas (3)')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Resetear filtros
  // ============================================
  describe('Resetear filtros', () => {
    it('debe limpiar los filtros y resultados al hacer clic en Limpiar', async () => {
      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-30' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText('Citas (3)')).toBeInTheDocument();
      });

      const resetButton = screen.getByRole('button', { name: /Limpiar/i });
      await userEvent.click(resetButton);

      await waitFor(() => {
        expect(screen.queryByText('Citas (3)')).not.toBeInTheDocument();
        expect(
          screen.getByText(/Completa los filtros y haz clic en 'Buscar'/i)
        ).toBeInTheDocument();
      });

      // Verificar que los inputs están vacíos
      expect(inputs[0]).toHaveValue('');
      expect(inputs[1]).toHaveValue('');
    });
  });

  // ============================================
  // Manejo de errores
  // ============================================
  describe('Manejo de errores', () => {
    it('debe mostrar error 403 (acceso denegado)', async () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 403 },
      };
      vi.mocked(doctorService.getAppointments).mockRejectedValue(axiosError);
      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-30' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Acceso denegado',
          description: 'No tienes permiso para ver estas citas.',
          variant: 'destructive',
        });
      });
    });

    it('debe mostrar error genérico de Axios', async () => {
      const axiosError = {
        isAxiosError: true,
        response: { 
          status: 500, 
          data: { message: 'Error del servidor' } 
        },
      };
      vi.mocked(doctorService.getAppointments).mockRejectedValue(axiosError);
      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-30' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Error del servidor',
          variant: 'destructive',
        });
      });
    });

    it('debe mostrar error inesperado cuando no es Axios', async () => {
      vi.mocked(doctorService.getAppointments).mockRejectedValue(new Error('Error desconocido'));
      vi.spyOn(axios, 'isAxiosError').mockReturnValue(false);

      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-30' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Ocurrió un error inesperado.',
          variant: 'destructive',
        });
      });
    });
  });

  // ============================================
  // Visualización de datos en tabla
  // ============================================
  describe('Visualización de datos en tabla', () => {
    it('debe mostrar las columnas correctas en la tabla', async () => {
      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-30' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByRole('columnheader', { name: 'Doctor' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Fecha y Hora' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Duración (min)' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Razón' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Estado' })).toBeInTheDocument();
      });
    });

    it('debe mostrar guión cuando no hay razón', async () => {
      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-30' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        // La cita apt-3 no tiene razón
        expect(screen.getByText('-')).toBeInTheDocument();
      });
    });

    it('debe mostrar la duración correcta de cada cita', async () => {
      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-30' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText('30')).toBeInTheDocument();
        expect(screen.getByText('45')).toBeInTheDocument();
        expect(screen.getByText('60')).toBeInTheDocument();
      });
    });

    it('debe mostrar los badges de estado correctamente', async () => {
      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-30' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText('Programado')).toBeInTheDocument();
        expect(screen.getByText('Confirmado')).toBeInTheDocument();
        expect(screen.getByText('Cancelado')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Mensaje de estado vacío contextual
  // ============================================
  describe('Mensaje de estado vacío', () => {
    it('debe mostrar mensaje diferente cuando hay filtros pero no hay resultados', async () => {
      vi.mocked(doctorService.getAppointments).mockResolvedValue([]);

      render(<ListAppointmentsComponent />);

      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[0], { target: { value: '2025-04-01' } });
      fireEvent.change(inputs[1], { target: { value: '2025-04-30' } });

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(
          screen.getByText('No se encontraron citas para el rango de fechas seleccionado.')
        ).toBeInTheDocument();
      });
    });
  });
});
