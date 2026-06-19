"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Signal,
  Users,
  Video,
  VideoOff,
  WifiOff,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useIceCredentials } from "@/hooks/useIceCredentials";
import { useSignalR } from "@/hooks/useSignalR";
import { useVideoSession } from "@/hooks/useVideoSession";
import { useWebRTC } from "@/hooks/useWebRTC";
import { VideoSessionStatus } from "@/constants/videoSessionStatus";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from 'next/navigation';
import { cn } from "@/lib/utils";
import { InCallClinicalPanel } from "@/components/video-session/InCallClinicalPanel";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

type ChatStatus = "connected" | "connecting" | "reconnecting" | "disconnected";

interface VideoCallRoomProps {
  sessionId: string;
  role: "doctor" | "patient";
}

interface ChatMessage {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  sentAt: number;
  isLocal: boolean;
  status?: "sending" | "sent" | "failed";
}

type PendingMessage = {
  content: string;
  sentAt: number;
  timeoutId: ReturnType<typeof setTimeout> | null;
};

type RealtimeMessagePayload = {
  id: string;
  sessionId: string;
  senderId: string;
  message: string;
  sentAt: string;
  messageType?: number | string;
};

const SESSION_STATUS_LABELS: Record<VideoSessionStatus, string> = {
  [VideoSessionStatus.WAITING]: "Esperando",
  [VideoSessionStatus.ACTIVE]: "Activa",
  [VideoSessionStatus.RECONNECTING]: "Reconectando",
  [VideoSessionStatus.ENDED]: "Finalizada",
  [VideoSessionStatus.ERROR]: "Error",
  [VideoSessionStatus.CREATED]: "Creada",
};

const SESSION_STATUS_VARIANTS: Record<VideoSessionStatus, BadgeVariant> = {
  [VideoSessionStatus.WAITING]: "outline",
  [VideoSessionStatus.ACTIVE]: "secondary",
  [VideoSessionStatus.RECONNECTING]: "default",
  [VideoSessionStatus.ENDED]: "outline",
  [VideoSessionStatus.ERROR]: "destructive",
  [VideoSessionStatus.CREATED]: "outline",
};

const CHAT_STATUS_LABELS: Record<ChatStatus, string> = {
  connected: "Conectado",
  connecting: "Conectando",
  reconnecting: "Reconectando",
  disconnected: "Desconectado",
};

const CHAT_STATUS_VARIANTS: Record<ChatStatus, BadgeVariant> = {
  connected: "secondary",
  connecting: "outline",
  reconnecting: "default",
  disconnected: "destructive",
};

const PENDING_MESSAGE_TIMEOUT_MS = 12000;

const formatTime = (value: Date) =>
  new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);

const parseSentAt = (value?: string) => {
  if (!value) return Date.now();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

const formatSentAt = (value?: string) => formatTime(new Date(parseSentAt(value)));

interface ChatPanelProps {
  messages: ChatMessage[];
  messageDraft: string;
  onDraftChange: (value: string) => void;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
  chatStatus: ChatStatus;
  isChatDisabled: boolean;
  isSending: boolean;
}

const ChatPanel = ({
  messages,
  messageDraft,
  onDraftChange,
  onSendMessage,
  chatStatus,
  isChatDisabled,
  isSending,
}: ChatPanelProps) => {
  const statusLabel = CHAT_STATUS_LABELS[chatStatus];
  const statusVariant = CHAT_STATUS_VARIANTS[chatStatus];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-blue-600">
            Chat en tiempo real
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Signal className="h-4 w-4" />
            <span>SignalR {statusLabel}</span>
          </div>
        </div>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.isLocal ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm",
                  message.isLocal
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-900"
                )}
              >
                <div
                  className={cn(
                    "mb-1 flex items-center justify-between gap-2 text-[11px]",
                    message.isLocal ? "text-white/80" : "text-slate-500"
                  )}
                >
                  <span className="font-medium">{message.author}</span>
                  <span>
                    {message.status === "sending"
                      ? "Enviando..."
                      : message.status === "failed"
                        ? "Error al enviar"
                        : message.timestamp}
                  </span>
                </div>
                <p className="leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <Separator />

      <form onSubmit={onSendMessage} className="flex gap-2 p-4">
        <Input
          value={messageDraft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={
            isChatDisabled
              ? "Chat deshabilitado"
              : "Escribe un mensaje"
          }
          disabled={isChatDisabled}
        />
        <Button
          type="submit"
          className="bg-blue-500 text-white hover:bg-blue-600 hover:text-white"
          disabled={isChatDisabled || isSending || !messageDraft.trim()}
        >
          {isSending ? "Enviando..." : "Enviar"}
        </Button>
      </form>
    </div>
  );
};

export function VideoCallRoom({ sessionId, role }: VideoCallRoomProps) {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const router = useRouter();
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const messageIdsRef = useRef(new Set<string>());
  const pendingMessagesRef = useRef(new Map<string, PendingMessage>());
  const remotePresenceRef = useRef(false);
  const participantLeftRef = useRef(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendLockRef = useRef(false);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [messageDraft, setMessageDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [callEndedInfo, setCallEndedInfo] = useState<{ endReason?: string } | null>(null);
  const [peerResetKey, setPeerResetKey] = useState(0);

  const { iceServers, isLoading: isIceLoading, error: iceError, refresh } =
    useIceCredentials(sessionId);
  const signalR = useSignalR(sessionId);
  const { appointmentId, chatHistory, chatError, endSession } = useVideoSession(sessionId);
  const { localStream, remoteStream, connectionState, mediaError, closeConnection } =
    useWebRTC(sessionId, iceServers, role, signalR, peerResetKey);

  const localInitials = useMemo(() => {
    const initials = user?.fullName
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    return initials || "TU";
  }, [user?.fullName]);

  const remoteParticipant = useMemo(
    () =>
      role === "doctor"
        ? { name: "Paciente invitado", initials: "PI" }
        : { name: "Doctor invitado", initials: "DI" },
    [role]
  );

  const sessionStatus = useMemo<VideoSessionStatus>(() => {
    if (hasEnded) return VideoSessionStatus.ENDED;
    if (iceError) return VideoSessionStatus.ERROR;
    if (connectionState === "failed") return VideoSessionStatus.ERROR;
    if (signalR.status === "reconnecting") return VideoSessionStatus.RECONNECTING;
    if (connectionState === "connected") return VideoSessionStatus.ACTIVE;
    if (connectionState === "disconnected") return VideoSessionStatus.RECONNECTING;
    return VideoSessionStatus.WAITING;
  }, [connectionState, hasEnded, iceError, signalR.status]);

  const remoteConnected = Boolean(remoteStream);
  const isRemoteVideoOn =
    remoteStream
      ?.getVideoTracks()
      .some((t) => t.enabled && t.readyState !== "ended") ?? false;
  const isChatDisabled =
    sessionStatus === VideoSessionStatus.ERROR ||
    sessionStatus === VideoSessionStatus.ENDED;
  const areMediaControlsDisabled =
    sessionStatus === VideoSessionStatus.ERROR ||
    sessionStatus === VideoSessionStatus.ENDED ||
    !localStream;
  const showStreamSkeleton =
    isIceLoading ||
    sessionStatus === VideoSessionStatus.WAITING ||
    sessionStatus === VideoSessionStatus.RECONNECTING;
  const chatStatus = signalR.status as ChatStatus;
  const showCallEndedNotice = role === "patient" && Boolean(callEndedInfo);
  const mediaControlsDisabledReason = useMemo(() => {
    if (sessionStatus === VideoSessionStatus.ERROR) {
      return "Controles deshabilitados por error de red.";
    }
    if (sessionStatus === VideoSessionStatus.ENDED) {
      return "Controles deshabilitados porque la sesion finalizo.";
    }
    if (!localStream) {
      return mediaError
        ? `Controles deshabilitados: ${mediaError}`
        : "Controles deshabilitados: no hay acceso a camara o microfono.";
    }
    return "";
  }, [localStream, mediaError, sessionStatus]);

  const removeMessageById = useCallback((id: string) => {
    messageIdsRef.current.delete(id);
    const pendingEntry = pendingMessagesRef.current.get(id);
    if (pendingEntry?.timeoutId) {
      clearTimeout(pendingEntry.timeoutId);
    }
    pendingMessagesRef.current.delete(id);
    setMessages((previous) => previous.filter((message) => message.id !== id));
  }, []);

  const appendPendingMessage = useCallback((content: string) => {
    const sentAt = Date.now();
    const id = `local-${sentAt}`;
    const pendingMessage: ChatMessage = {
      id,
      author: "Tu",
      content,
      timestamp: formatTime(new Date(sentAt)),
      sentAt,
      isLocal: true,
      status: "sending",
    };

    messageIdsRef.current.add(id);
    const timeoutId = setTimeout(() => {
      const pendingEntry = pendingMessagesRef.current.get(id);
      if (!pendingEntry) return;
      setMessages((previous) =>
        previous.map((message) =>
          message.id === id && message.status === "sending"
            ? { ...message, status: "failed" }
            : message
        )
      );
    }, PENDING_MESSAGE_TIMEOUT_MS);
    pendingMessagesRef.current.set(id, { content, sentAt, timeoutId });
    setMessages((previous) =>
      [...previous, pendingMessage].sort((left, right) => left.sentAt - right.sentAt)
    );

    return pendingMessage;
  }, []);

  const appendMessage = useCallback((message: ChatMessage) => {
    if (messageIdsRef.current.has(message.id)) return;

    if (message.isLocal) {
      const pendingEntries = Array.from(pendingMessagesRef.current.entries());
      const matched = pendingEntries.find(([, pending]) => {
        const withinWindow = Math.abs(pending.sentAt - message.sentAt) <= 15000;
        return pending.content === message.content && withinWindow;
      });

      if (matched) {
        const [pendingId] = matched;
        const pendingEntry = pendingMessagesRef.current.get(pendingId);
        if (pendingEntry?.timeoutId) {
          clearTimeout(pendingEntry.timeoutId);
        }
        pendingMessagesRef.current.delete(pendingId);
        messageIdsRef.current.delete(pendingId);
        setMessages((previous) => {
          const next = previous.filter((entry) => entry.id !== pendingId);
          const resolvedStatus: ChatMessage["status"] = "sent";
          return [...next, { ...message, status: resolvedStatus }].sort(
            (left, right) => left.sentAt - right.sentAt
          );
        });
        return;
      }
    }

    messageIdsRef.current.add(message.id);
    const resolvedStatus: ChatMessage["status"] = message.status ?? "sent";
    setMessages((previous) =>
      [...previous, { ...message, status: resolvedStatus }].sort(
        (left, right) => left.sentAt - right.sentAt
      )
    );
  }, []);

  const buildChatMessage = useCallback(
    (payload: RealtimeMessagePayload): ChatMessage => {
      const isLocal = payload.senderId && payload.senderId === user?.sub;
      const isSystem =
        payload.messageType === 1 ||
        payload.messageType === "system" ||
        payload.messageType === "SYSTEM";
      const author = isSystem
        ? "Sistema"
        : isLocal
          ? "Tu"
          : remoteParticipant.name;

      return {
        id: payload.id,
        author,
        content: payload.message,
        timestamp: formatSentAt(payload.sentAt),
        sentAt: parseSentAt(payload.sentAt),
        isLocal: Boolean(isLocal),
      };
    },
    [remoteParticipant.name, user?.sub]
  );
  const setLocalVideoElement = useCallback(
    (node: HTMLVideoElement | null) => {
      localVideoRef.current = node;
      if (node && localStream) {
        node.srcObject = localStream;
      }
    },
    [localStream]
  );

  const setRemoteVideoElement = useCallback(
    (node: HTMLVideoElement | null) => {
      remoteVideoRef.current = node;
      if (node && remoteStream) {
        node.srcObject = remoteStream;
      }
    },
    [remoteStream]
  );

  useEffect(() => {
    const pendingMessages = pendingMessagesRef.current;
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      pendingMessages.forEach((pending) => {
        if (pending.timeoutId) clearTimeout(pending.timeoutId);
      });
    };
  }, []);

  useEffect(() => {
    if (!localVideoRef.current) return;
    localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (!remoteVideoRef.current) return;
    remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
  }, [isMuted, localStream]);

  useEffect(() => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = isCameraOn;
    });
  }, [isCameraOn, localStream]);

  useEffect(() => {
    if (!chatHistory.length) return;
    chatHistory.forEach((entry) => {
      appendMessage(
        buildChatMessage({
          id: entry.id,
          sessionId,
          senderId: entry.senderId,
          message: entry.message,
          sentAt: entry.sentAt,
          messageType: entry.messageType,
        })
      );
    });
  }, [appendMessage, buildChatMessage, chatHistory, sessionId]);

  useEffect(() => {
    signalR.onMessageReceived((payload) => {
      appendMessage(buildChatMessage(payload));
    });

    return () => {
      signalR.onMessageReceived(null);
    };
  }, [appendMessage, buildChatMessage, signalR]);

  useEffect(() => {
    signalR.onParticipantLeft((payload) => {
      if (payload.sessionId !== sessionId) return;
      if (payload.userId && payload.userId === user?.sub) return;
      participantLeftRef.current = true;
      remotePresenceRef.current = false;
      toast({
        title: "Participante desconectado",
        description: "El participante abandono la reunion.",
      });
    });

    return () => {
      signalR.onParticipantLeft(null);
    };
  }, [sessionId, signalR, toast, user?.sub]);

  useEffect(() => {
    if (role !== "doctor") return;

    signalR.onParticipantJoined((payload) => {
      if (payload.sessionId !== sessionId) return;
      // El paciente tiene un peer nuevo — el doctor también debe recrear el suyo
      setPeerResetKey((k) => k + 1);
    });

    return () => {
      signalR.onParticipantJoined(null);
    };
  }, [role, sessionId, signalR]);

  useEffect(() => {
    signalR.onCallEnded((payload) => {
      if (payload.sessionId !== sessionId) return;
      if (role !== "patient") return;
      setHasEnded(true);
      closeConnection();
      setCallEndedInfo({ endReason: payload.endReason });
    });

    return () => {
      signalR.onCallEnded(null);
    };
  }, [closeConnection, role, sessionId, signalR]);

  useEffect(() => {
    if (signalR.error) {
      toast({
        title: "SignalR",
        description: signalR.error,
        variant: "destructive",
      });
    }
  }, [signalR.error, toast]);

  useEffect(() => {
    if (chatError) {
      toast({
        title: "Chat",
        description: chatError,
        variant: "destructive",
      });
    }
  }, [chatError, toast]);

  useEffect(() => {
    if (iceError) {
      toast({
        title: "Credenciales ICE",
        description: iceError,
        variant: "destructive",
      });
    }
  }, [iceError, toast]);

  useEffect(() => {
    if (mediaError) {
      toast({
        title: "Cámara no disponible",
        description: mediaError,
      });
    }
  }, [mediaError, toast]);

  useEffect(() => {
    if (remoteConnected) {
      participantLeftRef.current = false;
    }
    if (!remoteConnected && participantLeftRef.current) {
      participantLeftRef.current = false;
      remotePresenceRef.current = remoteConnected;
      return;
    }
    if (remotePresenceRef.current === remoteConnected) return;
    remotePresenceRef.current = remoteConnected;

    toast({
      title: remoteConnected
        ? "Participante conectado"
        : "Participante desconectado",
      description: remoteConnected
        ? "El participante se ha unido a la sesion."
        : "El participante ha salido de la sesion.",
    });
  }, [remoteConnected, toast]);

  const handleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(async () => {
      reconnectTimeoutRef.current = null;

      // 1. Refrescar ICE 
      await refresh();

      // 2. Forzar recreación del peer (incrementar key)
      //    El efecto en useWebRTC se vuelve a ejecutar y,
      //    al final de setupPeer, el doctor auto-envía offer.
      setPeerResetKey((k) => k + 1);

      // 3. Para el paciente: re-unirse a la sala dispara
      //    `participantJoined` en el doctor, quien manda nuevo offer.
      if (role === "patient" && signalR.isConnected) {
        try {
          await signalR.rejoinRoom();
        } catch {
          // noop
        }
      }
    }, 500);
  }, [refresh, role, signalR]);

  const handleEndSession = async () => {
    try {
      await signalR.leaveRoom();
      await endSession();
      closeConnection();
      setHasEnded(true);
      toast({
        title: "Sesion finalizada",
        description: "La llamada se cerro correctamente.",
      });
      router.push("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo finalizar.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsEndDialogOpen(false);
    }
  };

  const handleLeaveSession = async () => {
    try {
      await signalR.leaveRoom();
      closeConnection();
      router.push(`/dashboard/video-session/${sessionId}/out`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo salir.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsEndDialogOpen(false);
    }
  };

  const handleGoHome = useCallback(() => {
    const finalize = async () => {
      try {
        await signalR.leaveRoom();
      } catch {
        // noop
      }
      closeConnection();
      router.push("/dashboard");
    };

    void finalize();
  }, [closeConnection, router, signalR]);

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = messageDraft.trim();
    if (!trimmed || isChatDisabled) return;
    if (sendLockRef.current) return;

    if (!signalR.isConnected) {
      toast({
        title: "Chat desconectado",
        description: "No hay conexion con el chat en tiempo real.",
        variant: "destructive",
      });
      return;
    }

    sendLockRef.current = true;
    setIsSending(true);
    const pendingMessage = appendPendingMessage(trimmed);
    setMessageDraft("");

    try {
      await signalR.sendMessage(sessionId, trimmed, 0);
    } catch {
      removeMessageById(pendingMessage.id);
      setMessageDraft(trimmed);
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje.",
        variant: "destructive",
      });
    } finally {
      sendLockRef.current = false;
      setIsSending(false);
    }
  };

  const videoStage = (chatTrigger?: React.ReactNode) => (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>
            {remoteConnected ? "2 participantes" : "1 participante"}
          </span>
        </div>
        <span>
          Calidad de red:{" "}
          {sessionStatus === VideoSessionStatus.RECONNECTING ||
            sessionStatus === VideoSessionStatus.ERROR
            ? "Inestable"
            : "Estable"}
        </span>
      </div>

      <div className="flex-1 px-4 pb-4">
        <div className="relative h-full min-h-[360px] overflow-hidden rounded-lg border bg-slate-950 text-white">
          <video
            ref={setRemoteVideoElement}
            className={cn(
              "h-full w-full object-cover",
              remoteConnected && isRemoteVideoOn ? "opacity-100" : "opacity-0"
            )}
            playsInline
            autoPlay
          />

          {(!remoteConnected || !isRemoteVideoOn) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <Avatar className="h-16 w-16 border border-white/20">
                <AvatarFallback className="bg-white/10 text-white">
                  {remoteParticipant.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">
                  {remoteConnected ? remoteParticipant.name : "Sin participante"}
                </p>
                <p className="text-xs text-white/70">
                  {remoteConnected ? "Video apagado" : "Esperando conexion"}
                </p>
              </div>
            </div>
          )}

          {showStreamSkeleton && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
              <div className="space-y-3">
                <Skeleton className="h-6 w-44 bg-white/10" />
                <Skeleton className="h-4 w-60 bg-white/10" />
              </div>
            </div>
          )}

          {sessionStatus === VideoSessionStatus.WAITING && !remoteConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
              <div className="space-y-3 text-center">
                <p className="text-lg font-semibold">Esperando al participante</p>
                <p className="text-sm text-white/70">
                  {localStream
                    ? "Tu camara y microfono estan listos."
                    : "Preparando camara y microfono..."}
                </p>
              </div>
            </div>
          )}

          {sessionStatus === VideoSessionStatus.ENDED && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
              <div className="space-y-2 text-center">
                <p className="text-lg font-semibold">Sesion finalizada</p>
                <p className="text-sm text-white/70">
                  La videollamada termino.
                </p>
              </div>
            </div>
          )}

          {sessionStatus === VideoSessionStatus.ERROR && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
              <div className="space-y-2 text-center">
                <p className="text-lg font-semibold">Error de red</p>
                <p className="text-sm text-white/70">
                  No se pudo recuperar la sesion.
                </p>
              </div>
            </div>
          )}

          <Badge className="absolute left-4 top-4 border-white/20 bg-white/10 text-white">
            Remoto
          </Badge>

          <div className="absolute bottom-4 right-4 w-40 sm:w-48 md:w-56">
            <div className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-slate-900">
              <video
                ref={setLocalVideoElement}
                className={cn(
                  "h-full w-full object-cover",
                  isCameraOn ? "opacity-100" : "opacity-0"
                )}
                muted
                playsInline
                autoPlay
              />

              {!isCameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
                  <Avatar className="h-10 w-10 border border-white/20">
                    <AvatarFallback className="bg-white/10 text-white">
                      {localInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-white/80">Camara apagada</span>
                </div>
              )}

              {showStreamSkeleton && (
                <Skeleton className="absolute inset-0 rounded-none bg-white/10" />
              )}

              <div className="absolute left-2 top-2 rounded bg-black/40 px-2 py-0.5 text-[11px] text-white">
                Tu video
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="icon"
                onClick={() => setIsMuted((previous) => !previous)}
                disabled={areMediaControlsDisabled}
              >
                {isMuted ? <MicOff /> : <Mic />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {areMediaControlsDisabled && mediaControlsDisabledReason
                ? mediaControlsDisabledReason
                : isMuted
                  ? "Activar microfono"
                  : "Silenciar microfono"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isCameraOn ? "secondary" : "destructive"}
                size="icon"
                onClick={() => setIsCameraOn((previous) => !previous)}
                disabled={areMediaControlsDisabled}
              >
                {isCameraOn ? <Video /> : <VideoOff />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {areMediaControlsDisabled && mediaControlsDisabledReason
                ? mediaControlsDisabledReason
                : isCameraOn
                  ? "Apagar camara"
                  : "Encender camara"}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {chatTrigger}

          <Dialog open={isEndDialogOpen} onOpenChange={setIsEndDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={sessionStatus === VideoSessionStatus.ENDED}
              >
                <PhoneOff className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {role === "doctor" ? "Finalizar" : "Salir"}
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {role === "doctor"
                    ? "Finalizar sesion?"
                    : "Salir de la videollamada?"}
                </DialogTitle>
                <DialogDescription>
                  {role === "doctor"
                    ? "La llamada terminara para todos los participantes."
                    : "Tu conexión se cerrará, pero la sesión seguirá activa para el doctor."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsEndDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={role === "doctor" ? handleEndSession : handleLeaveSession}
                >
                  {role === "doctor" ? "Finalizar sesion" : "Salir de la llamada"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-4 p-6 pt-16">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-blue-600">
              Sesion de videollamada
            </h1>
            <p className="text-sm text-muted-foreground">
              ID de sesion: {sessionId}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={SESSION_STATUS_VARIANTS[sessionStatus]}>
              Estado: {SESSION_STATUS_LABELS[sessionStatus]}
            </Badge>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              SignalR {CHAT_STATUS_LABELS[chatStatus]}
            </Badge>
          </div>
        </div>

        {sessionStatus === VideoSessionStatus.RECONNECTING && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <WifiOff className="h-4 w-4" />
            <div>
              <AlertTitle>Reconectando</AlertTitle>
              <AlertDescription>
                Intentando restablecer la conexion de audio y video.
              </AlertDescription>
            </div>
          </Alert>
        )}

        {sessionStatus === VideoSessionStatus.ERROR && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <div>
              <AlertTitle>Error de red</AlertTitle>
              <AlertDescription>
                No pudimos restablecer la conexion. Puedes intentar nuevamente.
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={handleReconnect}>
                    Reintentar
                  </Button>
                </div>
              </AlertDescription>
            </div>
          </Alert>
        )}

        {showCallEndedNotice && (
          <Alert className="border-slate-200 bg-slate-50 text-slate-900">
            <PhoneOff className="h-4 w-4" />
            <div>
              <AlertTitle>El doctor finalizo la llamada</AlertTitle>
              <AlertDescription>
                {callEndedInfo?.endReason
                  ? `Motivo: ${callEndedInfo.endReason}`
                  : "La sesion termino. Puedes volver al inicio."}
                <div className="mt-3">
                  <Button size="sm" onClick={handleGoHome}>
                    Ir al inicio
                  </Button>
                </div>
              </AlertDescription>
            </div>
          </Alert>
        )}

        <div className="hidden lg:block">
          <div className="rounded-xl border bg-white shadow-sm">
            <ResizablePanelGroup orientation="horizontal" className="min-h-[620px]">
              <ResizablePanel defaultSize={70} minSize={45}>
                {videoStage()}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={30} minSize={25}>
                <ChatPanel
                  messages={messages}
                  messageDraft={messageDraft}
                  onDraftChange={setMessageDraft}
                  onSendMessage={handleSendMessage}
                  chatStatus={chatStatus}
                  isChatDisabled={isChatDisabled}
                  isSending={isSending}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </div>

        <div className="lg:hidden">
          <Sheet>
            {videoStage(
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <MessageSquare className="h-4 w-4" />
                  Chat
                </Button>
              </SheetTrigger>
            )}
            <SheetContent side="right" className="p-0">
              <ChatPanel
                messages={messages}
                messageDraft={messageDraft}
                onDraftChange={setMessageDraft}
                onSendMessage={handleSendMessage}
                chatStatus={chatStatus}
                isChatDisabled={isChatDisabled}
                isSending={isSending}
              />
            </SheetContent>
          </Sheet>
        </div>

        {role === 'doctor' && appointmentId && (
          <InCallClinicalPanel appointmentId={appointmentId} />
        )}
      </div>
    </TooltipProvider>
  );
}
