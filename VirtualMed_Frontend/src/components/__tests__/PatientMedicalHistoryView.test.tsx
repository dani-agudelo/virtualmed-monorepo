import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatientMedicalHistoryView } from '@/components/dashboard/patient/medical-history-view';
import { patientService } from '@/lib/api/patient.service';
import { doctorService } from '@/lib/api/doctor.service';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/constants/userRole';

vi.mock('@/lib/api/patient.service', () => ({
  patientService: {
    getPatientClinicalEncounters: vi.fn(),
    exportPatientHistoryPdf: vi.fn(),
  },
}));

vi.mock('@/lib/api/doctor.service', () => ({
  doctorService: {
    getAppointment: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

vi.mock('@/store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

const mockToast = vi.fn();

const mockEncounters = [
  {
    id: 'enc-1',
    appointmentId: 'apt-1',
    patientId: 'patient-1',
    doctorId: 'doctor-1',
    encounterType: 'Consultation',
    startAt: '2026-04-19T15:00:00Z',
    endAt: '2026-04-19T15:30:00Z',
    chiefComplaint: 'Control general',
    currentCondition: 'Evolución favorable',
    physicalExam: 'Sin hallazgos relevantes',
    assessment: 'Paciente estable',
    plan: 'Continuar manejo',
    notes: 'Observación médica',
    recordingUrl: '',
    diagnoses: [
      {
        id: 'diag-1',
        icd10Code: 'J00',
        description: 'Rinitis aguda',
        type: 'Primary',
      },
    ],
    prescriptions: [
      {
        id: 'pres-1',
        prescriptionNumber: 'RX-001',
        issuedAt: '2026-04-19T16:00:00Z',
        validUntil: '2026-05-19',
        medications: [
          {
            medicationId: 'med-1',
            medicationName: 'Ibuprofeno',
            dosage: '500 mg',
            frequency: 'Cada 8 horas',
            durationDays: 5,
            instructions: 'Tomar con alimentos',
          },
        ],
      },
    ],
  },
  {
    id: 'enc-2',
    appointmentId: 'apt-2',
    patientId: 'patient-1',
    doctorId: 'doctor-2',
    encounterType: 'FollowUp',
    startAt: '2026-03-10T11:00:00Z',
    endAt: '2026-03-10T11:20:00Z',
    chiefComplaint: 'Seguimiento',
    currentCondition: '',
    physicalExam: '',
    assessment: '',
    plan: '',
    notes: '',
    recordingUrl: '',
    diagnoses: [],
    prescriptions: [],
  },
];

const mockAppointment = {
  id: 'apt-1',
  patientId: 'patient-1',
  patientFullName: 'Juan Pérez',
  doctorId: 'doctor-1',
  doctorFullName: 'Dra. García',
  scheduledAt: '2026-04-19T15:00:00Z',
  durationMinutes: 30,
  status: 'Confirmed',
  reason: 'Control general',
  createdAt: '2026-04-19T14:00:00Z',
  updatedAt: '2026-04-19T14:00:00Z',
  hasClinicalEncounter: true,
};

describe('PatientMedicalHistoryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue({ toast: mockToast } as any);
    vi.mocked(useAuthStore).mockReturnValue({
      user: {
        sub: 'patient-1',
        role: UserRole.PATIENT,
      },
    } as any);

    vi.mocked(patientService.getPatientClinicalEncounters).mockResolvedValue(mockEncounters as any);
    vi.mocked(patientService.exportPatientHistoryPdf).mockResolvedValue(
      new Blob(['pdf'], { type: 'application/pdf' })
    );
    vi.mocked(doctorService.getAppointment).mockResolvedValue(mockAppointment as any);
  });

  it('renderiza los encuentros ordenados por fecha descendente', async () => {
    render(<PatientMedicalHistoryView />);

    await waitFor(() => {
      expect(patientService.getPatientClinicalEncounters).toHaveBeenCalledWith(
        '',
        {
          from: undefined,
          to: undefined,
        },
        expect.any(Object)
      );
    });

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings[0]).toHaveTextContent('Control general');
    expect(headings[1]).toHaveTextContent('Seguimiento');
    expect(screen.getByText('2 encuentros')).toBeInTheDocument();
  });

  it('aplica filtros de fecha al consultar encuentros', async () => {
    const user = userEvent.setup();
    render(<PatientMedicalHistoryView />);

    await waitFor(() => {
      expect(patientService.getPatientClinicalEncounters).toHaveBeenCalled();
    });

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-04-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-04-30' } });

    await user.click(screen.getByRole('button', { name: /filtrar/i }));

    await waitFor(() => {
      expect(patientService.getPatientClinicalEncounters).toHaveBeenLastCalledWith(
        '',
        {
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
        expect.any(Object)
      );
    });
  });

  it('abre el detalle del encuentro y permite descargar el PDF', async () => {
    const user = userEvent.setup();
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<PatientMedicalHistoryView />);

    await waitFor(() => {
      expect(screen.getByText('Control general')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Descargar historial PDF').closest('button');
    expect(exportButton).not.toBeNull();
    await user.click(exportButton as HTMLButtonElement);

    await waitFor(() => {
      expect(patientService.exportPatientHistoryPdf).toHaveBeenCalledWith('');
    });

    await user.click(screen.getAllByRole('button', { name: /ver detalle/i })[0]);

    await waitFor(() => {
      expect(doctorService.getAppointment).toHaveBeenCalledWith('apt-1');
      expect(screen.getByText(/detalle del encuentro clínico/i)).toBeInTheDocument();
      expect(screen.getByText('Dra. García')).toBeInTheDocument();
      expect(screen.getByText('Ibuprofeno')).toBeInTheDocument();
    });

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('muestra estado vacío cuando no hay encuentros', async () => {
    vi.mocked(patientService.getPatientClinicalEncounters).mockResolvedValueOnce([] as any);

    render(<PatientMedicalHistoryView />);

    await waitFor(() => {
      expect(screen.getByText(/No hay encuentros clínicos/i)).toBeInTheDocument();
    });
  });
});
