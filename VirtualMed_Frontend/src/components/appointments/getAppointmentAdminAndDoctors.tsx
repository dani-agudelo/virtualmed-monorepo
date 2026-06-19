"use client";

import { useState, useCallback } from "react";
import { isAxiosError } from "axios";
import { Loader2, Search, Edit, ChevronLeft, ChevronRight } from "lucide-react";

import { doctorService } from "@/lib/api/doctor.service";
import { patientService } from "@/lib/api/patient.service";
import { useToast } from "@/hooks/use-toast";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AppointmentStatus } from "@/constants/appointmentStatus";
import { AppointmentGetResponse } from "@/types";
import { getStatusBadgeName, getStatusBadgeVariant } from "@/lib/utils";

// ============================================
// Props del componente
// ============================================
interface ListAppointmentsProps {
  /**
   * "admin" → muestra filtros de paciente y doctor, columna Doctor en tabla
   *           y campo Doctor en diálogo de edición.
   * "doctor" → solo muestra filtros de fecha y estado; tabla y diálogo simplificados.
   */
  mode: "admin" | "doctor";
}

// ============================================
// Interfaces
// ============================================
interface BaseFilters {
  fromDate: string;
  toDate: string;
  status: string;
}

interface AdminFilters extends BaseFilters {
  patientId: string;
  doctorId: string;
}

type Filters = AdminFilters; // usamos el superset; los campos extra se ignoran en modo doctor

interface PatientOption {
  id: string;
  fullName: string;
  document: string;
}

interface DoctorOption {
  id: string;
  fullName: string;
  professionalLicense: string;
}

interface EditFormData {
  scheduledAt: string;
  scheduledAtTime: string;
  durationMinutes: number;
  reason: string;
  status: string;
}

const EMPTY_FILTERS: Filters = {
  fromDate: "",
  toDate: "",
  status: "",
  patientId: "",
  doctorId: "",
};

const EMPTY_EDIT_FORM: EditFormData = {
  scheduledAt: "",
  scheduledAtTime: "",
  durationMinutes: 0,
  reason: "",
  status: "",
};

// ============================================
// Reutilizable: manejo de errores HTTP
// ============================================
const HTTP_ERROR_MESSAGES: Record<number, { title: string; description: string }> = {
  403: { title: "Acceso denegado", description: "No tienes permiso para realizar esta acción." },
};

// ============================================
// Component
// ============================================
export default function ListAppointmentsComponent({ mode }: ListAppointmentsProps) {
  const isAdmin = mode === "admin";
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentGetResponse[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<AppointmentGetResponse[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  // Solo en modo admin
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);

  // Estados para búsqueda y paginación de pacientes
  const [patientSearch, setPatientSearch] = useState("");
  const [patientPage, setPatientPage] = useState(1);
  const [patientTotalPages, setPatientTotalPages] = useState(1);

  // Estados para búsqueda y paginación de doctores
  const [doctorSearch, setDoctorSearch] = useState("");
  const [doctorPage, setDoctorPage] = useState(1);
  const [doctorTotalPages, setDoctorTotalPages] = useState(1);

  // Edición
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [appointmentToEdit, setAppointmentToEdit] = useState<AppointmentGetResponse | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>(EMPTY_EDIT_FORM);

  // ============================================
  // Helper: mostrar toast de error HTTP
  // ============================================
  const toastHttpError = (error: unknown, fallback: string) => {
    if (isAxiosError(error)) {
      const status = error.response?.status;
      const known = status ? HTTP_ERROR_MESSAGES[status] : undefined;
      toast({
        title: known?.title ?? "Error",
        description: known?.description ?? error.response?.data?.message ?? fallback,
        variant: "destructive",
      });
    } else {
      toast({ title: "Error", description: "Ocurrió un error inesperado.", variant: "destructive" });
    }
  };

  // ============================================
  // Cargar pacientes y doctores (solo admin)
  // ============================================
  const fetchPatients = useCallback(async (search: string, page: number) => {
    if (!isAdmin) return;
    try {
      setIsLoadingPatients(true);
      setPatientPage(page);
      const data = await patientService.getPatients({ 
        q: search || undefined, 
        page: page.toString() 
      });
      setPatients(data.items.map((p) => ({ id: p.id, fullName: p.fullName, document: p.document })));
      setPatientTotalPages(Math.ceil(data.totalCount / data.pageSize) || 1);
    } catch (error) {
      if (isAxiosError(error) && error.code === "ERR_CANCELED") return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (isAxiosError(error) && error.response?.status === 429) return;
      toast({ title: "Error", description: "No se pudieron cargar los pacientes.", variant: "destructive" });
    } finally {
      setIsLoadingPatients(false);
    }
  }, [isAdmin, toast]);

  // ============================================
  // Buscar doctores
  // ============================================
  const fetchDoctors = useCallback(async (search: string, page: number) => {
    if (!isAdmin) return;
    try {
      setIsLoadingDoctors(true);
      setDoctorPage(page);
      const data = await doctorService.getDoctors({ 
        q: search || undefined, 
        page: page.toString() 
      });
      setDoctors(data.items.map((d) => ({ id: d.id, fullName: d.fullName, professionalLicense: d.professionalLicense })));
      setDoctorTotalPages(Math.ceil(data.totalCount / data.pageSize) || 1);
    } catch (error) {
      if (isAxiosError(error) && error.code === "ERR_CANCELED") return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (isAxiosError(error) && error.response?.status === 429) return;
      console.error("Error al cargar doctores:", error);
      toast({ title: "Error", description: "No se pudieron cargar los doctores.", variant: "destructive" });
    } finally {
      setIsLoadingDoctors(false);
    }
  }, [isAdmin, toast]);

  // ============================================
  // Filtro por estado (cliente)
  // ============================================
  const applyStatusFilter = (data: AppointmentGetResponse[], status: string) => {
    setFilteredAppointments(
      status === "" || status === "all"
        ? data
        : data.filter((a) => a.status === status)
    );
  };

  // ============================================
  // Cambios en filtros
  // ============================================
  const handleFilterChange = (field: keyof Filters, value: string) => {
    const normalized = value === "all" ? "" : value;
    const updated = { ...filters, [field]: normalized };
    setFilters(updated);
    if (appointments.length > 0) applyStatusFilter(appointments, updated.status);
  };

  // ============================================
  // Buscar citas
  // ============================================
  const handleSearchAppointments = async () => {
    if (!filters.fromDate || !filters.toDate) {
      toast({ title: "Validación", description: "Por favor, completa las fechas de inicio y fin.", variant: "destructive" });
      return;
    }
    if (new Date(filters.fromDate) > new Date(filters.toDate)) {
      toast({ title: "Validación", description: "La fecha de inicio no puede ser mayor a la fecha de fin.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const queryParams: Record<string, string> = {
        from: new Date(filters.fromDate).toISOString(),
        to: new Date(filters.toDate).toISOString(),
      };

      if (isAdmin) {
        if (filters.patientId) queryParams.patientId = filters.patientId;
        if (filters.doctorId) queryParams.doctorId = filters.doctorId;
      }

      const response = await doctorService.getAppointments(queryParams);
      setAppointments(response);
      applyStatusFilter(response, filters.status);

      if (response.length === 0) {
        toast({ title: "Sin resultados", description: "No se encontraron citas para el rango de fechas especificado." });
      }
    } catch (error) {
      toastHttpError(error, "Error al obtener las citas.");
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // Resetear filtros
  // ============================================
  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setAppointments([]);
    setFilteredAppointments([]);
    setPatientSearch("");
    setPatientPage(1);
    setDoctorSearch("");
    setDoctorPage(1);
  };

  // ============================================
  // Abrir / cerrar diálogo de edición
  // ============================================
  const openEditDialog = (appointment: AppointmentGetResponse) => {
    const d = new Date(appointment.scheduledAt);
    setAppointmentToEdit(appointment);
    setEditFormData({
      scheduledAt: d.toISOString().split("T")[0],
      scheduledAtTime: d.toTimeString().slice(0, 5),
      durationMinutes: appointment.durationMinutes,
      reason: appointment.reason || "",
      status: appointment.status,
    });
    setIsEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
    setAppointmentToEdit(null);
    setEditFormData(EMPTY_EDIT_FORM);
  };

  const handleEditFormChange = (field: keyof EditFormData, value: string | number) => {
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ============================================
  // Actualizar cita
  // ============================================
  const handleUpdateAppointment = async () => {
    if (!appointmentToEdit) return;
    const scheduledAtDateTime = new Date(
      `${editFormData.scheduledAt}T${editFormData.scheduledAtTime}`
    ).toISOString();

    const selectedDate = new Date(scheduledAtDateTime);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    if (selectedDate <= today || selectedDate > oneYearFromNow) {
      toast({
        title: "Validación",
        description: "La fecha debe estar entre hoy y 1 año en el futuro.",
        variant: "destructive",
      });
      return;
    }
    if (!editFormData.scheduledAt || !editFormData.scheduledAtTime) {
      toast({ title: "Validación", description: "Por favor completa la fecha y hora.", variant: "destructive" });
      return;
    }
    if (!editFormData.durationMinutes || editFormData.durationMinutes < 30 || editFormData.durationMinutes > 1440) {
      toast({ title: "Validación", description: "La duración debe estar entre 30 y 1440 minutos.", variant: "destructive" });
      return;
    }

    setIsUpdating(true);
    try {
      const updateData: Partial<AppointmentGetResponse> = {
        scheduledAt: new Date(`${editFormData.scheduledAt}T${editFormData.scheduledAtTime}`).toISOString(),
        durationMinutes: editFormData.durationMinutes,
        reason: editFormData.reason || null,
        status: editFormData.status as AppointmentGetResponse["status"],
      };

      await doctorService.updateAppointment(appointmentToEdit.id, updateData);

      toast({ title: "Éxito", description: "La cita ha sido actualizada correctamente." });

      const updated = appointments.map((a) =>
        a.id === appointmentToEdit.id ? { ...a, ...updateData } : a
      ) as AppointmentGetResponse[];

      setAppointments(updated);
      applyStatusFilter(updated, filters.status);
      closeEditDialog();
    } catch (error) {
      toastHttpError(error, "Error al actualizar la cita.");
    } finally {
      setIsUpdating(false);
    }
  };

  // ============================================
  // Status options (reutilizados en filtros y edición)
  // ============================================
  const statusOptions = [
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.INPROGRESS,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
  ];

  // ============================================
  // Render
  // ============================================
  return (
    <div className="w-full space-y-6 p-6 pt-16">
      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold text-blue-600">Mis Citas</h1>
        <p className="text-muted-foreground mt-2">
          Filtra y visualiza tus citas por rango de fechas y estado
        </p>
      </div>

      {/* Card de filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-blue-600">
            <Search className="h-5 w-5 text-blue-600" />
            Filtros de búsqueda
          </CardTitle>
          <CardDescription>Busca un nombre, dale al buscador, y encuentra al doctor y paciente en los selectores</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`grid grid-cols-1 ${isAdmin ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"} gap-4`}>

            {/* Paciente — solo admin */}
            {isAdmin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Paciente</label>
                <div className="space-y-2">
                  <div className="relative flex gap-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="Buscar paciente..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchPatients(patientSearch, 1)}
                      className="pl-10 flex-1"
                      disabled={isLoadingPatients}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fetchPatients(patientSearch, 1)}
                      disabled={isLoadingPatients}
                    >
                      {isLoadingPatients ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={filters.patientId || "all"}
                      onValueChange={(v) => handleFilterChange("patientId", v)}
                      disabled={isLoadingPatients || patients.length === 0}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={isLoadingPatients ? "Buscando..." : "Selecciona paciente"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los pacientes</SelectItem>
                        {patients.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex flex-col">
                              <span>{p.fullName}</span>
                              <span className="text-xs text-muted-foreground">{p.document}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => fetchPatients(patientSearch, patientPage - 1)}
                      disabled={patientPage <= 1 || isLoadingPatients}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                      {patientPage}/{patientTotalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => fetchPatients(patientSearch, patientPage + 1)}
                      disabled={patientPage >= patientTotalPages || isLoadingPatients}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Doctor — solo admin */}
            {isAdmin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Doctor</label>
                <div className="space-y-2">
                  <div className="relative flex gap-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="Buscar doctor..."
                      value={doctorSearch}
                      onChange={(e) => setDoctorSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchDoctors(doctorSearch, 1)}
                      className="pl-10 flex-1"
                      disabled={isLoadingDoctors}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fetchDoctors(doctorSearch, 1)}
                      disabled={isLoadingDoctors}
                    >
                      {isLoadingDoctors ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={filters.doctorId || "all"}
                      onValueChange={(v) => handleFilterChange("doctorId", v)}
                      disabled={isLoadingDoctors || doctors.length === 0}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={isLoadingDoctors ? "Buscando..." : "Selecciona doctor"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los doctores</SelectItem>
                        {doctors.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            <div className="flex flex-col">
                              <span>{d.fullName}</span>
                              <span className="text-xs text-muted-foreground">{d.professionalLicense}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => fetchDoctors(doctorSearch, doctorPage - 1)}
                      disabled={doctorPage <= 1 || isLoadingDoctors}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                      {doctorPage}/{doctorTotalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => fetchDoctors(doctorSearch, doctorPage + 1)}
                      disabled={doctorPage >= doctorTotalPages || isLoadingDoctors}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Fecha inicio */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Inicio *</label>
              <Input
                type="date"
                value={filters.fromDate}
                onChange={(e) => handleFilterChange("fromDate", e.target.value)}
              />
            </div>

            {/* Fecha fin */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Fin *</label>
              <Input
                type="date"
                value={filters.toDate}
                onChange={(e) => handleFilterChange("toDate", e.target.value)}
              />
            </div>

            {/* Estado */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select
                value={filters.status}
                onValueChange={(v) => handleFilterChange("status", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {getStatusBadgeName(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Botones */}
            <div className="flex gap-2 items-end">
              <Button onClick={handleSearchAppointments} disabled={isLoading} className="flex-1 bg-blue-600">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? "Buscando..." : "Buscar"}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Limpiar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de citas */}
      {filteredAppointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-blue-600">Citas ({filteredAppointments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    {isAdmin && <TableHead>Doctor</TableHead>}
                    <TableHead>Fecha y Hora</TableHead>
                    <TableHead>Duración (min)</TableHead>
                    <TableHead>Razón</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium">{appointment.patientFullName}</TableCell>
                      {isAdmin && (
                        <TableCell className="font-medium">{appointment.doctorFullName}</TableCell>
                      )}
                      <TableCell>
                        {new Date(appointment.scheduledAt).toLocaleString("es-ES", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>{appointment.durationMinutes}</TableCell>
                      <TableCell className="max-w-xs truncate">{appointment.reason || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(appointment.status)}>
                          {getStatusBadgeName(appointment.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(appointment)}>
                          <Edit className="h-4 w-4" />
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

      {/* Estado vacío */}
      {appointments.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              {filters.fromDate && filters.toDate
                ? "No se encontraron citas para el rango de fechas seleccionado."
                : "Completa los filtros y haz clic en 'Buscar' para visualizar tus citas."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Diálogo de edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-blue-600">Editar Cita</DialogTitle>
          </DialogHeader>

          {appointmentToEdit && (
            <div className="grid gap-4 py-4">
              {/* Paciente (solo lectura) */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Paciente</label>
                <Input type="text" value={appointmentToEdit.patientFullName} disabled />
              </div>

              {/* Doctor (solo lectura) — solo admin */}
              {isAdmin && (
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Doctor</label>
                  <Input type="text" value={appointmentToEdit.doctorFullName || ""} disabled />
                </div>
              )}

              {/* Fecha */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Fecha *</label>
                <Input
                  type="date"
                  value={editFormData.scheduledAt}
                  min={new Date().toISOString().split("T")[0]}
                  max={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                  onChange={(e) => handleEditFormChange("scheduledAt", e.target.value)}
                />
              </div>

              {/* Hora */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Hora *</label>
                <Input
                  type="time"
                  value={editFormData.scheduledAtTime}
                  min={new Date().toISOString().split("T")[0]}
                  max={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                  onChange={(e) => handleEditFormChange("scheduledAtTime", e.target.value)}
                />
              </div>

              {/* Duración */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Duración (minutos) * (30 - 1440)</label>
                <Input
                  type="number"
                  min="30"
                  max="1440"
                  value={editFormData.durationMinutes}
                  onChange={(e) => handleEditFormChange("durationMinutes", parseInt(e.target.value))}
                />
              </div>

              {/* Razón */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Razón</label>
                <textarea
                  value={editFormData.reason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    handleEditFormChange("reason", e.target.value)
                  }
                  placeholder="Razón de la cita (opcional)"
                  maxLength={1000}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-xs text-muted-foreground">{editFormData.reason.length}/1000</p>
              </div>

              {/* Estado */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Estado</label>
                <Select
                  value={editFormData.status}
                  onValueChange={(v) => handleEditFormChange("status", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {getStatusBadgeName(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>Cancelar</Button>
            <Button onClick={handleUpdateAppointment} disabled={isUpdating} className="bg-blue-600 hover:bg-blue-700">
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isUpdating ? "Actualizando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}