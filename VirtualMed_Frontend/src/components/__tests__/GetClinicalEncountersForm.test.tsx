import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ListEncountersForm from "../clinicalEncounters/getClinicalEncountersForm";
import { doctorService } from "@/lib/api/doctor.service";
import { patientService } from "@/lib/api/patient.service";
import { useAuthStore } from "@/store/auth.store";
import { useToast } from "@/hooks/use-toast";
import { EncounterType } from "@/constants/encounterType";
import { DiagnosisType } from "@/constants/diagnosisType";
import { UserRole } from "@/constants/userRole";
import { UserStatus } from "@/constants/userStatus";
import { DetailedClinicalEncounter } from "@/types";

vi.mock("@/lib/api/doctor.service", () => ({
	doctorService: {
		getClinicalEncounter: vi.fn(),
	},
}));

vi.mock("@/lib/api/patient.service", () => ({
	patientService: {
		getPatients: vi.fn(),
		getPatient: vi.fn(),
	},
}));

vi.mock("@/store/auth.store", () => ({
	useAuthStore: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
	useToast: vi.fn(),
}));

const mockToast = vi.fn();

const buildAuthState = (role: UserRole | null, hydrated = true) => ({
	user: role
		? {
				sub: `user-${role}`,
				email: `${role.toLowerCase()}@test.com`,
				role,
				fullName: `${role} User`,
				status: UserStatus.ACTIVE,
				email_verified: true,
				two_factor_enabled: false,
				permission: [],
			}
		: null,
	_hasHydrated: hydrated,
});

const makeEncounter = (overrides: Partial<DetailedClinicalEncounter> = {}): DetailedClinicalEncounter => ({
	id: "enc-1",
	appointmentId: "apt-1",
	patientId: "patient-1",
	doctorId: "doctor-1",
	encounterType: EncounterType.Consultation,
	startAt: "2026-02-10T10:00:00.000Z",
	endAt: "2026-02-10T10:30:00.000Z",
	chiefComplaint: "Dolor de cabeza persistente",
	currentCondition: "Paciente hemodinamicamente estable",
	physicalExam: "Sin hallazgos de alarma",
	assessment: "Cefalea tensional",
	plan: "Hidratacion, analgesia y control",
	notes: "Seguimiento en 72 horas",
	recordingUrl: null,
	isLocked: false,
	diagnoses: [
		{
			id: "diag-1",
			icd10Code: "R51",
			description: "Cefalea",
			type: DiagnosisType.PRIMARY,
		},
	],
	prescriptions: [
		{
			id: "pres-1",
			prescriptionNumber: "RX-001",
			issuedAt: "2026-02-10T11:00:00.000Z",
			validUntil: "2026-03-10T11:00:00.000Z",
			medications: [
				{
					medicationId: "med-1",
					medicationName: "Paracetamol",
					dosage: "500 mg",
					frequency: "Cada 8h",
					durationDays: 3,
					instructions: null,
				},
			],
		},
	],
	...overrides,
});

const defaultPatientsResponse = {
	items: [{ id: "patient-1", fullName: "Paciente Uno", document: "DOC-001" }],
	page: 1,
	pageSize: 10,
	totalCount: 1,
};

function setDateRange(fromDate: string, toDate: string) {
	const inputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
	expect(inputs).toHaveLength(2);

	fireEvent.change(inputs[0], { target: { value: fromDate } });
	fireEvent.change(inputs[1], { target: { value: toDate } });
}

function buildIsoRange(fromDate: string, toDate: string) {
	return {
		from: new Date(`${fromDate}T00:00:00`).toISOString(),
		to: new Date(`${toDate}T23:59:59.999`).toISOString(),
	};
}

describe("ListEncountersForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		vi.mocked(useToast).mockReturnValue({ toast: mockToast } as never);
		vi.mocked(useAuthStore).mockReturnValue(buildAuthState(UserRole.DOCTOR) as never);
		vi.mocked(patientService.getPatients).mockResolvedValue(defaultPatientsResponse as never);
		vi.mocked(patientService.getPatient).mockResolvedValue({ fullName: "Paciente Uno Completo" } as never);
		vi.mocked(doctorService.getClinicalEncounter).mockResolvedValue([]);
	});

	it("no renderiza contenido mientras no haya hidratado", async () => {
		vi.mocked(useAuthStore).mockReturnValue(buildAuthState(UserRole.DOCTOR, false) as never);

		const { container } = render(<ListEncountersForm />);

		await waitFor(() => {
			expect(container.firstChild).toBeNull();
		});
	});

	it("bloquea acceso para roles sin permiso", () => {
		vi.mocked(useAuthStore).mockReturnValue(buildAuthState(UserRole.ADMIN) as never);

		render(<ListEncountersForm />);

		expect(screen.getByText(/No tienes permisos para acceder a esta seccion/i)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Buscar/i })).not.toBeInTheDocument();
	});

	it("en modo doctor carga pacientes al montar y muestra el titulo correcto", async () => {
		render(<ListEncountersForm />);

		await waitFor(() => {
			expect(patientService.getPatients).toHaveBeenCalledWith(
				expect.objectContaining({ q: undefined, page: "1" })
			);
		});

		expect(screen.getByText("Encuentros clínicos de mis pacientes")).toBeInTheDocument();
		expect(screen.getByText("Paciente")).toBeInTheDocument();
	});

	it("en modo paciente no muestra filtro de paciente y cambia el encabezado", () => {
		vi.mocked(useAuthStore).mockReturnValue(buildAuthState(UserRole.PATIENT) as never);

		render(<ListEncountersForm />);

		expect(screen.getByText("Mi historial clínico")).toBeInTheDocument();
		expect(screen.queryByPlaceholderText(/Buscar paciente por nombre/i)).not.toBeInTheDocument();
		expect(patientService.getPatients).not.toHaveBeenCalled();
	});

	it("valida que las fechas sean obligatorias antes de buscar", async () => {
		vi.mocked(useAuthStore).mockReturnValue(buildAuthState(UserRole.PATIENT) as never);
		const user = userEvent.setup();

		render(<ListEncountersForm />);
		await user.click(screen.getByRole("button", { name: /Buscar/i }));

		expect(mockToast).toHaveBeenCalledWith({
			title: "Validacion",
			description: "Debes ingresar fecha de inicio y fin.",
			variant: "destructive",
		});
		expect(doctorService.getClinicalEncounter).not.toHaveBeenCalled();
	});

	it("valida que fecha inicial no sea mayor que fecha final", async () => {
		vi.mocked(useAuthStore).mockReturnValue(buildAuthState(UserRole.PATIENT) as never);
		const user = userEvent.setup();

		render(<ListEncountersForm />);
		setDateRange("2026-02-20", "2026-02-10");
		await user.click(screen.getByRole("button", { name: /Buscar/i }));

		expect(mockToast).toHaveBeenCalledWith({
			title: "Validacion",
			description: "La fecha de inicio no puede ser mayor a la fecha fin.",
			variant: "destructive",
		});
		expect(doctorService.getClinicalEncounter).not.toHaveBeenCalled();
	});

	it("envia filtros de paciente y tipo de encuentro al buscar como doctor", async () => {
		vi.mocked(doctorService.getClinicalEncounter).mockResolvedValue([
			makeEncounter({ id: "enc-1", appointmentId: "apt-1", patientId: "patient-1" }),
			makeEncounter({ id: "enc-2", appointmentId: "apt-2", patientId: "patient-1", chiefComplaint: "Nauseas" }),
		]);

		const user = userEvent.setup();
		render(<ListEncountersForm />);

		await waitFor(() => {
			expect(patientService.getPatients).toHaveBeenCalled();
		});

		const [patientSelect, encounterTypeSelect] = screen.getAllByRole("combobox");

		await user.click(patientSelect);
		await user.click(await screen.findByRole("option", { name: /Paciente Uno/i }));

		await user.click(encounterTypeSelect);
		await user.click(await screen.findByRole("option", { name: /Consulta general/i }));

		setDateRange("2026-02-01", "2026-02-28");
		await user.click(screen.getByRole("button", { name: /Buscar/i }));

		await waitFor(() => {
			expect(doctorService.getClinicalEncounter).toHaveBeenCalledTimes(1);
		});

		const sentFilters = vi.mocked(doctorService.getClinicalEncounter).mock.calls[0][0];
		const expectedRange = buildIsoRange("2026-02-01", "2026-02-28");

		expect(sentFilters).toEqual({
			from: expectedRange.from,
			to: expectedRange.to,
			patientId: "patient-1",
			encounterType: EncounterType.Consultation,
		});

		await waitFor(() => {
			expect(patientService.getPatient).toHaveBeenCalledTimes(1);
			expect(patientService.getPatient).toHaveBeenCalledWith("patient-1");
		});

		expect(screen.getByText("Resultados (2)")).toBeInTheDocument();
		expect(screen.getAllByText("Paciente Uno Completo").length).toBeGreaterThan(0);
	});

	it("muestra toast y estado vacio cuando no hay resultados", async () => {
		vi.mocked(useAuthStore).mockReturnValue(buildAuthState(UserRole.PATIENT) as never);
		vi.mocked(doctorService.getClinicalEncounter).mockResolvedValue([]);
		const user = userEvent.setup();

		render(<ListEncountersForm />);
		setDateRange("2026-02-01", "2026-02-28");
		await user.click(screen.getByRole("button", { name: /Buscar/i }));

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith({
				title: "Sin resultados",
				description: "No se encontraron encuentros clinicos con los filtros seleccionados.",
			});
		});

		expect(
			screen.getByText("No se encontraron encuentros clinicos con los filtros actuales.")
		).toBeInTheDocument();
	});

	it("abre y cierra el dialogo de detalle con la informacion clinica", async () => {
		vi.mocked(useAuthStore).mockReturnValue(buildAuthState(UserRole.PATIENT) as never);
		vi.mocked(doctorService.getClinicalEncounter).mockResolvedValue([makeEncounter()]);
		const user = userEvent.setup();

		render(<ListEncountersForm />);
		setDateRange("2026-02-01", "2026-02-28");
		await user.click(screen.getByRole("button", { name: /Buscar/i }));

		await waitFor(() => {
			expect(screen.getByText("Resultados (1)")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: /Ver detalle/i }));

		expect(screen.getByText("Detalle completo del historial clinico")).toBeInTheDocument();
		expect(screen.getByText("R51")).toBeInTheDocument();
		expect(screen.getByText(/Paracetamol - 500 mg - Cada 8h/i)).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /Cerrar/i }));

		await waitFor(() => {
			expect(screen.queryByText("Detalle completo del historial clinico")).not.toBeInTheDocument();
		});
	});

	it("muestra mensaje de acceso denegado cuando el backend responde 403", async () => {
		vi.mocked(useAuthStore).mockReturnValue(buildAuthState(UserRole.PATIENT) as never);
		vi.mocked(doctorService.getClinicalEncounter).mockRejectedValue({
			isAxiosError: true,
			response: { status: 403 },
		});
		const user = userEvent.setup();

		render(<ListEncountersForm />);
		setDateRange("2026-02-01", "2026-02-28");
		await user.click(screen.getByRole("button", { name: /Buscar/i }));

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith({
				title: "Acceso denegado",
				description: "No tienes permisos para ver encuentros clinicos.",
				variant: "destructive",
			});
		});
	});

	it("limpia filtros, resultados y recarga pacientes al presionar Limpiar en modo doctor", async () => {
		vi.mocked(doctorService.getClinicalEncounter).mockResolvedValue([makeEncounter()]);
		const user = userEvent.setup();

		render(<ListEncountersForm />);
		await waitFor(() => {
			expect(patientService.getPatients).toHaveBeenCalledTimes(1);
		});

		setDateRange("2026-02-01", "2026-02-28");
		await user.click(screen.getByRole("button", { name: /Buscar/i }));

		await waitFor(() => {
			expect(screen.getByText("Resultados (1)")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: /Limpiar/i }));

		await waitFor(() => {
			expect(screen.queryByText("Resultados (1)")).not.toBeInTheDocument();
			expect(patientService.getPatients).toHaveBeenCalledTimes(2);
		});

		expect(
			screen.getByText("Selecciona un rango de fechas y busca para ver encuentros clinicos.")
		).toBeInTheDocument();
	});
});
