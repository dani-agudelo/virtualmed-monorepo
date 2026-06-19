import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DoctorPatientsPage from '@/app/dashboard/doctor/patients/page';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/constants/userRole';

vi.mock('@/store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/components/dashboard/doctor/doctor-patients-view', () => ({
  DoctorPatientsView: () => <div>Doctor Patients View</div>,
}));

describe('DoctorPatientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza la vista cuando el usuario es doctor', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { role: UserRole.DOCTOR },
    } as any);

    render(<DoctorPatientsPage />);

    expect(screen.getByText('Doctor Patients View')).toBeInTheDocument();
  });

  it('no renderiza la vista cuando el usuario no es doctor', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { role: UserRole.ADMIN },
    } as any);

    const { container } = render(<DoctorPatientsPage />);

    expect(screen.queryByText('Doctor Patients View')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza la vista cuando aun no hay usuario hidratado', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: null,
    } as any);

    render(<DoctorPatientsPage />);

    expect(screen.getByText('Doctor Patients View')).toBeInTheDocument();
  });
});
