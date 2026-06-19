import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MedicalHistoryPage from '@/app/dashboard/medical-history/page';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/constants/userRole';

vi.mock('@/store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/components/dashboard/patient/medical-history-view', () => ({
  PatientMedicalHistoryView: () => <div>Patient Medical History View</div>,
}));

describe('MedicalHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza la vista cuando el usuario es paciente', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { role: UserRole.PATIENT },
    } as any);

    render(<MedicalHistoryPage />);

    expect(screen.getByText('Patient Medical History View')).toBeInTheDocument();
  });

  it('no renderiza contenido para otros roles', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { role: UserRole.DOCTOR },
    } as any);

    const { container } = render(<MedicalHistoryPage />);

    expect(screen.queryByText('Patient Medical History View')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
