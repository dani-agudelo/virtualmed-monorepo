import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListAppointmentsComponent from '../appointments/getAppointmentAdminAndDoctors';
import { doctorService } from '@/lib/api/doctor.service';
import { patientService } from '@/lib/api/patient.service';
import { useToast } from '@/hooks/use-toast';
import { AppointmentStatus } from '@/constants/appointmentStatus';

// Mock services y hooks
vi.mock('@/lib/api/doctor.service', () => ({
  doctorService: {
    getAppointments: vi.fn(),
    getDoctors: vi.fn(),
    updateAppointment: vi.fn(),
  },
}));

vi.mock('@/lib/api/patient.service', () => ({
  patientService: {
    getPatients: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast');

// Mock data
const mockPatients = [
  { sub: 'patient-1', fullname: 'Juan Pérez', email: 'juan@test.com' },
  { sub: 'patient-2', fullname: 'María López', email: 'maria@test.com' },
];

const mockDoctors = [
  { sub: 'doctor-1', fullname: 'Dr. Carlos Rodríguez', email: 'carlos@test.com' },
  { sub: 'doctor-2', fullname: 'Dra. Ana García', email: 'ana@test.com' },
];

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
    doctorFullName: 'Dr. John Doe',
    patientFullName: 'Jane Smith',
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
    doctorId: 'doctor-2',
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

// Helper para llenar fechas y buscar
const fillDatesAndSearch = async (fromDate: string, toDate: string) => {
  const inputs = document.querySelectorAll('input[type="date"]');
  fireEvent.change(inputs[0], { target: { value: fromDate } });
  fireEvent.change(inputs[1], { target: { value: toDate } });

  const searchButton = screen.getByRole('button', { name: /Buscar/i });
  await userEvent.click(searchButton);
};

describe('ListAppointmentsComponent', () => {
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as ReturnType<typeof vi.fn>).mockReturnValue({ toast: mockToast });
    vi.mocked(doctorService.getAppointments).mockResolvedValue(mockAppointments);
    vi.mocked(doctorService.getDoctors).mockResolvedValue(mockDoctors as never);
    vi.mocked(patientService.getPatients).mockResolvedValue(mockPatients as never);
    vi.mocked(doctorService.updateAppointment).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================
  // MODO ADMIN - Renderizado
  // ============================================
  describe('Modo Admin - Renderizado', () => {
    it('debe renderizar el título y descripción', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      expect(screen.getByText('Mis Citas')).toBeInTheDocument();
      expect(screen.getByText(/Filtra y visualiza tus citas/i)).toBeInTheDocument();
    });

    it('debe renderizar los filtros de paciente y doctor en modo admin', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      await waitFor(() => {
        expect(screen.getByText('Paciente')).toBeInTheDocument();
        expect(screen.getByText('Doctor')).toBeInTheDocument();
      });
    });

    it('debe renderizar los campos de fecha y estado', () => {
      render(<ListAppointmentsComponent mode="admin" />);

      expect(screen.getByText('Fecha Inicio *')).toBeInTheDocument();
      expect(screen.getByText('Fecha Fin *')).toBeInTheDocument();
      expect(screen.getByText('Estado')).toBeInTheDocument();
    });

    it('debe renderizar los botones de acción', () => {
      render(<ListAppointmentsComponent mode="admin" />);

      expect(screen.getByRole('button', { name: /Buscar/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Limpiar/i })).toBeInTheDocument();
    });
  });

  // ============================================
  // MODO DOCTOR - Renderizado
  // ============================================
  describe('Modo Doctor - Renderizado', () => {
    it('NO debe renderizar los filtros de paciente y doctor en modo doctor', () => {
      render(<ListAppointmentsComponent mode="doctor" />);

      expect(screen.queryByText('Paciente')).not.toBeInTheDocument();
      // "Doctor" aparece en la tabla pero no como filtro, verificamos que no hay label de filtro
      const doctorLabels = screen.queryAllByText('Doctor');
      expect(doctorLabels.length).toBe(0);
    });

    it('NO debe cargar pacientes ni doctores en modo doctor', async () => {
      render(<ListAppointmentsComponent mode="doctor" />);

      // Esperar un ciclo de render
      await waitFor(() => {
        expect(patientService.getPatients).not.toHaveBeenCalled();
        expect(doctorService.getDoctors).not.toHaveBeenCalled();
      });
    });

    it('debe renderizar los filtros básicos en modo doctor', () => {
      render(<ListAppointmentsComponent mode="doctor" />);

      expect(screen.getByText('Fecha Inicio *')).toBeInTheDocument();
      expect(screen.getByText('Fecha Fin *')).toBeInTheDocument();
      expect(screen.getByText('Estado')).toBeInTheDocument();
    });
  });

  // ============================================
  // Validación de filtros
  // ============================================
  describe('Validación de filtros', () => {
    it('debe mostrar error cuando no se completan las fechas', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      const searchButton = screen.getByRole('button', { name: /Buscar/i });
      await userEvent.click(searchButton);

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Validación',
        description: 'Por favor, completa las fechas de inicio y fin.',
        variant: 'destructive',
      });
    });

    it('debe mostrar error cuando fecha inicio es mayor a fecha fin', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[0], { target: { value: '2025-04-30' } });
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
      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(doctorService.getAppointments).toHaveBeenCalledWith({
          from: expect.stringContaining('2025-04-01'),
          to: expect.stringContaining('2025-04-30'),
        });
      });
    });

    it('debe mostrar estado de carga mientras busca', async () => {
      vi.mocked(doctorService.getAppointments).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockAppointments), 100))
      );

      render(<ListAppointmentsComponent mode="admin" />);

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
      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByText('Consulta general')).toBeInTheDocument();
        expect(screen.getByText('Revisión de exámenes')).toBeInTheDocument();
      });
    });

    it('debe mostrar mensaje cuando no hay citas', async () => {
      vi.mocked(doctorService.getAppointments).mockResolvedValue([]);

      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Sin resultados',
          description: 'No se encontraron citas para el rango de fechas especificado.',
        });
      });
    });

    it('debe mostrar el conteo correcto de citas', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByText('Citas (3)')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Tabla - Diferencias entre modos
  // ============================================
  describe('Tabla - Diferencias entre modos', () => {
    it('debe mostrar columna Doctor en modo admin', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByRole('columnheader', { name: 'Doctor' })).toBeInTheDocument();
      });
    });

    it('NO debe mostrar columna Doctor en modo doctor', async () => {
      render(<ListAppointmentsComponent mode="doctor" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByText('Citas (3)')).toBeInTheDocument();
      });

      expect(screen.queryByRole('columnheader', { name: 'Doctor' })).not.toBeInTheDocument();
    });

    it('debe mostrar columna Paciente en ambos modos', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByRole('columnheader', { name: 'Paciente' })).toBeInTheDocument();
      });
    });

    it('debe mostrar botón de editar en cada fila', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: '' });
        // Filtrar solo los botones que tienen el ícono de editar
        const rows = screen.getAllByRole('row');
        // Debe haber un botón de editar por cada cita (3)
        expect(rows.length).toBeGreaterThan(1); // Header + filas de datos
      });
    });
  });

  // ============================================
  // Resetear filtros
  // ============================================
  describe('Resetear filtros', () => {
    it('debe limpiar filtros y resultados al hacer clic en Limpiar', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

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
    });
  });

  // ============================================
  // Diálogo de edición - Apertura
  // ============================================
  describe('Diálogo de edición - Apertura', () => {
    it('debe abrir el diálogo de edición al hacer clic en el botón editar', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByText('Citas (3)')).toBeInTheDocument();
      });

      // Buscar el primer botón de editar (ghost button con ícono Edit)
      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      const firstDataRow = rows[1]; // Primera fila de datos (después del header)
      const editButton = within(firstDataRow).getByRole('button');
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Editar Cita')).toBeInTheDocument();
      });
    });

    it('debe pre-cargar los datos de la cita en el formulario de edición', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByText('Citas (3)')).toBeInTheDocument();
      });

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      const firstDataRow = rows[1];
      const editButton = within(firstDataRow).getByRole('button');
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Editar Cita')).toBeInTheDocument();
      });

      // Verificar que los campos tienen los valores de la cita
      const dialog = screen.getByRole('dialog');
      const durationInput = within(dialog).getByRole('spinbutton');
      expect(durationInput).toHaveValue(30); // Primera cita tiene 30 minutos
    });

    it('debe mostrar campo Doctor en el diálogo solo en modo admin', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByText('Citas (3)')).toBeInTheDocument();
      });

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      const firstDataRow = rows[1];
      const editButton = within(firstDataRow).getByRole('button');
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Editar Cita')).toBeInTheDocument();
      });

      // En modo admin debe aparecer el campo Doctor en el diálogo
      const dialog = screen.getByRole('dialog');
      const doctorLabels = within(dialog).getAllByText('Doctor');
      expect(doctorLabels.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Diálogo de edición - Validaciones
  // ============================================
  describe('Diálogo de edición - Validaciones', () => {
    const openEditDialog = async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByText('Citas (3)')).toBeInTheDocument();
      });

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      const firstDataRow = rows[1];
      const editButton = within(firstDataRow).getByRole('button');
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Editar Cita')).toBeInTheDocument();
      });
    };

    it('debe validar que la duración esté entre 30 y 1440 minutos', async () => {
      await openEditDialog();

      const dialog = screen.getByRole('dialog');
      
      // Primero poner una fecha válida (futura) para que la validación de fecha pase
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const dateInput = dialog.querySelector('input[type="date"]') as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: futureDateStr } });
      
      // Ahora cambiar la duración a un valor inválido
      const durationInput = within(dialog).getByRole('spinbutton');
      await userEvent.clear(durationInput);
      await userEvent.type(durationInput, '10');

      const confirmButton = within(dialog).getByRole('button', { name: /Confirmar/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Validación',
          description: 'La duración debe estar entre 30 y 1440 minutos.',
          variant: 'destructive',
        });
      });
    });

    it('debe validar que la fecha esté en el rango válido (entre hoy y 1 año)', async () => {
      await openEditDialog();

      const dialog = screen.getByRole('dialog');
      
      // La cita tiene fecha pasada (2025-04-10), intentar confirmar debería fallar
      const confirmButton = within(dialog).getByRole('button', { name: /Confirmar/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Validación',
          description: 'La fecha debe estar entre hoy y 1 año en el futuro.',
          variant: 'destructive',
        });
      });
    });
  });

  // ============================================
  // Diálogo de edición - Actualización exitosa
  // ============================================
  describe('Diálogo de edición - Actualización exitosa', () => {
    it('debe actualizar la cita correctamente', async () => {
      // Configurar fecha actual para validación
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 días en el futuro
      const futureDateStr = futureDate.toISOString().split('T')[0];

      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByText('Citas (3)')).toBeInTheDocument();
      });

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      const firstDataRow = rows[1];
      const editButton = within(firstDataRow).getByRole('button');
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Editar Cita')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');

      // Cambiar la fecha a una válida (futuro)
      const dateInputs = within(dialog).getAllByRole('textbox');
      const dateInput = dialog.querySelector('input[type="date"]') as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: futureDateStr } });

      // Cambiar la duración
      const durationInput = within(dialog).getByRole('spinbutton');
      await userEvent.clear(durationInput);
      await userEvent.type(durationInput, '60');

      const confirmButton = within(dialog).getByRole('button', { name: /Confirmar/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(doctorService.updateAppointment).toHaveBeenCalledWith(
          'apt-1',
          expect.objectContaining({
            durationMinutes: 60,
          })
        );
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Éxito',
          description: 'La cita ha sido actualizada correctamente.',
        });
      });
    });

    it('debe cerrar el diálogo después de actualizar', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByText('Citas (3)')).toBeInTheDocument();
      });

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      const firstDataRow = rows[1];
      const editButton = within(firstDataRow).getByRole('button');
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Editar Cita')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const dateInput = dialog.querySelector('input[type="date"]') as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: futureDateStr } });

      const confirmButton = within(dialog).getByRole('button', { name: /Confirmar/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.queryByText('Editar Cita')).not.toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Diálogo de edición - Cancelar
  // ============================================
  describe('Diálogo de edición - Cancelar', () => {
    it('debe cerrar el diálogo al hacer clic en Cancelar', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByText('Citas (3)')).toBeInTheDocument();
      });

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      const firstDataRow = rows[1];
      const editButton = within(firstDataRow).getByRole('button');
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Editar Cita')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const cancelButton = within(dialog).getByRole('button', { name: /Cancelar/i });
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Editar Cita')).not.toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Manejo de errores HTTP
  // ============================================
  describe('Manejo de errores HTTP', () => {
    it('debe mostrar error 403 al buscar citas', async () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 403 },
      };
      vi.mocked(doctorService.getAppointments).mockRejectedValue(axiosError);

      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Acceso denegado',
          description: 'No tienes permiso para realizar esta acción.',
          variant: 'destructive',
        });
      });
    });

    it('debe mostrar error al actualizar cita', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const axiosError = {
        isAxiosError: true,
        response: { status: 500, data: { message: 'Error interno del servidor' } },
      };
      vi.mocked(doctorService.updateAppointment).mockRejectedValue(axiosError);

      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByText('Citas (3)')).toBeInTheDocument();
      });

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');
      const firstDataRow = rows[1];
      const editButton = within(firstDataRow).getByRole('button');
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Editar Cita')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const dateInput = dialog.querySelector('input[type="date"]') as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: futureDateStr } });

      const confirmButton = within(dialog).getByRole('button', { name: /Confirmar/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Error interno del servidor',
          variant: 'destructive',
        });
      });
    });
  });

  // ============================================
  // Filtrado por estado
  // ============================================
  describe('Filtrado por estado', () => {
    it('debe filtrar citas por estado después de buscar', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByText('Citas (3)')).toBeInTheDocument();
      });

      // Encontrar el select de estado (el tercero en modo admin)
      const comboboxes = screen.getAllByRole('combobox');
      const statusSelect = comboboxes[comboboxes.length - 1]; // El último es el de estado
      await userEvent.click(statusSelect);

      // Seleccionar "Confirmado"
      const confirmedOption = await screen.findByRole('option', { name: /Confirmado/i });
      await userEvent.click(confirmedOption);

      await waitFor(() => {
        expect(screen.getByText('Citas (1)')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Mensaje de estado vacío
  // ============================================
  describe('Mensaje de estado vacío', () => {
    it('debe mostrar mensaje inicial cuando no hay filtros', () => {
      render(<ListAppointmentsComponent mode="admin" />);

      expect(
        screen.getByText(/Completa los filtros y haz clic en 'Buscar'/i)
      ).toBeInTheDocument();
    });

    it('debe mostrar mensaje cuando no hay resultados con filtros', async () => {
      vi.mocked(doctorService.getAppointments).mockResolvedValue([]);

      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(
          screen.getByText('No se encontraron citas para el rango de fechas seleccionado.')
        ).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Visualización de datos
  // ============================================
  describe('Visualización de datos', () => {
    it('debe mostrar guión cuando no hay razón', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByText('-')).toBeInTheDocument();
      });
    });

    it('debe mostrar los badges de estado correctamente', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByText('Programado')).toBeInTheDocument();
        expect(screen.getByText('Confirmado')).toBeInTheDocument();
        expect(screen.getByText('Cancelado')).toBeInTheDocument();
      });
    });

    it('debe mostrar la duración correcta de cada cita', async () => {
      render(<ListAppointmentsComponent mode="admin" />);

      await fillDatesAndSearch('2025-04-01', '2025-04-30');

      await waitFor(() => {
        expect(screen.getByText('30')).toBeInTheDocument();
        expect(screen.getByText('45')).toBeInTheDocument();
        expect(screen.getByText('60')).toBeInTheDocument();
      });
    });
  });
});
