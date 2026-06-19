import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DoctorPatientsView } from '@/components/dashboard/doctor/doctor-patients-view';
import { doctorService } from '@/lib/api/doctor.service';
import { patientService } from '@/lib/api/patient.service';
import { useToast } from '@/hooks/use-toast';
import { AppointmentStatus } from '@/constants/appointmentStatus';

vi.mock('@/lib/api/doctor.service', () => ({
  doctorService: {
    getAppointments: vi.fn(),
  },
}));

vi.mock('@/lib/api/patient.service', () => ({
  patientService: {
    getPatients: vi.fn(),
    getPatient: vi.fn(),
    exportPatientHistoryFhir: vi.fn(),
    exportPatientHistoryPdf: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

const mockToast = vi.fn();

const mockAppointments = [
  {
    id: 'apt-1',
    patientId: 'patient-1',
    doctorId: 'doctor-1',
    doctorFullName: 'Dr. Test',
    patientFullName: 'Juan Perez',
    hasClinicalEncounter: false,
    scheduledAt: '2026-01-10T10:00:00.000Z',
    durationMinutes: 30,
    reason: 'Control',
    status: AppointmentStatus.CONFIRMED,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
  },
  {
    id: 'apt-2',
    patientId: 'patient-3',
    doctorId: 'doctor-1',
    doctorFullName: 'Dr. Test',
    patientFullName: 'Ana Ruiz',
    hasClinicalEncounter: false,
    scheduledAt: '2026-01-11T10:00:00.000Z',
    durationMinutes: 30,
    reason: 'Control',
    status: AppointmentStatus.SCHEDULED,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
  },
];

const mockSearchResponse = {
  items: [
    { id: 'patient-1', fullName: 'Juan Perez', document: '111' },
    { id: 'patient-2', fullName: 'Paciente Global', document: '222' },
  ],
  page: 1,
  pageSize: 20,
  totalCount: 2,
};

const mockDetail = {
  id: 'patient-1',
  userId: 'user-1',
  identificationType: 'CC',
  document: '111',
  dateOfBirth: '2000-01-01',
  gender: 'male',
  bloodType: 'O+',
  allergies: 'Ninguna',
  phoneNumber: '3000000000',
  acceptPrivacy: true,
  authorizeData: true,
};

describe('DoctorPatientsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue({ toast: mockToast } as any);

    vi.mocked(doctorService.getAppointments).mockResolvedValue(mockAppointments as any);
    vi.mocked(patientService.getPatients).mockResolvedValue(mockSearchResponse as any);
    vi.mocked(patientService.getPatient).mockResolvedValue(mockDetail as any);
    vi.mocked(patientService.exportPatientHistoryFhir).mockResolvedValue(
      new Blob(['{"resourceType":"Bundle"}'], { type: 'application/json' })
    );
    vi.mocked(patientService.exportPatientHistoryPdf).mockResolvedValue(
      new Blob(['pdf-content'], { type: 'application/pdf' })
    );
  });

  it('muestra solo pacientes que existan en las citas del doctor', async () => {
    render(<DoctorPatientsView />);

    await waitFor(() => {
      expect(doctorService.getAppointments).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(patientService.getPatients).toHaveBeenCalled();
    });

    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.queryByText('Paciente Global')).not.toBeInTheDocument();
  });

  it('envia q al endpoint de busqueda al usar el buscador', async () => {
    const user = userEvent.setup();
    render(<DoctorPatientsView />);

    await waitFor(() => {
      expect(patientService.getPatients).toHaveBeenCalled();
    });

    const input = screen.getByPlaceholderText(/Buscar por nombre o documento/i);
    await user.clear(input);
    await user.type(input, 'Juan');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(patientService.getPatients).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'Juan',
          page: 1,
          pageSize: 20,
        }),
        expect.any(Object)
      );
    });
  });

  it('abre detalle y permite exportar en FHIR y PDF', async () => {
    const user = userEvent.setup();
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<DoctorPatientsView />);

    await waitFor(() => {
      expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Ver detalle/i }));

    await waitFor(() => {
      expect(patientService.getPatient).toHaveBeenCalledWith('patient-1');
      expect(screen.getByText(/Detalle del Paciente/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Exportar FHIR/i }));
    await waitFor(() => {
      expect(patientService.exportPatientHistoryFhir).toHaveBeenCalledWith('patient-1');
    });

    await user.click(screen.getByRole('button', { name: /Exportar PDF/i }));
    await waitFor(() => {
      expect(patientService.exportPatientHistoryPdf).toHaveBeenCalledWith('patient-1');
    });

    expect(createObjectURLSpy).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(2);
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it('no consulta pacientes cuando el doctor no tiene citas', async () => {
    vi.mocked(doctorService.getAppointments).mockResolvedValueOnce([] as any);

    render(<DoctorPatientsView />);

    await waitFor(() => {
      expect(doctorService.getAppointments).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(patientService.getPatients).not.toHaveBeenCalled();
      expect(screen.getByText(/No se encontraron pacientes con esos filtros/i)).toBeInTheDocument();
    });
  });
});
