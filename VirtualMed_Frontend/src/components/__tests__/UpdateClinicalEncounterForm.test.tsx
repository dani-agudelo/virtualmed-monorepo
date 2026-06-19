import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import UpdateClinicalEncounterForm from "../clinicalEncounters/updateClinicalEncounterForm";
import { doctorService } from "@/lib/api/doctor.service";
import { adminService } from "@/lib/api/admin.service";
import { patientService } from "@/lib/api/patient.service";
import { useToast } from "@/hooks/use-toast";
import { EncounterType } from "@/constants/encounterType";
import { DiagnosisType } from "@/constants/diagnosisType";
import { DetailedClinicalEncounter } from "@/types";

vi.mock("@/lib/api/doctor.service", () => ({
	doctorService: {
		getDoctors: vi.fn(),
		getClinicalEncounter: vi.fn(),
	},
}));

vi.mock("@/lib/api/admin.service", () => ({
	adminService: {
		updateClinicalEncounter: vi.fn(),
	},
}));

vi.mock("@/lib/api/patient.service", () => ({
	patientService: {
		getPatient: vi.fn(),
	},
}));

vi.mock("@/hooks/use-toast", () => ({
	useToast: vi.fn(),
}));

const mockToast = vi.fn();

const doctorsPageResponse = {
	items: [
		{ id: "doc-1", fullName: "Dra. Ana Ruiz", professionalLicense: "MED-123" },
		{ id: "doc-2", fullName: "Dr. Luis Soto", professionalLicense: "MED-456" },
	],
	page: 1,
	pageSize: 10,
	totalCount: 20,
};

const makeEncounter = (overrides: Partial<DetailedClinicalEncounter> = {}): DetailedClinicalEncounter => ({
	id: "enc-1",
	appointmentId: "apt-1",
	patientId: "patient-1",
	doctorId: "doc-1",
	encounterType: EncounterType.Consultation,
	startAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
	endAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
	chiefComplaint: "Dolor toracico intermitente",
	currentCondition: "Estable",
	physicalExam: "Sin hallazgos patologicos",
	assessment: "Control evolutivo",
	plan: "Continuar monitoreo",
	notes: "Volver en 48 horas",
	recordingUrl: null,
	isLocked: false,
	diagnoses: [
		{
			id: "diag-1",
			icd10Code: "R07.4",
			description: "Dolor toracico",
			type: DiagnosisType.PRIMARY,
		},
	],
	...overrides,
});

function setDateRange(fromDate: string, toDate: string) {
	const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
	expect(dateInputs).toHaveLength(2);

	fireEvent.change(dateInputs[0], { target: { value: fromDate } });
	fireEvent.change(dateInputs[1], { target: { value: toDate } });
}

async function selectDoctor(user: ReturnType<typeof userEvent.setup>, doctorLabel = /Dra. Ana Ruiz/i) {
	await user.click(screen.getByRole("combobox"));
	await user.click(await screen.findByRole("option", { name: doctorLabel }));
}

function buildIsoRange(fromDate: string, toDate: string) {
	return {
		from: new Date(`${fromDate}T00:00:00`).toISOString(),
		to: new Date(`${toDate}T23:59:59.999`).toISOString(),
	};
}

async function runSearchFlow(user: ReturnType<typeof userEvent.setup>, fromDate = "2026-04-01", toDate = "2026-04-30") {
	await selectDoctor(user);
	setDateRange(fromDate, toDate);
	await user.click(screen.getByRole("button", { name: /Buscar/i }));
}

describe("UpdateClinicalEncounterForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		vi.mocked(useToast).mockReturnValue({ toast: mockToast } as never);
		vi.mocked(doctorService.getDoctors).mockResolvedValue(doctorsPageResponse as never);
		vi.mocked(doctorService.getClinicalEncounter).mockResolvedValue([]);
		vi.mocked(patientService.getPatient).mockResolvedValue({ fullName: "Paciente Uno" } as never);
		vi.mocked(adminService.updateClinicalEncounter).mockResolvedValue(undefined);
	});

	it("carga doctores al montar y muestra el estado inicial", async () => {
		render(<UpdateClinicalEncounterForm />);

		await waitFor(() => {
			expect(doctorService.getDoctors).toHaveBeenCalledWith(
				expect.objectContaining({ q: undefined, page: "1" })
			);
		});

		expect(screen.getByText("Actualizar encuentros clinicos")).toBeInTheDocument();
		expect(screen.getByText("Selecciona doctor y fechas para listar encuentros clinicos.")).toBeInTheDocument();
	});

	it("muestra error si se intenta buscar sin seleccionar doctor", async () => {
		const user = userEvent.setup();
		render(<UpdateClinicalEncounterForm />);

		setDateRange("2026-04-01", "2026-04-30");
		await user.click(screen.getByRole("button", { name: /Buscar/i }));

		expect(mockToast).toHaveBeenCalledWith({
			title: "Validacion",
			description: "Debes seleccionar un doctor.",
			variant: "destructive",
		});
		expect(doctorService.getClinicalEncounter).not.toHaveBeenCalled();
	});

	it("muestra error si faltan fechas", async () => {
		const user = userEvent.setup();
		render(<UpdateClinicalEncounterForm />);

		await selectDoctor(user);
		await user.click(screen.getByRole("button", { name: /Buscar/i }));

		expect(mockToast).toHaveBeenCalledWith({
			title: "Validacion",
			description: "Debes ingresar fecha de inicio y fin.",
			variant: "destructive",
		});
		expect(doctorService.getClinicalEncounter).not.toHaveBeenCalled();
	});

	it("muestra error cuando la fecha inicial es mayor a la final", async () => {
		const user = userEvent.setup();
		render(<UpdateClinicalEncounterForm />);

		await selectDoctor(user);
		setDateRange("2026-04-30", "2026-04-01");
		await user.click(screen.getByRole("button", { name: /Buscar/i }));

		expect(mockToast).toHaveBeenCalledWith({
			title: "Validacion",
			description: "La fecha de inicio no puede ser mayor a la fecha de fin.",
			variant: "destructive",
		});
		expect(doctorService.getClinicalEncounter).not.toHaveBeenCalled();
	});

	it("busca encuentros con filtros correctos y resuelve pacientes unicos", async () => {
		const user = userEvent.setup();
		vi.mocked(doctorService.getClinicalEncounter).mockResolvedValue([
			makeEncounter({ id: "enc-1", patientId: "patient-1" }),
			makeEncounter({ id: "enc-2", appointmentId: "apt-2", patientId: "patient-2", chiefComplaint: "Cefalea" }),
			makeEncounter({ id: "enc-3", appointmentId: "apt-3", patientId: "patient-1", chiefComplaint: "Control" }),
		]);

		vi.mocked(patientService.getPatient).mockImplementation(async (patientId: string) => {
			if (patientId === "patient-1") return { fullName: "Paciente Uno" } as never;
			return { fullName: "Paciente Dos" } as never;
		});

		render(<UpdateClinicalEncounterForm />);
		await runSearchFlow(user);

		const expectedRange = buildIsoRange("2026-04-01", "2026-04-30");

		await waitFor(() => {
			expect(doctorService.getClinicalEncounter).toHaveBeenCalledWith({
				doctorId: "doc-1",
				from: expectedRange.from,
				to: expectedRange.to,
			});
		});

		await waitFor(() => {
			expect(patientService.getPatient).toHaveBeenCalledTimes(2);
			expect(patientService.getPatient).toHaveBeenCalledWith("patient-1");
			expect(patientService.getPatient).toHaveBeenCalledWith("patient-2");
		});

		expect(screen.getByText("Resultados (3)")).toBeInTheDocument();
		expect(screen.getAllByText("Paciente Uno").length).toBeGreaterThan(0);
		expect(screen.getByText("Paciente Dos")).toBeInTheDocument();
		expect(screen.getByText("Cefalea")).toBeInTheDocument();
	});

	it("muestra estado vacio y toast cuando no hay resultados", async () => {
		const user = userEvent.setup();
		vi.mocked(doctorService.getClinicalEncounter).mockResolvedValue([]);

		render(<UpdateClinicalEncounterForm />);
		await runSearchFlow(user);

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith({
				title: "Sin resultados",
				description: "No se encontraron encuentros clinicos para los filtros seleccionados.",
			});
		});

		expect(screen.getByText("No se encontraron encuentros clinicos para los filtros seleccionados.")).toBeInTheDocument();
	});

	it("muestra error de acceso denegado cuando la busqueda responde 403", async () => {
		const user = userEvent.setup();
		vi.mocked(doctorService.getClinicalEncounter).mockRejectedValue({
			isAxiosError: true,
			response: { status: 403 },
		});

		render(<UpdateClinicalEncounterForm />);
		await runSearchFlow(user);

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith({
				title: "Acceso denegado",
				description: "No tienes permiso para consultar encuentros clinicos.",
				variant: "destructive",
			});
		});
	});

	it("deshabilita la edicion cuando el encuentro supera la ventana de 24 horas", async () => {
		const user = userEvent.setup();
		const expiredEndAt = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
		vi.mocked(doctorService.getClinicalEncounter).mockResolvedValue([
			makeEncounter({ endAt: expiredEndAt }),
		]);

		render(<UpdateClinicalEncounterForm />);
		await runSearchFlow(user);

		await waitFor(() => {
			expect(screen.getByText("Resultados (1)")).toBeInTheDocument();
		});

		const editButton = screen.getByRole("button", { name: /Editar/i });
		expect(editButton).toBeDisabled();
	});

	it("actualiza el encuentro con payload normalizado y cierra el dialogo", async () => {
		const user = userEvent.setup();
		vi.mocked(doctorService.getClinicalEncounter).mockResolvedValue([makeEncounter()]);

		render(<UpdateClinicalEncounterForm />);
		await runSearchFlow(user);

		await waitFor(() => {
			expect(screen.getByText("Resultados (1)")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: /Editar/i }));

		const dialog = await screen.findByRole("dialog");
		await user.click(within(dialog).getByRole("combobox"));
		await user.click(await screen.findByRole("option", { name: /Emergencia/i }));

		const complaintInput = within(dialog).getByLabelText(/Motivo de consulta/i);
		await user.clear(complaintInput);
		await user.type(complaintInput, "Dolor abdominal agudo");

		const dateTimeInputs = dialog.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
		expect(dateTimeInputs).toHaveLength(2);

		fireEvent.change(dateTimeInputs[0], { target: { value: "2026-04-20T09:00" } });
		fireEvent.change(dateTimeInputs[1], { target: { value: "2026-04-20T10:00" } });

		const currentCondition = within(dialog).getByLabelText(/Condicion actual/i);
		await user.clear(currentCondition);
		await user.type(currentCondition, "   ");

		const physicalExam = within(dialog).getByLabelText(/Examen fisico/i);
		await user.clear(physicalExam);
		await user.type(physicalExam, "Examen actualizado");

		const assessment = within(dialog).getByLabelText(/Evaluacion/i);
		await user.clear(assessment);

		const plan = within(dialog).getByLabelText(/Plan/i);
		await user.clear(plan);
		await user.type(plan, "Plan nuevo");

		const notes = within(dialog).getByLabelText(/Notas/i);
		await user.clear(notes);
		await user.type(notes, "   ");

		await user.click(within(dialog).getByRole("button", { name: /Guardar cambios/i }));

		await waitFor(() => {
			expect(adminService.updateClinicalEncounter).toHaveBeenCalledTimes(1);
		});

		expect(adminService.updateClinicalEncounter).toHaveBeenCalledWith("enc-1", {
			encounterType: EncounterType.Emergency,
			startAt: new Date("2026-04-20T09:00").toISOString(),
			endAt: new Date("2026-04-20T10:00").toISOString(),
			chiefComplaint: "Dolor abdominal agudo",
			currentCondition: null,
			physicalExam: "Examen actualizado",
			assessment: null,
			plan: "Plan nuevo",
			notes: null,
		});

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith({
				title: "Exito",
				description: "El encuentro clinico fue actualizado correctamente.",
			});
		});

		await waitFor(() => {
			expect(screen.queryByText("Editar encuentro clinico")).not.toBeInTheDocument();
		});

		expect(screen.getByText("Dolor abdominal agudo")).toBeInTheDocument();
	});

	it("evita guardar cuando la fecha de fin no es posterior al inicio", async () => {
		const user = userEvent.setup();
		vi.mocked(doctorService.getClinicalEncounter).mockResolvedValue([makeEncounter()]);

		render(<UpdateClinicalEncounterForm />);
		await runSearchFlow(user);

		await user.click(await screen.findByRole("button", { name: /Editar/i }));

		const dialog = await screen.findByRole("dialog");
		const dateTimeInputs = dialog.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
		expect(dateTimeInputs).toHaveLength(2);

		fireEvent.change(dateTimeInputs[0], { target: { value: "2026-04-20T10:00" } });
		fireEvent.change(dateTimeInputs[1], { target: { value: "2026-04-20T09:00" } });

		await user.click(within(dialog).getByRole("button", { name: /Guardar cambios/i }));

		await waitFor(() => {
			expect(screen.getByText("La fecha/hora de fin debe ser posterior a la fecha/hora de inicio")).toBeInTheDocument();
		});

		expect(adminService.updateClinicalEncounter).not.toHaveBeenCalled();
	});

	it("muestra error backend al actualizar y mantiene abierto el dialogo", async () => {
		const user = userEvent.setup();
		vi.mocked(doctorService.getClinicalEncounter).mockResolvedValue([makeEncounter()]);
		vi.mocked(adminService.updateClinicalEncounter).mockRejectedValue({
			isAxiosError: true,
			response: { data: { message: "No autorizado por politica" } },
		});

		render(<UpdateClinicalEncounterForm />);
		await runSearchFlow(user);

		await user.click(await screen.findByRole("button", { name: /Editar/i }));

		const dialog = await screen.findByRole("dialog");
		await user.click(within(dialog).getByRole("button", { name: /Guardar cambios/i }));

		await waitFor(() => {
			expect(mockToast).toHaveBeenCalledWith({
				title: "Error",
				description: "No autorizado por politica",
				variant: "destructive",
			});
		});

		expect(screen.getByText("Editar encuentro clinico")).toBeInTheDocument();
	});

	it("limpia filtros, resultados y vuelve a cargar doctores al presionar Limpiar", async () => {
		const user = userEvent.setup();
		vi.mocked(doctorService.getClinicalEncounter).mockResolvedValue([makeEncounter()]);

		render(<UpdateClinicalEncounterForm />);
		await runSearchFlow(user);

		await waitFor(() => {
			expect(screen.getByText("Resultados (1)")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: /Limpiar/i }));

		await waitFor(() => {
			expect(screen.queryByText("Resultados (1)")).not.toBeInTheDocument();
			expect(screen.getByText("Selecciona doctor y fechas para listar encuentros clinicos.")).toBeInTheDocument();
			expect(doctorService.getDoctors).toHaveBeenCalledTimes(2);
		});
	});
});
