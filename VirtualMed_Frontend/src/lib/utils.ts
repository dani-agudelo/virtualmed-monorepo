import { AppointmentStatus } from "@/constants/appointmentStatus";
import { VideoSessionStatus } from "@/constants/videoSessionStatus";
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isAxiosError } from "axios";
import { patientService } from "./api/patient.service";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeSpaces(str: string) {
  return str.trim().replace(/\s+/g, " ");
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

// ============================================
// Obtener color de badge según estado
// ============================================
export const getStatusBadgeVariant = (
  status: string
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case AppointmentStatus.SCHEDULED:
      return "outline";
    case AppointmentStatus.CONFIRMED:
      return "secondary";
    case AppointmentStatus.INPROGRESS:
      return "default";
    case AppointmentStatus.COMPLETED:
      return "secondary";
    case AppointmentStatus.CANCELLED:
      return "destructive";
    default:
      return "outline";
  }
};

// ============================================
// Obtener nombre de badge según estado
// ============================================
export const getStatusBadgeName = (status: string): string => {
  switch (status) {
    case AppointmentStatus.SCHEDULED:
      return "Programado";
    case AppointmentStatus.CONFIRMED:
      return "Confirmado";
    case AppointmentStatus.INPROGRESS:
      return "En curso";
    case AppointmentStatus.COMPLETED:
      return "Completado";
    case AppointmentStatus.CANCELLED:
      return "Cancelado";
    default:
      return status;
  }
};

export const toLocalISOString = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
};

export const getSessionBadgeVariant = (status?: string): BadgeVariant => {
  if (!status) return "outline";

  switch (status) {
    case VideoSessionStatus.ACTIVE:
      return "secondary";
    case VideoSessionStatus.RECONNECTING:
      return "default";
    case VideoSessionStatus.ENDED:
      return "destructive";
    case VideoSessionStatus.WAITING:
      return "outline";
    case VideoSessionStatus.ERROR:
      return "destructive";
    case "Expired":
      return "destructive";
    default:
      return "outline";
  }
};

export const getSessionStatusLabel = (status?: string) => {
  if (!status) return "Sin estado";

  switch (status) {
    case VideoSessionStatus.CREATED:
      return "Creada";
    case VideoSessionStatus.WAITING:
      return "Esperando";
    case VideoSessionStatus.ACTIVE:
      return "Activa";
    case VideoSessionStatus.RECONNECTING:
      return "Reconectando";
    case VideoSessionStatus.ENDED:
      return "Finalizada";
    case VideoSessionStatus.ERROR:
      return "Error";
    case "Expired":
      return "Expirada";
    default:
      return status;
  }
};

export const isExpiredStatus = (status?: string) =>
  Boolean(status && status.toLowerCase() === "expired");

export const isTokenExpiredError = (error: unknown) => {
  if (!isAxiosError(error)) return false;

  const status = error.response?.status;
  const message = String(error.response?.data?.message ?? "").toLowerCase();

  if (status === 401 || status === 419) return true;
  return message.includes("token") && message.includes("expir");
};

export const getStartSessionErrorMessage = (error: unknown) => {
  if (!isAxiosError(error)) {
    return "No se pudo iniciar la sesion.";
  }

  const status = error.response?.status;
  const message = String(error.response?.data?.message ?? "");

  if (status === 400) {
    return "La cita no esta Confirmed o InProgress, o la sesion ya finalizo.";
  }
  if (status === 403) {
    return "No tienes permisos para iniciar esta sesion.";
  }
  if (status === 404) {
    return "La sesion no existe.";
  }

  return message || "No se pudo iniciar la sesion.";
};

export const getPatientName = async (patientId: string) => {
  const patientsStr = await patientService.getPatient(patientId);
  return patientsStr.fullName;
};
