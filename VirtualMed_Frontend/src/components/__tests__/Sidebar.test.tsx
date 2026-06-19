import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from '@/components/dashboard/sidebar';
import { useAuthStore } from '@/store/auth.store';
import { usePathname, useRouter } from 'next/navigation';
import { UserRole } from '@/constants/userRole';
import { UserStatus } from '@/constants/userStatus';

vi.mock('@/store/auth.store', () => ({
	useAuthStore: vi.fn(),
}));

vi.mock('next/navigation', () => ({
	useRouter: vi.fn(),
	usePathname: vi.fn(),
}));

describe('Sidebar', () => {
	const mockPush = vi.fn();

	const buildUser = (role: UserRole, permission: string[]) => ({
		sub: 'user-1',
		email: 'user@test.com',
		role,
		fullname: 'Test User',
		status: UserStatus.ACTIVE,
		email_verified: true,
		two_factor_enabled: false,
		permission,
	});

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any);
		vi.mocked(usePathname).mockReturnValue('/dashboard/doctor');
	});

	it('no renderiza contenido mientras no haya hidratado', () => {
		vi.mocked(useAuthStore).mockReturnValue({
			user: null,
			_hasHydrated: false,
		} as any);

		const { container } = render(<Sidebar />);

		expect(container.firstChild).toBeNull();
		expect(mockPush).not.toHaveBeenCalled();
	});

	it('redirige a login si ya hidrató y no hay usuario', async () => {
		vi.mocked(useAuthStore).mockReturnValue({
			user: null,
			_hasHydrated: true,
		} as any);

		render(<Sidebar />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith('/login');
		});
	});

	it('muestra grupo de Citas para doctor y permite expandir subopciones', async () => {
		const user = userEvent.setup();

		vi.mocked(useAuthStore).mockReturnValue({
			user: buildUser(UserRole.DOCTOR, ['Appointment:Read', 'Appointment:Create', 'ClinicalEncounter:Read']),
			_hasHydrated: true,
		} as any);

		render(<Sidebar />);

		const appointmentsButton = screen.getByRole('button', { name: /citas/i });
		expect(appointmentsButton).toHaveAttribute('aria-expanded', 'false');

		await user.click(appointmentsButton);

		expect(appointmentsButton).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByRole('link', { name: /listar citas/i })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /crear cita/i })).toBeInTheDocument();
	});

	it('filtra subitems por permisos y oculta Crear cita si no tiene permiso', async () => {
		const user = userEvent.setup();

		vi.mocked(useAuthStore).mockReturnValue({
			user: buildUser(UserRole.DOCTOR, ['Appointment:Read', 'ClinicalEncounter:Read']),
			_hasHydrated: true,
		} as any);

		render(<Sidebar />);

		await user.click(screen.getByRole('button', { name: /citas/i }));

		expect(screen.getByRole('link', { name: /listar citas/i })).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: /crear cita/i })).not.toBeInTheDocument();
	});

	it('expande automáticamente el grupo activo según la ruta actual', async () => {
		vi.mocked(usePathname).mockReturnValue('/dashboard/doctor/appointments/list');
		vi.mocked(useAuthStore).mockReturnValue({
			user: buildUser(UserRole.DOCTOR, ['Appointment:Read', 'ClinicalEncounter:Read']),
			_hasHydrated: true,
		} as any);

		render(<Sidebar />);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /citas/i })).toHaveAttribute('aria-expanded', 'true');
		});
	});

	it('muestra navegación de admin y mantiene Configuración visible', async () => {
		const user = userEvent.setup();

		vi.mocked(useAuthStore).mockReturnValue({
			user: buildUser(UserRole.ADMIN, ['Appointment:Read']),
			_hasHydrated: true,
		} as any);

		render(<Sidebar />);

		expect(screen.getByRole('link', { name: /logs auditoría/i })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /configuración/i })).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /citas/i }));

		expect(screen.getByRole('link', { name: /listar citas/i })).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: /crear cita/i })).not.toBeInTheDocument();
	});
});
