import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from '@/components/dashboard/header';
import { useAuthStore } from '@/store/auth.store';
import { vitalSignService } from '@/lib/api/vital-sign.service';
import { UserRole } from '@/constants/userRole';

vi.mock('@/store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/api/vital-sign.service', () => ({
  vitalSignService: {
    getMyAlerts: vi.fn(),
    markAlertAsRead: vi.fn(),
  },
}));

function renderHeader() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Header />
    </QueryClientProvider>
  );
}

describe('Header alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no consulta alertas cuando el usuario es doctor aunque tenga permiso', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: {
        role: UserRole.DOCTOR,
        permission: ['Alert:Read'],
        fullName: 'Dr. House',
        email: 'doctor@example.com',
        status: 'Active',
      },
    } as any);

    renderHeader();

    expect(vitalSignService.getMyAlerts).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /notificaciones/i })).not.toBeInTheDocument();
  });
});