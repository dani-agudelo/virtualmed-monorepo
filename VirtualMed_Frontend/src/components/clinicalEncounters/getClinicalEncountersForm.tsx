"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
	ChevronLeft,
	ChevronRight,
	Eye,
	Loader2,
	Search,
	Stethoscope,
} from "lucide-react";

import { doctorService } from "@/lib/api/doctor.service";
import { patientService } from "@/lib/api/patient.service";
import { useAuthStore } from "@/store/auth.store";
import { useToast } from "@/hooks/use-toast";
import { UserRole } from "@/constants/userRole";
import { EncounterType } from "@/constants/encounterType";
import { DetailedClinicalEncounter } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

type EncounterTypeFilter = "all" | `${EncounterType}`;

interface PatientOption {
	id: string;
	fullName: string;
	document: string;
}

interface Filters {
	fromDate: string;
	toDate: string;
	encounterType: EncounterTypeFilter;
	patientId: string;
}

const EMPTY_FILTERS: Filters = {
	fromDate: "",
	toDate: "",
	encounterType: "all",
	patientId: "all",
};

const ENCOUNTER_TYPE_OPTIONS: Array<{ value: `${EncounterType}`; label: string }> = [
	{ value: `${EncounterType.Consultation}`, label: "Consulta general" },
	{ value: `${EncounterType.FollowUp}`, label: "Seguimiento" },
	{ value: `${EncounterType.Emergency}`, label: "Emergencia" },
	{ value: `${EncounterType.Telehealth}`, label: "Telemedicina" },
	{ value: `${EncounterType.Other}`, label: "Otro" },
];

function getEncounterTypeLabel(encounterType: EncounterType): string {
	const labels: Record<EncounterType, string> = {
		[EncounterType.Consultation]: "Consulta general",
		[EncounterType.FollowUp]: "Seguimiento",
		[EncounterType.Emergency]: "Emergencia",
		[EncounterType.Telehealth]: "Telemedicina",
		[EncounterType.Other]: "Otro",
	};
	return labels[encounterType] ?? "Sin definir";
}

function getEncounterTypeBadgeClass(encounterType: EncounterType): string {
	switch (encounterType) {
		case EncounterType.Consultation:
			return "bg-blue-100 text-blue-800 border-blue-200";
		case EncounterType.FollowUp:
			return "bg-sky-100 text-sky-800 border-sky-200";
		case EncounterType.Emergency:
			return "bg-red-100 text-red-800 border-red-200";
		case EncounterType.Telehealth:
			return "bg-cyan-100 text-cyan-800 border-cyan-200";
		case EncounterType.Other:
			return "bg-slate-100 text-slate-800 border-slate-200";
		default:
			return "bg-slate-100 text-slate-800 border-slate-200";
	}
}

function formatDateTime(value: string): string {
	return new Date(value).toLocaleString("es-ES", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function buildIsoRange(fromDate: string, toDate: string): { from: string; to: string } {
	const from = new Date(`${fromDate}T00:00:00`);
	const to = new Date(`${toDate}T23:59:59.999`);
	return {
		from: from.toISOString(),
		to: to.toISOString(),
	};
}

export function ListEncountersForm() {
	const { user, _hasHydrated } = useAuthStore();
	const { toast } = useToast();

	const isDoctor = user?.role === UserRole.DOCTOR;
	const isPatient = user?.role === UserRole.PATIENT;
	const canViewEncounters = isDoctor || isPatient;

	const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
	const [isLoading, setIsLoading] = useState(false);
	const [encounters, setEncounters] = useState<DetailedClinicalEncounter[]>([]);
	const [hasSearched, setHasSearched] = useState(false);
	const [patientNamesById, setPatientNamesById] = useState<Record<string, string>>({});
	const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
	const [selectedEncounter, setSelectedEncounter] = useState<DetailedClinicalEncounter | null>(null);

	const [patients, setPatients] = useState<PatientOption[]>([]);
	const [isLoadingPatients, setIsLoadingPatients] = useState(false);
	const [patientSearch, setPatientSearch] = useState("");
	const [patientPage, setPatientPage] = useState(1);
	const [patientTotalPages, setPatientTotalPages] = useState(1);
	const [selectedPatientName, setSelectedPatientName] = useState("");

	const loadPatients = useCallback(
		async (search: string, page: number) => {
			if (!isDoctor) return;

			try {
				setIsLoadingPatients(true);
				setPatientPage(page);

				const data = await patientService.getPatients({
					q: search || undefined,
					page: page.toString(),
				});

				setPatients(
					data.items.map((patient) => ({
						id: patient.id,
						fullName: patient.fullName,
						document: patient.document,
					}))
				);

				setPatientTotalPages(Math.ceil(data.totalCount / data.pageSize) || 1);
			} catch (error) {
				if (isAxiosError(error) && error.code === "ERR_CANCELED") return;
				if (error instanceof DOMException && error.name === "AbortError") return;

				toast({
					title: "Error",
					description: "No se pudieron cargar los pacientes.",
					variant: "destructive",
				});
			} finally {
				setIsLoadingPatients(false);
			}
		},
		[isDoctor, toast]
	);

	useEffect(() => {
		if (!isDoctor) return;
		loadPatients("", 1);
	}, [isDoctor, loadPatients]);

	const resultsTitle = useMemo(() => {
		if (!canViewEncounters) return "Encuentros clínicos";
		return isDoctor ? "Encuentros clínicos de mis pacientes" : "Mi historial clínico";
	}, [canViewEncounters, isDoctor]);

	const handleFilterChange = (field: keyof Filters, value: string) => {
		setFilters((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	const handlePatientSelection = (value: string) => {
		handleFilterChange("patientId", value);
		if (value === "all") {
			setSelectedPatientName("");
			return;
		}

		const selectedPatient = patients.find((patient) => patient.id === value);
		setSelectedPatientName(selectedPatient?.fullName ?? "");
	};

	const handleSearch = async () => {
		if (!filters.fromDate || !filters.toDate) {
			toast({
				title: "Validacion",
				description: "Debes ingresar fecha de inicio y fin.",
				variant: "destructive",
			});
			return;
		}

		if (new Date(filters.fromDate) > new Date(filters.toDate)) {
			toast({
				title: "Validacion",
				description: "La fecha de inicio no puede ser mayor a la fecha fin.",
				variant: "destructive",
			});
			return;
		}

		setIsLoading(true);
		setHasSearched(true);

		try {
			const range = buildIsoRange(filters.fromDate, filters.toDate);

			const queryParams: {
				patientId?: string;
				doctorId?: string;
				from?: string;
				to?: string;
				encounterType?: EncounterType;
			} = {
				from: range.from,
				to: range.to,
			};

			if (isDoctor && filters.patientId !== "all") {
				queryParams.patientId = filters.patientId;
			}

			if (filters.encounterType !== "all") {
				queryParams.encounterType = filters.encounterType as EncounterType;
			}

			const data = await doctorService.getClinicalEncounter(queryParams);
			setEncounters(data);

			if (isDoctor) {
				const uniquePatientIds = Array.from(new Set(data.map((encounter) => encounter.patientId)));
				const patientsInfo = await Promise.all(
					uniquePatientIds.map(async (patientId) => {
						try {
							const response = await patientService.getPatient(patientId);
							return [patientId, response.fullName || "Paciente sin nombre"] as const;
						} catch {
							return [patientId, "Paciente no disponible"] as const;
						}
					})
				);
				setPatientNamesById(Object.fromEntries(patientsInfo));
			}

			if (data.length === 0) {
				toast({
					title: "Sin resultados",
					description: "No se encontraron encuentros clinicos con los filtros seleccionados.",
				});
			}
		} catch (error) {
			if (isAxiosError(error)) {
				const status = error.response?.status;

				if (status === 403) {
					toast({
						title: "Acceso denegado",
						description: "No tienes permisos para ver encuentros clinicos.",
						variant: "destructive",
					});
				} else if (status === 429) {
					toast({
						title: "Demasiadas solicitudes",
						description: "Espera unos segundos e intenta nuevamente.",
						variant: "destructive",
					});
				} else {
					toast({
						title: "Error",
						description: error.response?.data?.message || "No se pudieron cargar los encuentros clinicos.",
						variant: "destructive",
					});
				}
			} else {
				toast({
					title: "Error",
					description: "Ocurrio un error inesperado.",
					variant: "destructive",
				});
			}
		} finally {
			setIsLoading(false);
		}
	};

	const handleReset = () => {
		setFilters(EMPTY_FILTERS);
		setEncounters([]);
		setHasSearched(false);
		setPatientNamesById({});
		setSelectedEncounter(null);
		setIsDetailDialogOpen(false);

		if (isDoctor) {
			setPatientSearch("");
			setPatientPage(1);
			setPatientTotalPages(1);
			setSelectedPatientName("");
			loadPatients("", 1);
		}
	};

	const openEncounterDetails = (encounter: DetailedClinicalEncounter) => {
		setSelectedEncounter(encounter);
		setIsDetailDialogOpen(true);
	};

	if (!_hasHydrated) {
		return null;
	}

	if (!canViewEncounters) {
		return (
			<div className="w-full p-6 pt-16">
				<Card className="border-red-200">
					<CardContent className="py-8">
						<p className="text-center text-sm text-red-700">
							No tienes permisos para acceder a esta seccion.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="w-full space-y-6 p-6 pt-16 bg-white">
			<div className="space-y-2">
				<div className="flex items-center gap-3">

					<h1 className="text-2xl font-bold text-blue-600">{resultsTitle}</h1>
				</div>
				<p className="text-sm text-slate-600">
					Filtra por fechas y tipo de encuentro para consultar la informacion clinica.
				</p>
			</div>

			<Card className="border-blue-100 shadow-sm">
				<CardHeader>
					<CardTitle className="text-lg flex items-center gap-2">
						<Search className="h-5 w-5" />
						Filtros de búsqueda
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{isDoctor && (
						<div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-3">
							<label className="text-sm font-medium text-slate-800">Paciente</label>

							<div className="relative flex gap-2">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
								<Input
									type="text"
									placeholder="Buscar paciente por nombre..."
									value={patientSearch}
									onChange={(event) => setPatientSearch(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											event.preventDefault();
											void loadPatients(patientSearch, 1);
										}
									}}
									className="pl-10 flex-1"
									disabled={isLoadingPatients}
								/>
								<Button
									type="button"
									variant="outline"
									onClick={() => loadPatients(patientSearch, 1)}
									disabled={isLoadingPatients}
									className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
								>
									{isLoadingPatients ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
								</Button>
							</div>

							<div className="flex gap-2 items-center">
								<Select
									value={filters.patientId}
									onValueChange={handlePatientSelection}
									disabled={isLoadingPatients}
								>
									<SelectTrigger className="flex-1">
										<SelectValue
											placeholder={
												isLoadingPatients
													? "Buscando pacientes..."
													: selectedPatientName || "Selecciona un paciente"
											}
										/>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">Todos los pacientes</SelectItem>
										{patients.map((patient) => (
											<SelectItem key={patient.id} value={patient.id}>
												<div className="flex flex-col">
													<span>{patient.fullName}</span>
													<span className="text-xs text-slate-500">Doc: {patient.document}</span>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								<Button
									type="button"
									variant="outline"
									size="icon"
									onClick={() => loadPatients(patientSearch, patientPage - 1)}
									disabled={patientPage <= 1 || isLoadingPatients}
								>
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<span className="text-sm min-w-[3.5rem] text-center text-slate-600">
									{patientPage}/{patientTotalPages}
								</span>
								<Button
									type="button"
									variant="outline"
									size="icon"
									onClick={() => loadPatients(patientSearch, patientPage + 1)}
									disabled={patientPage >= patientTotalPages || isLoadingPatients}
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
						<div className="space-y-2">
							<label className="text-sm font-medium text-slate-800">Fecha inicio *</label>
							<Input
								type="date"
								value={filters.fromDate}
								onChange={(event) => handleFilterChange("fromDate", event.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium text-slate-800">Fecha fin *</label>
							<Input
								type="date"
								value={filters.toDate}
								onChange={(event) => handleFilterChange("toDate", event.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium text-slate-800">Tipo de encuentro</label>
							<Select
								value={filters.encounterType}
								onValueChange={(value) => handleFilterChange("encounterType", value)}
							>
								<SelectTrigger>
									<SelectValue placeholder="Todos los tipos" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">Todos los tipos</SelectItem>
									{ENCOUNTER_TYPE_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="flex items-end gap-2">
							<Button
								type="button"
								onClick={handleSearch}
								disabled={isLoading}
								className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
							>
								{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								{isLoading ? "Buscando..." : "Buscar"}
							</Button>
							<Button type="button" variant="outline" onClick={handleReset}>
								Limpiar
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{encounters.length > 0 && (
				<Card className="border-slate-200">
					<CardHeader>
						<CardTitle className="text-blue-600">
							Resultados ({encounters.length})
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										{isDoctor && <TableHead>Paciente</TableHead>}
										<TableHead>Tipo</TableHead>
										<TableHead>Inicio</TableHead>
										<TableHead>Fin</TableHead>
										<TableHead>Motivo</TableHead>
										<TableHead>Diagnosticos</TableHead>
										<TableHead>Acciones</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{encounters.map((encounter) => (
										<TableRow key={encounter.id}>
											{isDoctor && (
												<TableCell className="font-medium text-slate-900">
													{patientNamesById[encounter.patientId] || "Paciente no disponible"}
												</TableCell>
											)}
											<TableCell>
												<Badge className={getEncounterTypeBadgeClass(encounter.encounterType)}>
													{getEncounterTypeLabel(encounter.encounterType)}
												</Badge>
											</TableCell>
											<TableCell>{formatDateTime(encounter.startAt)}</TableCell>
											<TableCell>{formatDateTime(encounter.endAt)}</TableCell>
											<TableCell className="max-w-xs truncate" title={encounter.chiefComplaint}>
												{encounter.chiefComplaint || "-"}
											</TableCell>
											<TableCell>{encounter.diagnoses?.length ?? 0}</TableCell>
											<TableCell>
												<Button
													type="button"
													variant="outline"
													className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
													size="sm"
													onClick={() => openEncounterDetails(encounter)}
												>
													Ver detalle
													<Eye className="h-4 w-4" />
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>
			)}

			<Dialog
				open={isDetailDialogOpen}
				onOpenChange={(open) => {
					setIsDetailDialogOpen(open);
					if (!open) setSelectedEncounter(null);
				}}
			>
				<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="text-blue-600 font-bold">Detalle completo del historial clinico</DialogTitle>
						<DialogDescription>
							Revisa toda la informacion registrada para este encuentro.
						</DialogDescription>
					</DialogHeader>

					{selectedEncounter && (
						<div className="space-y-4">
							{isDoctor && (
								<div className="rounded-md border border-blue-100 bg-blue-50/40 p-3">
									<p className="text-xs text-slate-500">Paciente</p>
									<p className="text-sm font-semibold text-slate-900">
										{patientNamesById[selectedEncounter.patientId] || "Paciente no disponible"}
									</p>
								</div>
							)}

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="rounded-md border p-3">
									<p className="text-xs text-slate-500">Tipo de encuentro</p>
									<Badge className={`mt-2 ${getEncounterTypeBadgeClass(selectedEncounter.encounterType)}`}>
										{getEncounterTypeLabel(selectedEncounter.encounterType)}
									</Badge>
								</div>
								<div className="rounded-md border p-3">
									<p className="text-xs text-slate-500">Inicio / Fin</p>
									<p className="mt-2 text-sm text-slate-900">{formatDateTime(selectedEncounter.startAt)}</p>
									<p className="text-sm text-slate-900">{formatDateTime(selectedEncounter.endAt)}</p>
								</div>
							</div>

							<div className="rounded-md border p-3 space-y-2">
								<p className="text-xs text-slate-500">Motivo de consulta</p>
								<p className="text-sm text-slate-900 whitespace-pre-wrap">
									{selectedEncounter.chiefComplaint || "-"}
								</p>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="rounded-md border p-3">
									<p className="text-xs text-slate-500">Condicion actual</p>
									<p className="text-sm text-slate-900 whitespace-pre-wrap">{selectedEncounter.currentCondition || "-"}</p>
								</div>
								<div className="rounded-md border p-3">
									<p className="text-xs text-slate-500">Examen fisico</p>
									<p className="text-sm text-slate-900 whitespace-pre-wrap">{selectedEncounter.physicalExam || "-"}</p>
								</div>
								<div className="rounded-md border p-3">
									<p className="text-xs text-slate-500">Evaluacion</p>
									<p className="text-sm text-slate-900 whitespace-pre-wrap">{selectedEncounter.assessment || "-"}</p>
								</div>
								<div className="rounded-md border p-3">
									<p className="text-xs text-slate-500">Plan</p>
									<p className="text-sm text-slate-900 whitespace-pre-wrap">{selectedEncounter.plan || "-"}</p>
								</div>
							</div>

							<div className="rounded-md border p-3 space-y-2">
								<p className="text-xs text-slate-500">Notas</p>
								<p className="text-sm text-slate-900 whitespace-pre-wrap">{selectedEncounter.notes || "-"}</p>
							</div>

							<div className="rounded-md border p-3">
								<p className="text-xs text-slate-500 mb-2">Diagnosticos</p>
								{selectedEncounter.diagnoses.length === 0 ? (
									<p className="text-sm text-slate-600">Sin diagnosticos registrados.</p>
								) : (
									<div className="space-y-2">
										{selectedEncounter.diagnoses.map((diagnosis) => (
											<div key={diagnosis.id} className="rounded-md border border-slate-200 p-2">
												<p className="text-sm font-semibold text-blue-600">{diagnosis.icd10Code}</p>
												<p className="text-sm text-slate-700">{diagnosis.description}</p>
												<p className="text-xs text-slate-500">Tipo: {diagnosis.type}</p>
											</div>
										))}
									</div>
								)}
							</div>

							<div className="rounded-md border p-3">
								<p className="text-xs text-slate-500 mb-2">Prescripciones</p>
								{!selectedEncounter.prescriptions || selectedEncounter.prescriptions.length === 0 ? (
									<p className="text-sm text-slate-600">Sin prescripciones asociadas.</p>
								) : (
									<div className="space-y-3">
										{selectedEncounter.prescriptions.map((prescription) => (
											<div key={prescription.id} className="rounded-md border border-slate-200 p-3 space-y-2">
												<p className="text-sm font-semibold text-blue-600">#{prescription.prescriptionNumber}</p>
												<p className="text-xs text-slate-600">
													Emitida: {formatDateTime(prescription.issuedAt)} | Vigencia: {formatDateTime(prescription.validUntil)}
												</p>
												<div className="space-y-1">
													{prescription.medications.map((medication) => (
														<p key={medication.medicationId || `${prescription.id}-${medication.medicationName}`} className="text-sm text-slate-700">
															{medication.medicationName} - {medication.dosage} - {medication.frequency} ({medication.durationDays} dias)
														</p>
													))}
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						</div>
					)}

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
							onClick={() => {
								setIsDetailDialogOpen(false);
								setSelectedEncounter(null);
							}}
						>
							Cerrar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{encounters.length === 0 && (
				<Card>
					<CardContent className="py-12">
						<p className="text-center text-slate-500">
							{hasSearched
								? "No se encontraron encuentros clinicos con los filtros actuales."
								: "Selecciona un rango de fechas y busca para ver encuentros clinicos."}
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

export default ListEncountersForm;
