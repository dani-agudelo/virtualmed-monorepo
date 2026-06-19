import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useToast } from "@/hooks/use-toast";
import { useIceCredentials } from "@/hooks/useIceCredentials";
import { useSignalR } from "@/hooks/useSignalR";
import { useVideoSession } from "@/hooks/useVideoSession";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";

import { VideoCallRoom } from "../video-session/VideoCallRoom";

vi.mock("@/hooks/use-toast");
vi.mock("@/hooks/useIceCredentials");
vi.mock("@/hooks/useSignalR");
vi.mock("@/hooks/useVideoSession");
vi.mock("@/hooks/useWebRTC");
vi.mock("@/store/auth.store", () => ({ useAuthStore: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));

const sessionId = "session-123";

let messageHandler: ((payload: any) => void) | null = null;
let callEndedHandler: ((payload: any) => void) | null = null;

const buildRemoteStream = () =>
	({
		getVideoTracks: () => [{ enabled: true, readyState: "live" }],
	} as unknown as MediaStream);

const buildSignalRMock = (overrides: Record<string, unknown> = {}) => {
	messageHandler = null;
	callEndedHandler = null;

	return {
		status: "connected",
		isConnected: true,
		isJoined: true,
		error: null,
		sendMessage: vi.fn().mockResolvedValue(undefined),
		leaveRoom: vi.fn().mockResolvedValue(undefined),
		rejoinRoom: vi.fn().mockResolvedValue(undefined),
		onMessageReceived: vi.fn((handler) => {
			messageHandler = handler;
		}),
		onParticipantLeft: vi.fn(),
		onParticipantJoined: vi.fn(),
		onCallEnded: vi.fn((handler) => {
			callEndedHandler = handler;
		}),
		...overrides,
	};
};

const buildIceMock = (overrides: Record<string, unknown> = {}) => ({
	iceServers: [],
	isLoading: false,
	error: null,
	refresh: vi.fn().mockResolvedValue(null),
	...overrides,
});

const buildVideoSessionMock = (overrides: Record<string, unknown> = {}) => ({
	chatHistory: [],
	chatError: null,
	endSession: vi.fn().mockResolvedValue(null),
	...overrides,
});

const buildWebRtcMock = (overrides: Record<string, unknown> = {}) => ({
	localStream: null,
	remoteStream: null,
	connectionState: "new",
	mediaError: null,
	closeConnection: vi.fn(),
	...overrides,
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

	Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
		configurable: true,
		get() {
			return null;
		},
		set() {
			// noop
		},
	});
});

describe("VideoCallRoom", () => {
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
			user: { fullName: "Test User", sub: "user-1" },
		} as any);

		vi.mocked(useIceCredentials).mockReturnValue(buildIceMock() as any);
		vi.mocked(useSignalR).mockReturnValue(buildSignalRMock() as any);
		vi.mocked(useVideoSession).mockReturnValue(buildVideoSessionMock() as any);
		vi.mocked(useWebRTC).mockReturnValue(buildWebRtcMock() as any);
	});

	it("renders active status and session header", () => {
		vi.mocked(useWebRTC).mockReturnValue(
			buildWebRtcMock({ connectionState: "connected" }) as any
		);

		render(<VideoCallRoom sessionId={sessionId} role="doctor" />);

		expect(screen.getByText("Sesion de videollamada")).toBeInTheDocument();
		expect(screen.getByText(`ID de sesion: ${sessionId}`)).toBeInTheDocument();
		expect(screen.getByText("Estado: Activa")).toBeInTheDocument();
		expect(screen.getAllByText("SignalR Conectado").length).toBeGreaterThan(0);
	});

	it("sends a chat message and resolves on realtime echo", async () => {
		const signalRMock = buildSignalRMock();
		vi.mocked(useSignalR).mockReturnValue(signalRMock as any);
		vi.mocked(useWebRTC).mockReturnValue(
			buildWebRtcMock({ connectionState: "connected" }) as any
		);

		render(<VideoCallRoom sessionId={sessionId} role="doctor" />);

		const user = userEvent.setup();
		await user.type(screen.getByPlaceholderText("Escribe un mensaje"), "Hola");
		await user.click(screen.getByRole("button", { name: "Enviar" }));

		expect(signalRMock.sendMessage).toHaveBeenCalledWith(sessionId, "Hola", 0);
		expect(await screen.findByText("Hola")).toBeInTheDocument();
		expect(screen.getByText("Enviando...")).toBeInTheDocument();

		await waitFor(() => expect(messageHandler).not.toBeNull());
		act(() => {
			messageHandler?.({
				id: "msg-1",
				sessionId,
				senderId: "user-1",
				message: "Hola",
				sentAt: new Date().toISOString(),
				messageType: 0,
			});
		});

		await waitFor(() => {
			expect(screen.queryByText("Enviando...")).not.toBeInTheDocument();
		});
	});

	it("shows reconnecting alert when signalR reconnects", () => {
		vi.mocked(useSignalR).mockReturnValue(
			buildSignalRMock({ status: "reconnecting" }) as any
		);

		render(<VideoCallRoom sessionId={sessionId} role="doctor" />);

		expect(
			screen.getByText(
				"Intentando restablecer la conexion de audio y video."
			)
		).toBeInTheDocument();
	});

	it("shows toast when chat is disconnected", async () => {
		const signalRMock = buildSignalRMock({
			isConnected: false,
			status: "disconnected",
		});
		vi.mocked(useSignalR).mockReturnValue(signalRMock as any);
		vi.mocked(useWebRTC).mockReturnValue(
			buildWebRtcMock({ connectionState: "connected" }) as any
		);

		render(<VideoCallRoom sessionId={sessionId} role="doctor" />);

		const user = userEvent.setup();
		await user.type(screen.getByPlaceholderText("Escribe un mensaje"), "Hola");
		await user.click(screen.getByRole("button", { name: "Enviar" }));

		expect(mockToast).toHaveBeenCalledWith(
			expect.objectContaining({ title: "Chat desconectado" })
		);
		expect(signalRMock.sendMessage).not.toHaveBeenCalled();
	});

	it("shows call ended notice for patients and allows return", async () => {
		const signalRMock = buildSignalRMock();
		const webRtcMock = buildWebRtcMock({ connectionState: "connected" });

		vi.mocked(useSignalR).mockReturnValue(signalRMock as any);
		vi.mocked(useWebRTC).mockReturnValue(webRtcMock as any);

		render(<VideoCallRoom sessionId={sessionId} role="patient" />);

		await waitFor(() => expect(callEndedHandler).not.toBeNull());
		act(() => {
			callEndedHandler?.({ sessionId, endReason: "Cerrado" });
		});

		expect(
			await screen.findByText("El doctor finalizo la llamada")
		).toBeInTheDocument();
		expect(webRtcMock.closeConnection).toHaveBeenCalled();

		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Ir al inicio" }));

		await waitFor(() => {
			expect(signalRMock.leaveRoom).toHaveBeenCalled();
			expect(mockPush).toHaveBeenCalledWith("/dashboard");
		});
	});

	it("shows SignalR error toast", async () => {
		vi.mocked(useSignalR).mockReturnValue(
			buildSignalRMock({ error: "boom" }) as any
		);

		render(<VideoCallRoom sessionId={sessionId} role="doctor" />);

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith(
				expect.objectContaining({ title: "SignalR", description: "boom" })
			);
		});
	});

	it("shows chat error toast", async () => {
		vi.mocked(useVideoSession).mockReturnValue(
			buildVideoSessionMock({ chatError: "chat down" }) as any
		);

		render(<VideoCallRoom sessionId={sessionId} role="doctor" />);

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith(
				expect.objectContaining({ title: "Chat", description: "chat down" })
			);
		});
	});

	it("shows ICE error toast", async () => {
		vi.mocked(useIceCredentials).mockReturnValue(
			buildIceMock({ error: "ice fail" }) as any
		);

		render(<VideoCallRoom sessionId={sessionId} role="doctor" />);

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith(
				expect.objectContaining({
					title: "Credenciales ICE",
					description: "ice fail",
				})
			);
		});
	});

	it("shows media error toast", async () => {
		vi.mocked(useWebRTC).mockReturnValue(
			buildWebRtcMock({ mediaError: "no camera" }) as any
		);

		render(<VideoCallRoom sessionId={sessionId} role="doctor" />);

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith(
				expect.objectContaining({
					title: "Cámara no disponible",
					description: "no camera",
				})
			);
		});
	});

	it("retries connection when clicking reconnect", async () => {
		const signalRMock = buildSignalRMock({ isConnected: true });
		const iceMock = buildIceMock();

		vi.mocked(useSignalR).mockReturnValue(signalRMock as any);
		vi.mocked(useIceCredentials).mockReturnValue(iceMock as any);
		vi.mocked(useWebRTC).mockReturnValue(
			buildWebRtcMock({ connectionState: "failed" }) as any
		);

		render(<VideoCallRoom sessionId={sessionId} role="patient" />);

		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Reintentar" }));

		await waitFor(() => {
			expect(iceMock.refresh).toHaveBeenCalled();
			expect(signalRMock.rejoinRoom).toHaveBeenCalled();
		});
	});

	it("doctor can end the session", async () => {
		const signalRMock = buildSignalRMock();
		const sessionMock = buildVideoSessionMock();
		const webRtcMock = buildWebRtcMock();

		vi.mocked(useSignalR).mockReturnValue(signalRMock as any);
		vi.mocked(useVideoSession).mockReturnValue(sessionMock as any);
		vi.mocked(useWebRTC).mockReturnValue(webRtcMock as any);

		render(<VideoCallRoom sessionId={sessionId} role="doctor" />);

		const user = userEvent.setup();
		await user.click(screen.getAllByRole("button", { name: "Finalizar" })[0]);
		const confirmButtons = await screen.findAllByRole("button", {
			name: "Finalizar sesion",
			hidden: true,
		});
		fireEvent.click(confirmButtons[0]);

		await waitFor(() => {
			expect(signalRMock.leaveRoom).toHaveBeenCalled();
			expect(sessionMock.endSession).toHaveBeenCalled();
			expect(webRtcMock.closeConnection).toHaveBeenCalled();
			expect(mockPush).toHaveBeenCalledWith("/dashboard");
		});
	});

	it("patient can leave the session", async () => {
		const signalRMock = buildSignalRMock();
		const webRtcMock = buildWebRtcMock();

		vi.mocked(useSignalR).mockReturnValue(signalRMock as any);
		vi.mocked(useWebRTC).mockReturnValue(webRtcMock as any);

		render(<VideoCallRoom sessionId={sessionId} role="patient" />);

		const user = userEvent.setup();
		await user.click(screen.getAllByRole("button", { name: "Salir" })[0]);
		const confirmButtons = await screen.findAllByRole("button", {
			name: "Salir de la llamada",
			hidden: true,
		});
		fireEvent.click(confirmButtons[0]);

		await waitFor(() => {
			expect(signalRMock.leaveRoom).toHaveBeenCalled();
			expect(webRtcMock.closeConnection).toHaveBeenCalled();
			expect(mockPush).toHaveBeenCalledWith(
				`/dashboard/video-session/${sessionId}/out`
			);
		});
	});

	it("shows toast when participant connects and disconnects", async () => {
		let remoteStream: MediaStream | null = null;
		vi.mocked(useWebRTC).mockImplementation(
			() => buildWebRtcMock({ remoteStream }) as any
		);

		const { rerender } = render(
			<VideoCallRoom sessionId={sessionId} role="doctor" />
		);

		remoteStream = buildRemoteStream();
		rerender(<VideoCallRoom sessionId={sessionId} role="doctor" />);

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith(
				expect.objectContaining({ title: "Participante conectado" })
			);
		});

		remoteStream = null;
		rerender(<VideoCallRoom sessionId={sessionId} role="doctor" />);

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith(
				expect.objectContaining({ title: "Participante desconectado" })
			);
		});
	});

	it("shows error toast when sending message fails", async () => {
		const signalRMock = buildSignalRMock({
			sendMessage: vi.fn().mockRejectedValue(new Error("fail")),
		});
		vi.mocked(useSignalR).mockReturnValue(signalRMock as any);
		vi.mocked(useWebRTC).mockReturnValue(
			buildWebRtcMock({ connectionState: "connected" }) as any
		);

		render(<VideoCallRoom sessionId={sessionId} role="doctor" />);

		const user = userEvent.setup();
		const input = screen.getByPlaceholderText("Escribe un mensaje");
		await user.type(input, "Hola");
		await user.click(screen.getAllByRole("button", { name: "Enviar" })[0]);

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith(
				expect.objectContaining({ title: "Error" })
			);
		});
		expect(input).toHaveValue("Hola");
	});
});
