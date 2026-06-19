import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  cn,
  normalizeSpaces,
  getStatusBadgeVariant,
  getStatusBadgeName,
  toLocalISOString,
  formatDateTime,
  formatDate,
  getSessionBadgeVariant,
  getSessionStatusLabel,
  isExpiredStatus,
  isTokenExpiredError,
  getStartSessionErrorMessage,
  getPatientName,
} from "@/lib/utils";
import { AppointmentStatus } from "@/constants/appointmentStatus";
import { VideoSessionStatus } from "@/constants/videoSessionStatus";
import { isAxiosError } from "axios";
import { patientService } from "@/lib/api/patient.service";

vi.mock("axios", () => ({ isAxiosError: vi.fn() }));
vi.mock("@/lib/api/patient.service", () => ({
  patientService: {
    getPatient: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Utils - cn()", () => {
  it("should merge multiple class values", () => {
    const result = cn("px-2", "py-1");
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
  });

  it("should handle conditional classes", () => {
    const isActive = true;
    const result = cn("px-2", isActive && "bg-blue-500");
    expect(result).toContain("px-2");
  });

  it("should resolve tailwind class conflicts", () => {
    const result = cn("px-2", "px-4");
    expect(result).toContain("px-4");
  });

  it("should handle empty input", () => {
    const result = cn();
    expect(typeof result).toBe("string");
  });

  it("should handle array of classes", () => {
    const result = cn(["px-2", "py-1"]);
    expect(result).toBeDefined();
  });

  it("should filter out falsy values", () => {
    const result = cn("px-2", false && "bg-red-500", null, "py-1");
    expect(result).toContain("px-2");
    expect(result).toContain("py-1");
  });
});

describe("Utils - normalizeSpaces()", () => {
  it("should trim leading and trailing spaces", () => {
    const result = normalizeSpaces("  hello  ");
    expect(result).toBe("hello");
  });

  it("should replace multiple spaces with single space", () => {
    const result = normalizeSpaces("hello    world");
    expect(result).toBe("hello world");
  });

  it("should handle mixed whitespace characters", () => {
    const result = normalizeSpaces("hello  \t  world");
    expect(result).toBe("hello world");
  });

  it("should handle single spaces correctly", () => {
    const result = normalizeSpaces("hello world");
    expect(result).toBe("hello world");
  });

  it("should return empty string for whitespace only", () => {
    const result = normalizeSpaces("   ");
    expect(result).toBe("");
  });

  it("should handle empty string", () => {
    const result = normalizeSpaces("");
    expect(result).toBe("");
  });

  it("should handle strings with newlines and tabs", () => {
    const result = normalizeSpaces("hello\n\n  world\t\ttest");
    expect(result).toBe("hello world test");
  });
});

describe("Utils - getStatusBadgeVariant()", () => {
  it("should return 'outline' for SCHEDULED status", () => {
    const result = getStatusBadgeVariant(AppointmentStatus.SCHEDULED);
    expect(result).toBe("outline");
  });

  it("should return 'secondary' for CONFIRMED status", () => {
    const result = getStatusBadgeVariant(AppointmentStatus.CONFIRMED);
    expect(result).toBe("secondary");
  });

  it("should return 'default' for INPROGRESS status", () => {
    const result = getStatusBadgeVariant(AppointmentStatus.INPROGRESS);
    expect(result).toBe("default");
  });

  it("should return 'secondary' for COMPLETED status", () => {
    const result = getStatusBadgeVariant(AppointmentStatus.COMPLETED);
    expect(result).toBe("secondary");
  });

  it("should return 'destructive' for CANCELLED status", () => {
    const result = getStatusBadgeVariant(AppointmentStatus.CANCELLED);
    expect(result).toBe("destructive");
  });

  it("should return 'outline' for unknown status", () => {
    const result = getStatusBadgeVariant("UNKNOWN_STATUS");
    expect(result).toBe("outline");
  });

  it("should handle empty string", () => {
    const result = getStatusBadgeVariant("");
    expect(result).toBe("outline");
  });

  it("should return correct variant type", () => {
    const result = getStatusBadgeVariant(AppointmentStatus.SCHEDULED);
    expect(["default", "secondary", "destructive", "outline"]).toContain(
      result
    );
  });
});

describe("Utils - getStatusBadgeName()", () => {
  it("should return 'Programado' for SCHEDULED status", () => {
    const result = getStatusBadgeName(AppointmentStatus.SCHEDULED);
    expect(result).toBe("Programado");
  });

  it("should return 'Confirmado' for CONFIRMED status", () => {
    const result = getStatusBadgeName(AppointmentStatus.CONFIRMED);
    expect(result).toBe("Confirmado");
  });

  it("should return 'En curso' for INPROGRESS status", () => {
    const result = getStatusBadgeName(AppointmentStatus.INPROGRESS);
    expect(result).toBe("En curso");
  });

  it("should return 'Completado' for COMPLETED status", () => {
    const result = getStatusBadgeName(AppointmentStatus.COMPLETED);
    expect(result).toBe("Completado");
  });

  it("should return 'Cancelado' for CANCELLED status", () => {
    const result = getStatusBadgeName(AppointmentStatus.CANCELLED);
    expect(result).toBe("Cancelado");
  });

  it("should return the status value for unknown status", () => {
    const unknownStatus = "CUSTOM_STATUS";
    const result = getStatusBadgeName(unknownStatus);
    expect(result).toBe(unknownStatus);
  });

  it("should handle empty string", () => {
    const result = getStatusBadgeName("");
    expect(result).toBe("");
  });

  it("should be case-sensitive", () => {
    const result = getStatusBadgeName("scheduled");
    expect(result).toBe("scheduled");
  });

  it("should always return a string", () => {
    const result = getStatusBadgeName(AppointmentStatus.CONFIRMED);
    expect(typeof result).toBe("string");
  });
});

describe("Utils - toLocalISOString()", () => {
  it("should convert to local ISO without timezone offset", () => {
    const date = new Date("2026-05-10T10:30:00.000Z");
    const offset = date.getTimezoneOffset() * 60000;
    const expected = new Date(date.getTime() - offset)
      .toISOString()
      .slice(0, 16);
    expect(toLocalISOString(date)).toBe(expected);
  });
});

describe("Utils - formatDateTime()", () => {
  it("should return '-' when value is empty", () => {
    expect(formatDateTime()).toBe("-");
  });

  it("should return the input when date is invalid", () => {
    const value = "invalid-date";
    expect(formatDateTime(value)).toBe(value);
  });

  it("should format valid date values", () => {
    const value = "2026-05-10T10:30:00.000Z";
    const result = formatDateTime(value);
    expect(result).not.toBe("-");
    expect(result).toContain("2026");
  });
});

describe("Utils - formatDate()", () => {
  it("should return '-' when value is empty", () => {
    expect(formatDate()).toBe("-");
  });

  it("should return the input when date is invalid", () => {
    const value = "invalid-date";
    expect(formatDate(value)).toBe(value);
  });

  it("should format valid date values", () => {
    const value = "2026-05-10T10:30:00.000Z";
    const result = formatDate(value);
    expect(result).not.toBe("-");
    expect(result).toContain("2026");
  });
});

describe("Utils - getSessionBadgeVariant()", () => {
  it("should map statuses to badge variants", () => {
    expect(getSessionBadgeVariant(VideoSessionStatus.ACTIVE)).toBe("secondary");
    expect(getSessionBadgeVariant(VideoSessionStatus.RECONNECTING)).toBe("default");
    expect(getSessionBadgeVariant(VideoSessionStatus.ENDED)).toBe("destructive");
    expect(getSessionBadgeVariant(VideoSessionStatus.WAITING)).toBe("outline");
    expect(getSessionBadgeVariant(VideoSessionStatus.ERROR)).toBe("destructive");
  });

  it("should return destructive for expired status", () => {
    expect(getSessionBadgeVariant("Expired")).toBe("destructive");
  });

  it("should return outline for unknown status", () => {
    expect(getSessionBadgeVariant("Unknown")).toBe("outline");
  });
});

describe("Utils - getSessionStatusLabel()", () => {
  it("should map session status to labels", () => {
    expect(getSessionStatusLabel(VideoSessionStatus.CREATED)).toBe("Creada");
    expect(getSessionStatusLabel(VideoSessionStatus.WAITING)).toBe("Esperando");
    expect(getSessionStatusLabel(VideoSessionStatus.ACTIVE)).toBe("Activa");
    expect(getSessionStatusLabel(VideoSessionStatus.RECONNECTING)).toBe(
      "Reconectando"
    );
    expect(getSessionStatusLabel(VideoSessionStatus.ENDED)).toBe("Finalizada");
    expect(getSessionStatusLabel(VideoSessionStatus.ERROR)).toBe("Error");
  });

  it("should return label for expired status", () => {
    expect(getSessionStatusLabel("Expired")).toBe("Expirada");
  });

  it("should return 'Sin estado' when empty", () => {
    expect(getSessionStatusLabel()).toBe("Sin estado");
  });

  it("should return the input for unknown status", () => {
    expect(getSessionStatusLabel("Custom")).toBe("Custom");
  });
});

describe("Utils - isExpiredStatus()", () => {
  it("should return true for expired values", () => {
    expect(isExpiredStatus("Expired")).toBe(true);
    expect(isExpiredStatus("expired")).toBe(true);
  });

  it("should return false for non-expired values", () => {
    expect(isExpiredStatus("Active")).toBe(false);
    expect(isExpiredStatus()).toBe(false);
  });
});

describe("Utils - isTokenExpiredError()", () => {
  it("should return false for non-axios errors", () => {
    vi.mocked(isAxiosError).mockReturnValue(false);
    expect(isTokenExpiredError(new Error("fail"))).toBe(false);
  });

  it("should return true for 401 or 419", () => {
    vi.mocked(isAxiosError).mockReturnValue(true);
    expect(isTokenExpiredError({ response: { status: 401 } } as any)).toBe(true);
    expect(isTokenExpiredError({ response: { status: 419 } } as any)).toBe(true);
  });

  it("should return true when message contains token expired", () => {
    vi.mocked(isAxiosError).mockReturnValue(true);
    const error = {
      response: { status: 400, data: { message: "Token expirado" } },
    };
    expect(isTokenExpiredError(error as any)).toBe(true);
  });

  it("should return false for other axios errors", () => {
    vi.mocked(isAxiosError).mockReturnValue(true);
    const error = {
      response: { status: 500, data: { message: "Otro error" } },
    };
    expect(isTokenExpiredError(error as any)).toBe(false);
  });
});

describe("Utils - getStartSessionErrorMessage()", () => {
  it("should return default message for non-axios errors", () => {
    vi.mocked(isAxiosError).mockReturnValue(false);
    expect(getStartSessionErrorMessage(new Error("fail"))).toBe(
      "No se pudo iniciar la sesion."
    );
  });

  it("should handle status 400/403/404", () => {
    vi.mocked(isAxiosError).mockReturnValue(true);
    expect(
      getStartSessionErrorMessage({ response: { status: 400 } } as any)
    ).toBe("La cita no esta Confirmed o InProgress, o la sesion ya finalizo.");
    expect(
      getStartSessionErrorMessage({ response: { status: 403 } } as any)
    ).toBe("No tienes permisos para iniciar esta sesion.");
    expect(
      getStartSessionErrorMessage({ response: { status: 404 } } as any)
    ).toBe("La sesion no existe.");
  });

  it("should return server message when present", () => {
    vi.mocked(isAxiosError).mockReturnValue(true);
    const error = {
      response: { status: 500, data: { message: "Mensaje" } },
    };
    expect(getStartSessionErrorMessage(error as any)).toBe("Mensaje");
  });
});

describe("Utils - getPatientName()", () => {
  it("should resolve patient full name", async () => {
    vi.mocked(patientService.getPatient).mockResolvedValue({
      fullName: "Ana Ruiz",
    } as any);

    await expect(getPatientName("patient-1")).resolves.toBe("Ana Ruiz");
  });
});
