"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	HubConnection,
	HubConnectionBuilder,
	HubConnectionState,
} from "@microsoft/signalr";
import { getCookie } from "@/lib/auth-utils";

type ConnectionStatus =
	| "connected"
	| "connecting"
	| "reconnecting"
	| "disconnected";

type OfferPayload = {
	sessionId: string;
	fromConnectionId?: string;
	sdp: RTCSessionDescriptionInit;
};

type AnswerPayload = {
	sessionId: string;
	fromConnectionId?: string;
	sdp: RTCSessionDescriptionInit;
};

type IceCandidatePayload = {
	sessionId: string;
	fromConnectionId?: string;
	candidate: RTCIceCandidateInit;
};

type MessagePayload = {
	id: string;
	sessionId: string;
	senderId: string;
	message: string;
	sentAt: string;
	messageType?: number | string;
};

type JoinedRoomPayload = {
	sessionId: string;
};

type ParticipantJoinedPayload = {
  sessionId: string;
  userId: string;
  connectionId: string;
};

type ParticipantLeftPayload = {
	sessionId: string;
	userId: string;
	connectionId: string;
};

type CallEndedPayload = {
	sessionId: string;
	endReason?: string;
};

type Callback<T> = ((payload: T) => void) | null;

const mapStatus = (state: HubConnectionState): ConnectionStatus => {
	switch (state) {
		case HubConnectionState.Connected:
			return "connected";
		case HubConnectionState.Connecting:
			return "connecting";
		case HubConnectionState.Reconnecting:
			return "reconnecting";
		default:
			return "disconnected";
	}
};

export function useSignalR(sessionId: string) {
	const connectionRef = useRef<HubConnection | null>(null);
	const [status, setStatus] = useState<ConnectionStatus>("disconnected");
	const [isJoined, setIsJoined] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const offerHandlerRef = useRef<Callback<OfferPayload>>(null);
	const answerHandlerRef = useRef<Callback<AnswerPayload>>(null);
	const iceHandlerRef = useRef<Callback<IceCandidatePayload>>(null);
	const messageHandlerRef = useRef<Callback<MessagePayload>>(null);
	const joinedHandlerRef = useRef<Callback<JoinedRoomPayload>>(null);
	const participantJoinedHandlerRef = useRef<Callback<ParticipantJoinedPayload>>(null);
	const participantLeftHandlerRef = useRef<Callback<ParticipantLeftPayload>>(null);
	const callEndedHandlerRef = useRef<Callback<CallEndedPayload>>(null);

	const onOffer = useCallback((handler: Callback<OfferPayload>) => {
		offerHandlerRef.current = handler;
	}, []);

	const onAnswer = useCallback((handler: Callback<AnswerPayload>) => {
		answerHandlerRef.current = handler;
	}, []);

	const onIceCandidate = useCallback((handler: Callback<IceCandidatePayload>) => {
		iceHandlerRef.current = handler;
	}, []);

	const onMessageReceived = useCallback((handler: Callback<MessagePayload>) => {
		messageHandlerRef.current = handler;
	}, []);

	const onJoinedRoom = useCallback((handler: Callback<JoinedRoomPayload>) => {
		joinedHandlerRef.current = handler;
	}, []);

	const onParticipantJoined = useCallback((handler: Callback<ParticipantJoinedPayload>) => {
		participantJoinedHandlerRef.current = handler;
	}, []);

	const onParticipantLeft = useCallback((handler: Callback<ParticipantLeftPayload>) => {
		participantLeftHandlerRef.current = handler;
	}, []);

	const onCallEnded = useCallback((handler: Callback<CallEndedPayload>) => {
		callEndedHandlerRef.current = handler;
	}, []);

	const sendOffer = useCallback(async (targetSessionId: string, sdp: RTCSessionDescriptionInit) => {
		const connection = connectionRef.current;
		if (!connection || connection.state !== HubConnectionState.Connected) return;
		await connection.invoke("SendOffer", targetSessionId, sdp);
	}, []);

	const sendAnswer = useCallback(async (targetSessionId: string, sdp: RTCSessionDescriptionInit) => {
		const connection = connectionRef.current;
		if (!connection || connection.state !== HubConnectionState.Connected) return;
		await connection.invoke("SendAnswer", targetSessionId, sdp);
	}, []);

	const sendIceCandidate = useCallback(
		async (targetSessionId: string, candidate: RTCIceCandidateInit) => {
			const connection = connectionRef.current;
			if (!connection || connection.state !== HubConnectionState.Connected) return;
			await connection.invoke("SendIceCandidate", targetSessionId, candidate);
		},
		[]
	);

	const sendMessage = useCallback(
		async (targetSessionId: string, message: string, messageType?: number) => {
			const connection = connectionRef.current;
			if (!connection || connection.state !== HubConnectionState.Connected) return;
			await connection.invoke(
				"SendMessage",
				targetSessionId,
				message,
				typeof messageType === "number" ? messageType : undefined
			);
		},
		[]
	);

	const leaveRoom = useCallback(async () => {
		const connection = connectionRef.current;
		if (!connection || connection.state !== HubConnectionState.Connected) return;
		await connection.invoke("LeaveRoom", sessionId);
		setIsJoined(false);
	}, [sessionId]);

	const rejoinRoom = useCallback(async () => {
		const connection = connectionRef.current;
		if (!connection || connection.state !== HubConnectionState.Connected) return;
		try {
			await connection.invoke("LeaveRoom", sessionId);
		} catch {
			// noop — podría no estar en la sala
		}
		await connection.invoke("JoinRoom", sessionId);
		setIsJoined(true);
		setError(null);
		}, [sessionId]);

	useEffect(() => {
		if (!sessionId) return undefined;

		let cancelled = false;

		const connection = new HubConnectionBuilder()
			.withUrl("http://localhost:5045/hubs/video-chat",
				{
					accessTokenFactory: () => {
						const token = getCookie('token');
						return token ?? "";
					},
					withCredentials: false,
				}
			)

			.withAutomaticReconnect()
			.build();

		connectionRef.current = connection;

		connection.on("offer", (payload: OfferPayload) => {
			offerHandlerRef.current?.(payload);
		});
		connection.on("answer", (payload: AnswerPayload) => {
			answerHandlerRef.current?.(payload);
		});
		connection.on("iceCandidate", (payload: IceCandidatePayload) => {
			iceHandlerRef.current?.(payload);
		});
		connection.on("messageReceived", (payload: MessagePayload) => {
			messageHandlerRef.current?.(payload);
		});
		connection.on("joinedRoom", (payload: JoinedRoomPayload) => {
			setIsJoined(true);
			setError(null);
			joinedHandlerRef.current?.(payload);
		});
		connection.on("participantJoined", (payload: ParticipantJoinedPayload) => {
			participantJoinedHandlerRef.current?.(payload);
		});
		connection.on("participantLeft", (payload: ParticipantLeftPayload) => {
			participantLeftHandlerRef.current?.(payload);
		});
		connection.on("callEnded", (payload: CallEndedPayload) => {
			callEndedHandlerRef.current?.(payload);
		});

		connection.onreconnecting(() => {
			setStatus(mapStatus(connection.state));
		});

		connection.onreconnected(async () => {
			setStatus(mapStatus(connection.state));
			try {
				await connection.invoke("JoinRoom", sessionId);
				setIsJoined(true);
				setError(null);
			} catch (err) {
				setError("No fue posible reconectar al chat.");
			}
		});

		connection.onclose(() => {
			setStatus(mapStatus(connection.state));
			setIsJoined(false);
		});

		const startConnection = async () => {
			try {
				setError(null);
				setStatus("connecting");
				await connection.start();

				if (cancelled) {
					await connection.stop();
					return;
				}

				setStatus(mapStatus(connection.state));
				try {
					await connection.invoke("JoinRoom", sessionId);
					setIsJoined(true);
					setError(null);
				} catch {
					if (!cancelled) {
						setError("No fue posible unir la sala de chat.");
					}
				}
			} catch (err) {
				if (!cancelled) {
					const msg = err instanceof Error ? err.message : "";
					if (!msg.includes("stopped during negotiation")) {
						setError("No se pudo conectar al chat en tiempo real.");
					}
					setStatus(mapStatus(connection.state));
				}
			}
		};

		startConnection();

		return () => {
			cancelled = true;
			const teardown = async () => {
				try {
					if (connection.state === HubConnectionState.Connected) {
						await connection.invoke("LeaveRoom", sessionId);
					}
				} catch {
					// noop
				}
				await connection.stop();
			};

			teardown();
		};
	}, [sessionId]);

	return useMemo(
		() => ({
			status,
			isConnected: status === "connected",
			isJoined,
			error,
			sendOffer,
			sendAnswer,
			sendIceCandidate,
			sendMessage,
			onOffer,
			onAnswer,
			onIceCandidate,
			onMessageReceived,
			onJoinedRoom,
			onParticipantJoined,
			onParticipantLeft,
			onCallEnded,
			leaveRoom,
			rejoinRoom
		}),
		[
			status,
			isJoined,
			error,
			sendOffer,
			sendAnswer,
			sendIceCandidate,
			sendMessage,
			onOffer,
			onAnswer,
			onIceCandidate,
			onMessageReceived,
			onJoinedRoom,
			onParticipantJoined,
			onParticipantLeft,
			onCallEnded,
			leaveRoom,
			rejoinRoom
		]
	);
}
