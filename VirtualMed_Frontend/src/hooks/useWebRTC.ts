"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type WebRtcRole = "doctor" | "patient";

type SignalRClient = {
	isConnected: boolean;
	isJoined: boolean;
	sendOffer: (sessionId: string, sdp: RTCSessionDescriptionInit) => Promise<void>;
	sendAnswer: (sessionId: string, sdp: RTCSessionDescriptionInit) => Promise<void>;
	sendIceCandidate: (
		sessionId: string,
		candidate: RTCIceCandidateInit
	) => Promise<void>;
	onOffer: (handler: ((payload: { sdp: RTCSessionDescriptionInit }) => void) | null) => void;
	onAnswer: (handler: ((payload: { sdp: RTCSessionDescriptionInit }) => void) | null) => void;
	onIceCandidate: (
		handler: ((payload: { candidate: RTCIceCandidateInit }) => void) | null
	) => void;
	onJoinedRoom: (handler: ((payload: { sessionId: string }) => void) | null) => void;
	onParticipantJoined: (
		handler: ((payload: { sessionId: string; userId: string; connectionId: string }) => void) | null
	) => void;
};

export function useWebRTC(
	sessionId: string,
	iceServers: RTCIceServer[],
	role: WebRtcRole,
	signalR: SignalRClient | null,
	resetKey: number = 0,
) {
	const peerRef = useRef<RTCPeerConnection | null>(null);
	const signalRRef = useRef<SignalRClient | null>(null);
	const localStreamRef = useRef<MediaStream | null>(null);
	const [localStream, setLocalStream] = useState<MediaStream | null>(null);
	const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
	const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
	const [mediaError, setMediaError] = useState<string | null>(null);
	const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
	const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
	const offerSentRef = useRef(false);
	const answerReceivedRef = useRef(false);

	const stopStreamTracks = (stream: MediaStream | null) => {
		stream?.getTracks().forEach((track) => track.stop());
	};

	const sendOffer = useCallback(async (force = false) => {
		const peer = peerRef.current;
		const sr = signalRRef.current;
		if (!peer || !sr || role !== "doctor") return;
		if (peer.connectionState === "connected" && answerReceivedRef.current) return;
		if (!force && offerSentRef.current) return;

		try {
			// Si hay una offer anterior sin respuesta (nadie estaba en la sala),
			// revertimos al estado "stable" para poder crear una nueva.
			if (peer.signalingState === "have-local-offer") {
				await peer.setLocalDescription({ type: "rollback" });
			}

			if (peer.signalingState !== "stable") return;

			const offer = await peer.createOffer();
			await peer.setLocalDescription(offer);
			if (peer.localDescription) {
				await sr.sendOffer(sessionId, peer.localDescription);
				offerSentRef.current = true;
			}
		} catch {
			// noop
		}
	}, [role, sessionId]);
	useEffect(() => {
		signalRRef.current = signalR;
	}, [signalR]);

	useEffect(() => {
		if (!sessionId || !iceServers.length) return undefined;

		let isCancelled = false;
		setMediaError(null);

		const setupPeer = async () => {
			// Intentar obtener cámara/micrófono
			let stream: MediaStream | null = null;
			try {
				stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
			} catch (err) {
				const message =
					err instanceof DOMException && err.name === "NotReadableError"
						? "La cámara o micrófono está en uso por otra aplicación."
						: err instanceof DOMException && err.name === "NotAllowedError"
							? "No se concedió permiso para acceder a la cámara."
							: "No se pudo acceder a la cámara o micrófono.";
				if (!isCancelled) setMediaError(message);
			}

			if (isCancelled) {
				stream?.getTracks().forEach((t) => t.stop());
				return;
			}

			if (stream) {
				localStreamRef.current = stream;
				setLocalStream(stream);
			}

			try {
				const peer = new RTCPeerConnection({ iceServers });
				peerRef.current = peer;
				offerSentRef.current = false;
				answerReceivedRef.current = false;

				if (stream) {
					stream.getTracks().forEach((track) => {
						peer.addTrack(track, stream);
					});
				}

				peer.ontrack = (event) => {
					const [firstStream] = event.streams;

					if (firstStream) {
						// Siempre crear una nueva referencia para que React detecte el cambio
						setRemoteStream(new MediaStream(firstStream.getTracks()));

						// Si llegan más tracks al stream después, propagarlos también
						firstStream.onaddtrack = () =>
						setRemoteStream(new MediaStream(firstStream.getTracks()));

						return;
					}

					setRemoteStream((previous) => {
						const next = previous ?? new MediaStream();
						next.addTrack(event.track);
						return new MediaStream(next.getTracks());
					});
					};

				peer.onicecandidate = (event) => {
					if (!event.candidate || !signalRRef.current) return;
					signalRRef.current.sendIceCandidate(sessionId, event.candidate.toJSON());
				};

				peer.onconnectionstatechange = () => {
					const state = peer.connectionState;
					setConnectionState(state);

					// Cuando la conexión se establece (o se restablece), forzar
					// la actualización del stream remoto desde los receivers actuales.
					// Esto cubre el caso donde ontrack no re-dispara en renegociación.
					if (state === "connected") {
						const tracks = peer
							.getReceivers()
							.map((r) => r.track)
							.filter((t): t is MediaStreamTrack =>
								t !== null && t.readyState !== "ended"
							);
						if (tracks.length > 0) {
							setRemoteStream(new MediaStream(tracks));
						}
					}
				};

				if (pendingOfferRef.current && role === "patient") {
					const offer = pendingOfferRef.current;
					pendingOfferRef.current = null;
					await peer.setRemoteDescription(new RTCSessionDescription(offer));
					const answer = await peer.createAnswer();
					await peer.setLocalDescription(answer);
					if (peer.localDescription && signalRRef.current) {
						await signalRRef.current.sendAnswer(sessionId, peer.localDescription);
					}
				}
				if (role === "doctor" && !isCancelled) {
					const sr = signalRRef.current;
					if (sr?.isJoined) {
						offerSentRef.current = false;
						// Pequeño delay para que los tracks se negocien internamente
						setTimeout(() => sendOffer(true), 200);
					}
				}
			} catch (err) {
				if (!isCancelled) {
					console.error("[useWebRTC] setupPeer failed:", err);
					setConnectionState("failed");
				}
			}
		};

		setupPeer();

		return () => {
			isCancelled = true;
			const peer = peerRef.current;
			if (peer) {
				peer.ontrack = null;
				peer.onicecandidate = null;
				peer.onconnectionstatechange = null;
				peer.close();
				peerRef.current = null;
			}
			setConnectionState("closed");
			stopStreamTracks(localStreamRef.current);
			localStreamRef.current = null;
			setLocalStream(null);
			setRemoteStream(null);
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sessionId, iceServers, role, resetKey]);

	useEffect(() => {
		const sr = signalRRef.current;
		if (!sr) return undefined;

		sr.onOffer(async ({ sdp }) => {
			const peer = peerRef.current;
			if (!peer) {
				pendingOfferRef.current = sdp;
				return;
			}

			if (role !== "patient") return;
			await peer.setRemoteDescription(new RTCSessionDescription(sdp));
			const answer = await peer.createAnswer();
			await peer.setLocalDescription(answer);
			if (peer.localDescription && signalRRef.current) {
				await signalRRef.current.sendAnswer(sessionId, peer.localDescription);
			}

			const pendingCandidates = pendingCandidatesRef.current;
			pendingCandidatesRef.current = [];
			await Promise.all(
				pendingCandidates.map((candidate) =>
					peer.addIceCandidate(new RTCIceCandidate(candidate))
				)
			);
		});

		sr.onAnswer(async ({ sdp }) => {
			const peer = peerRef.current;
			if (!peer || role !== "doctor") return;
			await peer.setRemoteDescription(new RTCSessionDescription(sdp));
			answerReceivedRef.current = true;

			const pendingCandidates = pendingCandidatesRef.current;
			pendingCandidatesRef.current = [];
			await Promise.all(
				pendingCandidates.map((candidate) =>
					peer.addIceCandidate(new RTCIceCandidate(candidate))
				)
			);
		});

		sr.onIceCandidate(async ({ candidate }) => {
			const peer = peerRef.current;
			if (!peer) {
				pendingCandidatesRef.current.push(candidate);
				return;
			}

			if (!peer.remoteDescription) {
				pendingCandidatesRef.current.push(candidate);
				return;
			}

			await peer.addIceCandidate(new RTCIceCandidate(candidate));
		});

		return () => {
			sr.onOffer(null);
			sr.onAnswer(null);
			sr.onIceCandidate(null);
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [role, sessionId]);

	const offerSchedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const scheduleOffer = useCallback((immediate = false) => {
		// Cancela cualquier oferta pendiente
		if (offerSchedulerRef.current) {
			clearTimeout(offerSchedulerRef.current);
			offerSchedulerRef.current = null;
		}

		const delay = immediate ? 0 : 2000;

		offerSchedulerRef.current = setTimeout(async () => {
			offerSchedulerRef.current = null;
			await sendOffer(immediate);
		}, delay);
		}, [sendOffer]);
	
	useEffect(() => {
		if (role !== "doctor") return undefined;

		signalR?.onJoinedRoom(() => {
			offerSentRef.current = false;
			scheduleOffer(true);
		});

		return () => {
			signalR?.onJoinedRoom(null);
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [role, scheduleOffer, signalR]);

	const closeConnection = () => {
		const peer = peerRef.current;
		if (peer) {
			peer.close();
			peerRef.current = null;
		}

		stopStreamTracks(localStreamRef.current);
		localStreamRef.current = null;
		setLocalStream(null);
		setRemoteStream(null);
		setConnectionState("closed");
	};

	const retryOffer = async () => {
		if (!signalR?.isConnected) return;
		offerSentRef.current = false;
		await sendOffer(true);
	};

	return {
		localStream,
		remoteStream,
		connectionState,
		mediaError,
		closeConnection
	};
}
