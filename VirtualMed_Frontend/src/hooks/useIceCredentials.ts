"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";

import { doctorService } from "@/lib/api/doctor.service";
import type { IceCredentials } from "@/types";

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

const toRtcIceServers = (credentials: IceCredentials): RTCIceServer[] =>
	Array.isArray(credentials.iceServers)
		? credentials.iceServers.map((server) => ({
				urls: server.urls,
				username: server.username,
				credential: server.credential,
			}))
		: [];

export function useIceCredentials(sessionId: string) {
	const [credentials, setCredentials] = useState<IceCredentials | null>(null);
	const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
	const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (!sessionId) return null;

		setIsLoading(true);
		setError(null);

		try {
			const response = await doctorService.postIceCredentials(sessionId);
			setCredentials(response);
			setIceServers(toRtcIceServers(response));
			setTokenExpiresAt(response.tokenExpiresAt ?? null);
			return response;
		} catch (err) {
			const message = isAxiosError(err)
				? err.response?.data?.message || "No fue posible actualizar el token."
				: "No fue posible actualizar el token.";
			setError(message);
			return null;
		} finally {
			setIsLoading(false);
		}
	}, [sessionId]);

	const tokenExpiresAtMs = useMemo(() => {
		if (!tokenExpiresAt) return null;
		const parsed = new Date(tokenExpiresAt).getTime();
		return Number.isNaN(parsed) ? null : parsed;
	}, [tokenExpiresAt]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	useEffect(() => {
		if (!tokenExpiresAtMs) return undefined;

		const refreshAt = tokenExpiresAtMs - REFRESH_THRESHOLD_MS;
		const delay = Math.max(refreshAt - Date.now(), 0);
		const timer = window.setTimeout(() => {
			refresh();
		}, delay);

		return () => window.clearTimeout(timer);
	}, [refresh, tokenExpiresAtMs]);

	return {
		iceServers,
		roomToken: credentials?.roomToken ?? null,
		tokenExpiresAt,
		isLoading,
		error,
		refresh,
	};
}
