"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Search } from "lucide-react";

import { doctorService } from "@/lib/api/doctor.service";
import { adminService } from "@/lib/api/admin.service";
import { patientService } from "@/lib/api/patient.service";
import { EncounterType } from "@/constants/encounterType";
import { useToast } from "@/hooks/use-toast";
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
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

interface DoctorOption {
	id: string;
	fullName: string;
	professionalLicense: string;
}

interface SearchFilters {
	doctorId: string;
	fromDate: string;
	toDate: string;
}

const EMPTY_FILTERS: SearchFilters = {
	doctorId: "",
	fromDate: "",
	toDate: "",
};

const ENCOUNTER_TYPE_OPTIONS: Array<{ value: EncounterType; label: string }> = [
	{ value: EncounterType.Consultation, label: "Consulta general" },
	{ value: EncounterType.FollowUp, label: "Seguimiento" },
	{ value: EncounterType.Emergency, label: "Emergencia" },
	{ value: EncounterType.Telehealth, label: "Telemedicina" },
	{ value: EncounterType.Other, label: "Otro" },
];

const UPDATE_WINDOW_MS = 24 * 60 * 60 * 1000;

const editEncounterSchema = z
	.object({
		encounterType: z.nativeEnum(EncounterType, {
			errorMap: () => ({ message: "Debes seleccionar el tipo de encuentro" }),
		}),
		startAt: z.string().min(1, "La fecha/hora de inicio es requerida"),
		endAt: z.string().min(1, "La fecha/hora de fin es requerida"),
		chiefComplaint: z
			.string()
			.min(5, "El motivo debe tener al menos 5 caracteres")
			.max(1000, "El motivo no puede exceder 1000 caracteres"),
		currentCondition: z.string().max(1000, "Maximo 1000 caracteres").optional(),
		physicalExam: z.string().max(1000, "Maximo 1000 caracteres").optional(),
		assessment: z.string().max(1000, "Maximo 1000 caracteres").optional(),
		plan: z.string().max(1000, "Maximo 1000 caracteres").optional(),
		notes: z.string().max(1000, "Maximo 1000 caracteres").optional(),
	})
	.refine(
		(values) => {
			const start = new Date(values.startAt).getTime();
			const end = new Date(values.endAt).getTime();
			return Number.isFinite(start) && Number.isFinite(end) && end > start;
		},
		{
			message: "La fecha/hora de fin debe ser posterior a la fecha/hora de inicio",
			path: ["endAt"],
		}
	);

type EditEncounterValues = z.infer<typeof editEncounterSchema>;

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

function toDateTimeLocalInput(value: string): string {
	const date = new Date(value);
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
}

function toNullableText(value?: string): string | null {
	if (!value) return null;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
}

function isEditExpired(endAt: string): boolean {
	const end = new Date(endAt).getTime();
	if (!Number.isFinite(end)) return true;
	return Date.now() - end > UPDATE_WINDOW_MS;
}

export function UpdateClinicalEncounterForm() {
	const { toast } = useToast();

	const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);

	const [doctorSearch, setDoctorSearch] = useState("");
	const [doctors, setDoctors] = useState<DoctorOption[]>([]);
	const [doctorPage, setDoctorPage] = useState(1);
	const [doctorTotalPages, setDoctorTotalPages] = useState(1);
	const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
	const [selectedDoctorName, setSelectedDoctorName] = useState("");

	const [encounters, setEncounters] = useState<DetailedClinicalEncounter[]>([]);
	const [patientNamesById, setPatientNamesById] = useState<Record<string, string>>({});
	const [isSearching, setIsSearching] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);

	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [selectedEncounter, setSelectedEncounter] = useState<DetailedClinicalEncounter | null>(null);
	const [isUpdating, setIsUpdating] = useState(false);

	const form = useForm<EditEncounterValues>({
		resolver: zodResolver(editEncounterSchema),
		defaultValues: {
			encounterType: EncounterType.Consultation,
			startAt: "",
			endAt: "",
			chiefComplaint: "",
			currentCondition: "",
			physicalExam: "",
			assessment: "",
			plan: "",
			notes: "",
		},
		mode: "onChange",
	});

	const loadDoctors = useCallback(
		async (search: string, page: number) => {
			try {
				setIsLoadingDoctors(true);
				setDoctorPage(page);

				const data = await doctorService.getDoctors({
					q: search || undefined,
					page: page.toString(),
				});

				setDoctors(
					data.items.map((doctor) => ({
						id: doctor.id,
						fullName: doctor.fullName,
						professionalLicense: doctor.professionalLicense,
					}))
				);
				setDoctorTotalPages(Math.ceil(data.totalCount / data.pageSize) || 1);
			} catch (error) {
				if (isAxiosError(error) && error.code === "ERR_CANCELED") return;
				if (error instanceof DOMException && error.name === "AbortError") return;

				toast({
					title: "Error",
					description: "No se pudieron cargar los doctores.",
					variant: "destructive",
				});
			} finally {
				setIsLoadingDoctors(false);
			}
		},
		[toast]
	);

	useEffect(() => {
		loadDoctors("", 1);
	}, [loadDoctors]);

	const selectedDoctorLabel = useMemo(() => {
		if (!filters.doctorId) return "";
		const found = doctors.find((doctor) => doctor.id === filters.doctorId);
		return found?.fullName ?? selectedDoctorName;
	}, [doctors, filters.doctorId, selectedDoctorName]);

	const handleDoctorSelection = (doctorId: string) => {
		setFilters((previous) => ({ ...previous, doctorId }));
		const found = doctors.find((doctor) => doctor.id === doctorId);
		setSelectedDoctorName(found?.fullName ?? "");
	};

	const handleSearch = async () => {
		if (!filters.doctorId) {
			toast({
				title: "Validacion",
				description: "Debes seleccionar un doctor.",
				variant: "destructive",
			});
			return;
		}

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
				description: "La fecha de inicio no puede ser mayor a la fecha de fin.",
				variant: "destructive",
			});
			return;
		}

		setIsSearching(true);
		setHasSearched(true);

		try {
			const from = new Date(`${filters.fromDate}T00:00:00`).toISOString();
			const to = new Date(`${filters.toDate}T23:59:59.999`).toISOString();

			const data = await doctorService.getClinicalEncounter({
				doctorId: filters.doctorId,
				from,
				to,
			});

			setEncounters(data);

			const uniquePatientIds = Array.from(new Set(data.map((encounter) => encounter.patientId)));
			const patientsInfo = await Promise.all(
				uniquePatientIds.map(async (patientId) => {
					try {
						const response = await patientService.getPatient(patientId);
						const patientName = (response as any).fullname || response.fullName || "Paciente no disponible";
						return [patientId, patientName] as const;
					} catch {
						return [patientId, "Paciente no disponible"] as const;
					}
				})
			);
			setPatientNamesById(Object.fromEntries(patientsInfo));

			if (data.length === 0) {
				toast({
					title: "Sin resultados",
					description: "No se encontraron encuentros clinicos para los filtros seleccionados.",
				});
			}
		} catch (error) {
			if (isAxiosError(error)) {
				const status = error.response?.status;
				if (status === 403) {
					toast({
						title: "Acceso denegado",
						description: "No tienes permiso para consultar encuentros clinicos.",
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
			setIsSearching(false);
		}
	};

	const openEditDialog = (encounter: DetailedClinicalEncounter) => {
		setSelectedEncounter(encounter);
		form.reset({
			encounterType: encounter.encounterType,
			startAt: toDateTimeLocalInput(encounter.startAt),
			endAt: toDateTimeLocalInput(encounter.endAt),
			chiefComplaint: encounter.chiefComplaint || "",
			currentCondition: encounter.currentCondition || "",
			physicalExam: encounter.physicalExam || "",
			assessment: encounter.assessment || "",
			plan: encounter.plan || "",
			notes: encounter.notes || "",
		});
		setIsEditDialogOpen(true);
	};

	const handleUpdateEncounter = async (values: EditEncounterValues) => {
		if (!selectedEncounter) return;

		if (isEditExpired(selectedEncounter.endAt)) {
			toast({
				title: "Edicion no permitida",
				description: "No se puede editar porque han pasado mas de 24 horas desde que termino el encuentro.",
				variant: "destructive",
			});
			setIsEditDialogOpen(false);
			setSelectedEncounter(null);
			return;
		}

		setIsUpdating(true);

		try {
			const payload = {
				encounterType: values.encounterType,
				startAt: new Date(values.startAt).toISOString(),
				endAt: new Date(values.endAt).toISOString(),
				chiefComplaint: values.chiefComplaint,
				currentCondition: toNullableText(values.currentCondition),
				physicalExam: toNullableText(values.physicalExam),
				assessment: toNullableText(values.assessment),
				plan: toNullableText(values.plan),
				notes: toNullableText(values.notes),
			};

			await adminService.updateClinicalEncounter(selectedEncounter.id, payload);

			setEncounters((previous) =>
				previous.map((encounter) =>
					encounter.id === selectedEncounter.id
						? {
								...encounter,
								...payload,
							}
						: encounter
				)
			);

			toast({
				title: "Exito",
				description: "El encuentro clinico fue actualizado correctamente.",
			});

			setIsEditDialogOpen(false);
			setSelectedEncounter(null);
		} catch (error) {
			if (isAxiosError(error)) {
				toast({
					title: "Error",
					description: error.response?.data?.message || "No se pudo actualizar el encuentro clinico.",
					variant: "destructive",
				});
			} else {
				toast({
					title: "Error",
					description: "Ocurrio un error inesperado.",
					variant: "destructive",
				});
			}
		} finally {
			setIsUpdating(false);
		}
	};

	const handleReset = () => {
		setFilters(EMPTY_FILTERS);
		setEncounters([]);
		setPatientNamesById({});
		setHasSearched(false);
		setSelectedDoctorName("");
		setDoctorSearch("");
		setDoctorPage(1);
		setDoctorTotalPages(1);
		loadDoctors("", 1);
	};

	return (
		<div className="w-full space-y-6 p-6 pt-16 bg-white">
			<div className="space-y-2">
				<h1 className="text-2xl font-bold text-slate-900">Actualizar encuentros clinicos</h1>
				<p className="text-sm text-slate-600">
					Busca por doctor y rango de fechas para editar encuentros clinicos.
				</p>
			</div>

			<Card className="border-blue-100 shadow-sm">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-blue-700">
						<Search className="h-5 w-5" />
						Filtros de busqueda
					</CardTitle>
					<CardDescription>
						La edicion solo esta disponible durante las primeras 24 horas despues de finalizar el encuentro.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-3">
						<label className="text-sm font-medium text-slate-800">Doctor *</label>

						<div className="relative flex gap-2">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
							<Input
								type="text"
								placeholder="Buscar doctor por nombre..."
								value={doctorSearch}
								onChange={(event) => setDoctorSearch(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										void loadDoctors(doctorSearch, 1);
									}
								}}
								className="pl-10 flex-1"
								disabled={isLoadingDoctors}
							/>
							<Button
								type="button"
								variant="outline"
								onClick={() => loadDoctors(doctorSearch, 1)}
								disabled={isLoadingDoctors}
								className="border-blue-200"
							>
								{isLoadingDoctors ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
							</Button>
						</div>

						<div className="flex gap-2 items-center">
							<Select value={filters.doctorId} onValueChange={handleDoctorSelection} disabled={isLoadingDoctors}>
								<SelectTrigger className="flex-1">
									<SelectValue
										placeholder={
											isLoadingDoctors
												? "Buscando doctores..."
												: selectedDoctorLabel || "Selecciona un doctor"
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{doctors.map((doctor) => (
										<SelectItem key={doctor.id} value={doctor.id}>
											<div className="flex flex-col">
												<span>{doctor.fullName}</span>
												<span className="text-xs text-slate-500">Lic: {doctor.professionalLicense}</span>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Button
								type="button"
								variant="outline"
								size="icon"
								onClick={() => loadDoctors(doctorSearch, doctorPage - 1)}
								disabled={doctorPage <= 1 || isLoadingDoctors}
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<span className="text-sm min-w-[3.5rem] text-center text-slate-600">
								{doctorPage}/{doctorTotalPages}
							</span>
							<Button
								type="button"
								variant="outline"
								size="icon"
								onClick={() => loadDoctors(doctorSearch, doctorPage + 1)}
								disabled={doctorPage >= doctorTotalPages || isLoadingDoctors}
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="space-y-2">
							<label className="text-sm font-medium text-slate-800">Fecha inicio *</label>
							<Input
								type="date"
								value={filters.fromDate}
								onChange={(event) => setFilters((previous) => ({ ...previous, fromDate: event.target.value }))}
							/>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium text-slate-800">Fecha fin *</label>
							<Input
								type="date"
								value={filters.toDate}
								onChange={(event) => setFilters((previous) => ({ ...previous, toDate: event.target.value }))}
							/>
						</div>

						<div className="flex items-end gap-2">
							<Button
								type="button"
								onClick={handleSearch}
								disabled={isSearching}
								className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
							>
								{isSearching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								{isSearching ? "Buscando..." : "Buscar"}
							</Button>
							<Button type="button" variant="outline" onClick={handleReset}>
								Limpiar
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{encounters.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-slate-900">Resultados ({encounters.length})</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Paciente</TableHead>
										<TableHead>Tipo</TableHead>
										<TableHead>Inicio</TableHead>
										<TableHead>Fin</TableHead>
										<TableHead>Motivo</TableHead>
										<TableHead>Acciones</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{encounters.map((encounter) => {
										const expired = isEditExpired(encounter.endAt);
										const disabledMessage = "No se puede editar: han pasado mas de 24 horas desde el fin del encuentro clinico.";

										return (
											<TableRow key={encounter.id}>
												<TableCell className="font-medium text-slate-900">
													{patientNamesById[encounter.patientId] || "Paciente no disponible"}
												</TableCell>
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
												<TableCell>
													<span title={expired ? disabledMessage : ""} className="inline-flex">
														<Button
															type="button"
															size="sm"
															variant="outline"
															disabled={expired}
															onClick={() => openEditDialog(encounter)}
															className="border-blue-200"
														>
															<Pencil className="mr-2 h-4 w-4" />
															Editar
														</Button>
													</span>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>
			)}

			{encounters.length === 0 && (
				<Card>
					<CardContent className="py-12">
						<p className="text-center text-slate-500">
							{hasSearched
								? "No se encontraron encuentros clinicos para los filtros seleccionados."
								: "Selecciona doctor y fechas para listar encuentros clinicos."}
						</p>
					</CardContent>
				</Card>
			)}

			<Dialog
				open={isEditDialogOpen}
				onOpenChange={(open) => {
					setIsEditDialogOpen(open);
					if (!open) {
						setSelectedEncounter(null);
						form.reset();
					}
				}}
			>
				<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Editar encuentro clinico</DialogTitle>
						<DialogDescription>
							Actualiza la informacion del encuentro. Se validan campos obligatorios y coherencia de fechas.
						</DialogDescription>
					</DialogHeader>

					<Form {...form}>
						<form onSubmit={form.handleSubmit(handleUpdateEncounter)} className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="encounterType"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Tipo de encuentro *</FormLabel>
											<FormControl>
												<Select value={field.value} onValueChange={field.onChange}>
													<SelectTrigger>
														<SelectValue placeholder="Selecciona tipo" />
													</SelectTrigger>
													<SelectContent>
														{ENCOUNTER_TYPE_OPTIONS.map((option) => (
															<SelectItem key={option.value} value={option.value}>
																{option.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="chiefComplaint"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Motivo de consulta *</FormLabel>
											<FormControl>
												<Input {...field} placeholder="Motivo principal" />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="startAt"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Inicio *</FormLabel>
											<FormControl>
												<Input type="datetime-local" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="endAt"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Fin *</FormLabel>
											<FormControl>
												<Input type="datetime-local" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="currentCondition"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Condicion actual</FormLabel>
											<FormControl>
												<Textarea {...field} value={field.value || ""} rows={3} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="physicalExam"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Examen fisico</FormLabel>
											<FormControl>
												<Textarea {...field} value={field.value || ""} rows={3} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="assessment"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Evaluacion</FormLabel>
											<FormControl>
												<Textarea {...field} value={field.value || ""} rows={3} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="plan"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Plan</FormLabel>
											<FormControl>
												<Textarea {...field} value={field.value || ""} rows={3} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<FormField
								control={form.control}
								name="notes"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Notas</FormLabel>
										<FormControl>
											<Textarea {...field} value={field.value || ""} rows={4} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setIsEditDialogOpen(false);
										setSelectedEncounter(null);
										form.reset();
									}}
								>
									Cancelar
								</Button>
								<Button type="submit" disabled={isUpdating} className="bg-blue-600 hover:bg-blue-700 text-white">
									{isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
									{isUpdating ? "Guardando..." : "Guardar cambios"}
								</Button>
							</DialogFooter>
						</form>
					</Form>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default UpdateClinicalEncounterForm;
