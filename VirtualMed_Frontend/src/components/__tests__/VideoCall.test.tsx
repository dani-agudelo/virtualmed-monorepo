import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import VideoCall from "../video-session/VideoCall";
import { doctorService } from "@/lib/api/doctor.service";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import { AppointmentStatus } from "@/constants/appointmentStatus";
import { VideoSessionStatus } from "@/constants/videoSessionStatus";
import { isExpiredStatus, isTokenExpiredError } from "@/lib/utils";

vi.mock("@/lib/api/doctor.service", () => ({
	doctorService: {
		getAppointments: vi.fn(),
		getVideoSessionsDetails: vi.fn(),
		getVideoSession: vi.fn(),
		postIceCredentials: vi.fn(),
		postVideoSession: vi.fn(),
		postStartVideoSession: vi.fn(),
	},
}));

vi.mock("@/hooks/use-toast");
vi.mock("@/store/auth.store");
vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("@/lib/utils", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/utils")>();
	return {
		...actual,
		formatDate: vi.fn(() => "fecha"),
		formatDateTime: vi.fn(() => "fecha"),
		getSessionBadgeVariant: vi.fn(() => "secondary" as const),
		getSessionStatusLabel: vi.fn((status: string) => `status:${status}`),
		getStartSessionErrorMessage: vi.fn(() => "start error"),
		getStatusBadgeName: vi.fn((status: string) => `status:${status}`),
		getStatusBadgeVariant: vi.fn(() => "secondary" as const),
		isExpiredStatus: vi.fn(() => false),
		isTokenExpiredError: vi.fn(() => false),
		getPatientName: vi.fn(async (id: string) => `Paciente ${id}`),
	};
});

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

describe("VideoCall", () => {
	const mockToast = vi.fn();
	const mockPush = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();

		const mockedUseToast = useToast as unknown as ReturnType<typeof vi.fn>;
		const mockedUseRouter = useRouter as unknown as ReturnType<typeof vi.fn>;
		const mockedUseAuthStore = useAuthStore as unknown as ReturnType<typeof vi.fn>;

		mockedUseToast.mockReturnValue({ toast: mockToast });
		mockedUseRouter.mockReturnValue({ push: mockPush });
		mockedUseAuthStore.mockReturnValue({
			user: { fullName: "Dr Test", sub: "doctor-1", role: "doctor" },
		} as any);

		vi.mocked(doctorService.getAppointments).mockResolvedValue([]);
		vi.mocked(doctorService.getVideoSessionsDetails).mockResolvedValue([]);
		vi.mocked(doctorService.getVideoSession).mockResolvedValue({} as any);
		vi.mocked(doctorService.postVideoSession).mockResolvedValue({
			sessionId: "session-1",
		} as any);
		vi.mocked(doctorService.postStartVideoSession).mockResolvedValue(undefined);
		vi.mocked(doctorService.postIceCredentials).mockResolvedValue({} as any);
		vi.mocked(isExpiredStatus).mockReturnValue(false);
		vi.mocked(isTokenExpiredError).mockReturnValue(false);
	});

	it("filters confirmed appointments and creates a session", async () => {
		const confirmedAppointment = {
			id: "apt-1",
			patientId: "patient-1",
			doctorId: "doctor-1",
			doctorFullName: "Dr Test",
			patientFullName: "Juan Perez",
			hasClinicalEncounter: false,
			scheduledAt: "2026-05-10T10:00:00.000Z",
			durationMinutes: 30,
			reason: "Control",
			status: AppointmentStatus.CONFIRMED,
			createdAt: "2026-05-01T10:00:00.000Z",
			updatedAt: "2026-05-01T10:00:00.000Z",
		};
		const cancelledAppointment = {
			...confirmedAppointment,
			id: "apt-2",
			patientFullName: "Ana Lopez",
			status: AppointmentStatus.CANCELLED,
		};
		const createdSession = {
			sessionId: "session-1",
			patientId: "patient-1",
			status: VideoSessionStatus.WAITING,
			startedAt: "2026-05-10T10:00:00.000Z",
			endedAt: null,
			tokenExpiresAt: "2026-05-10T10:30:00.000Z",
		};

		vi.mocked(doctorService.getAppointments).mockResolvedValue([
			confirmedAppointment as any,
			cancelledAppointment as any,
		]);
		vi.mocked(doctorService.getVideoSessionsDetails)
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([createdSession as any]);
		vi.mocked(doctorService.getVideoSession).mockResolvedValue(
			createdSession as any
		);
		vi.mocked(doctorService.postVideoSession).mockResolvedValue({
			sessionId: createdSession.sessionId,
		} as any);

		render(<VideoCall />);

		await waitFor(() => {
			expect(doctorService.getAppointments).toHaveBeenCalled();
		});

		const user = userEvent.setup();
		const appointmentTrigger = screen
			.getByText("Selecciona una cita")
			.closest("button");

		expect(appointmentTrigger).not.toBeNull();
		await user.click(appointmentTrigger as HTMLButtonElement);

		expect(await screen.findByText("Juan Perez - fecha")).toBeInTheDocument();
		expect(screen.queryByText("Ana Lopez - fecha")).not.toBeInTheDocument();

		await user.click(screen.getByText("Juan Perez - fecha"));
		await user.click(screen.getByRole("button", { name: "Crear sesion" }));

		await waitFor(() => {
			expect(doctorService.postVideoSession).toHaveBeenCalledWith({
				appointmentId: confirmedAppointment.id,
			});
		});

		expect(mockToast).toHaveBeenCalledWith(
			expect.objectContaining({ title: "Sesion creada" })
		);
		await waitFor(() => {
			expect(doctorService.getVideoSessionsDetails).toHaveBeenCalledTimes(2);
		});
	});

	it("starts a session and navigates", async () => {
		const session = {
			sessionId: "session-2",
			patientId: "patient-2",
			status: VideoSessionStatus.WAITING,
			startedAt: "2026-05-10T10:00:00.000Z",
			endedAt: null,
			tokenExpiresAt: "2026-05-10T10:30:00.000Z",
		};

		vi.mocked(doctorService.getVideoSessionsDetails).mockResolvedValue([
			session as any,
		]);
		vi.mocked(doctorService.getVideoSession).mockResolvedValue(
			session as any
		);

		render(<VideoCall />);

		await waitFor(() => {
			expect(doctorService.getVideoSession).toHaveBeenCalledWith(
				session.sessionId
			);
		});

		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Iniciar" }));

		expect(doctorService.postStartVideoSession).toHaveBeenCalledWith(
			session.sessionId
		);
		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				`/dashboard/video-session/${session.sessionId}?role=doctor`
			);
		});
	});

	it("prevents starting a session that already ended", async () => {
		const endedSession = {
			sessionId: "session-3",
			patientId: "patient-3",
			status: VideoSessionStatus.ENDED,
			startedAt: "2026-05-10T10:00:00.000Z",
			endedAt: "2026-05-10T10:30:00.000Z",
			tokenExpiresAt: "2026-05-10T10:30:00.000Z",
		};

		vi.mocked(doctorService.getVideoSessionsDetails).mockResolvedValue([
			endedSession as any,
		]);
		vi.mocked(doctorService.getVideoSession).mockResolvedValue(
			endedSession as any
		);

		render(<VideoCall />);

		await waitFor(() => {
			expect(doctorService.getVideoSession).toHaveBeenCalledWith(
				endedSession.sessionId
			);
		});

		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Iniciar" }));

		expect(mockToast).toHaveBeenCalledWith(
			expect.objectContaining({ title: "Sesion finalizada" })
		);
		expect(doctorService.postStartVideoSession).not.toHaveBeenCalled();
	});

	it("reloads sessions when include-ended is toggled", async () => {
		vi.mocked(doctorService.getVideoSessionsDetails).mockResolvedValue([]);

		render(<VideoCall />);

		await waitFor(() => {
			expect(doctorService.getVideoSessionsDetails).toHaveBeenCalledWith({
				includeEnded: false,
			});
		});

		const user = userEvent.setup();
		await user.click(screen.getByRole("checkbox"));

		await waitFor(() => {
			expect(doctorService.getVideoSessionsDetails).toHaveBeenLastCalledWith({
				includeEnded: true,
			});
		});
	});

	it("shows error toast when loading appointments fails", async () => {
		vi.mocked(doctorService.getAppointments).mockRejectedValue(
			new Error("fail")
		);

		render(<VideoCall />);

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith(
				expect.objectContaining({ title: "Error" })
			);
		});
	});

	it("shows error toast when loading sessions fails", async () => {
		vi.mocked(doctorService.getVideoSessionsDetails).mockRejectedValue(
			new Error("fail")
		);

		render(<VideoCall />);

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith(
				expect.objectContaining({ title: "Error" })
			);
		});
	});

	it("refreshes ICE credentials when session is expired", async () => {
		const expiredSession = {
			sessionId: "session-exp",
			patientId: "patient-1",
			status: "Expired",
			startedAt: "2026-05-10T10:00:00.000Z",
			endedAt: null,
			tokenExpiresAt: "2026-05-10T10:30:00.000Z",
		};
		const refreshedSession = {
			...expiredSession,
			status: VideoSessionStatus.ACTIVE,
		};

		vi.mocked(isExpiredStatus).mockReturnValue(true);
		vi.mocked(doctorService.getVideoSessionsDetails).mockResolvedValue([
			expiredSession as any,
		]);
		vi.mocked(doctorService.getVideoSession)
			.mockResolvedValueOnce(expiredSession as any)
			.mockResolvedValueOnce(refreshedSession as any);

		render(<VideoCall />);

		await waitFor(() => {
			expect(doctorService.postIceCredentials).toHaveBeenCalledWith(
				expiredSession.sessionId
			);
		});
		expect(doctorService.getVideoSession).toHaveBeenCalledTimes(2);
	});

	it("shows error when ICE refresh fails", async () => {
		const expiredSession = {
			sessionId: "session-exp-2",
			patientId: "patient-1",
			status: "Expired",
			startedAt: "2026-05-10T10:00:00.000Z",
			endedAt: null,
			tokenExpiresAt: "2026-05-10T10:30:00.000Z",
		};

		vi.mocked(isExpiredStatus).mockReturnValue(true);
		vi.mocked(doctorService.getVideoSessionsDetails).mockResolvedValue([
			expiredSession as any,
		]);
		vi.mocked(doctorService.getVideoSession).mockResolvedValue(
			expiredSession as any
		);
		vi.mocked(doctorService.postIceCredentials).mockRejectedValue(
			new Error("fail")
		);

		render(<VideoCall />);

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith(
				expect.objectContaining({ title: "Error" })
			);
		});
		expect(doctorService.getVideoSession).toHaveBeenCalledTimes(1);
	});

	it("shows error when creating session fails", async () => {
		const confirmedAppointment = {
			id: "apt-1",
			patientId: "patient-1",
			doctorId: "doctor-1",
			doctorFullName: "Dr Test",
			patientFullName: "Juan Perez",
			hasClinicalEncounter: false,
			scheduledAt: "2026-05-10T10:00:00.000Z",
			durationMinutes: 30,
			reason: "Control",
			status: AppointmentStatus.CONFIRMED,
			createdAt: "2026-05-01T10:00:00.000Z",
			updatedAt: "2026-05-01T10:00:00.000Z",
		};

		vi.mocked(doctorService.getAppointments).mockResolvedValue([
			confirmedAppointment as any,
		]);
		vi.mocked(doctorService.postVideoSession).mockRejectedValue({
			isAxiosError: true,
			response: { status: 403 },
		});

		render(<VideoCall />);

		const user = userEvent.setup();
		const appointmentTrigger = screen
			.getByText("Selecciona una cita")
			.closest("button");
		await user.click(appointmentTrigger as HTMLButtonElement);
		await user.click(await screen.findByText("Juan Perez - fecha"));

		await user.click(screen.getByRole("button", { name: "Crear sesion" }));

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith(
				expect.objectContaining({ title: "Error" })
			);
		});
	});

	it("retries start session when token expired", async () => {
		const session = {
			sessionId: "session-4",
			patientId: "patient-4",
			status: VideoSessionStatus.WAITING,
			startedAt: "2026-05-10T10:00:00.000Z",
			endedAt: null,
			tokenExpiresAt: "2026-05-10T10:30:00.000Z",
		};

		vi.mocked(isTokenExpiredError).mockReturnValue(true);
		vi.mocked(doctorService.getVideoSessionsDetails).mockResolvedValue([
			session as any,
		]);
		vi.mocked(doctorService.getVideoSession).mockResolvedValue(
			session as any
		);
		vi.mocked(doctorService.postStartVideoSession)
			.mockRejectedValueOnce(new Error("expired"))
			.mockResolvedValueOnce(undefined);

		render(<VideoCall />);

		await waitFor(() => {
			expect(doctorService.getVideoSession).toHaveBeenCalledWith(
				session.sessionId
			);
		});

		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Iniciar" }));

		await waitFor(() => {
			expect(doctorService.postIceCredentials).toHaveBeenCalledWith(
				session.sessionId
			);
		});
		expect(doctorService.postStartVideoSession).toHaveBeenCalledTimes(2);
		expect(mockPush).toHaveBeenCalledWith(
			`/dashboard/video-session/${session.sessionId}?role=doctor`
		);
	});

	it("shows start session error when request fails", async () => {
		const session = {
			sessionId: "session-5",
			patientId: "patient-5",
			status: VideoSessionStatus.WAITING,
			startedAt: "2026-05-10T10:00:00.000Z",
			endedAt: null,
			tokenExpiresAt: "2026-05-10T10:30:00.000Z",
		};

		vi.mocked(isTokenExpiredError).mockReturnValue(false);
		vi.mocked(doctorService.getVideoSessionsDetails).mockResolvedValue([
			session as any,
		]);
		vi.mocked(doctorService.getVideoSession).mockResolvedValue(
			session as any
		);
		vi.mocked(doctorService.postStartVideoSession).mockRejectedValue(
			new Error("fail")
		);

		render(<VideoCall />);

		await waitFor(() => {
			expect(doctorService.getVideoSession).toHaveBeenCalledWith(
				session.sessionId
			);
		});

		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Iniciar" }));

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith(
				expect.objectContaining({ title: "Error", description: "start error" })
			);
		});
	});
});
