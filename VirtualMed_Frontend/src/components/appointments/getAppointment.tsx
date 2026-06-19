"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { Loader2, Search } from "lucide-react";

import { doctorService } from "@/lib/api/doctor.service";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AppointmentStatus } from "@/constants/appointmentStatus";
import { AppointmentGetResponse } from "@/types";
import { getStatusBadgeName, getStatusBadgeVariant } from "@/lib/utils";

// ============================================
// Interface para filtros
// ============================================
interface Filters {
  fromDate: string;
  toDate: string;
  status: string;
}

// ============================================
// Component
// ============================================
export default function ListAppointmentsComponent() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentGetResponse[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<AppointmentGetResponse[]>([]);
  const [joiningAppointmentId, setJoiningAppointmentId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    fromDate: "",
    toDate: "",
    status: "",
  });

  // ============================================
  // Obtener citas
  // ============================================
  const handleSearchAppointments = async () => {
    if (!filters.fromDate || !filters.toDate) {
      toast({
        title: "Validación",
        description: "Por favor, completa las fechas de inicio y fin.",
        variant: "destructive",
      });
      return;
    }

    if (new Date(filters.fromDate) > new Date(filters.toDate)) {
      toast({
        title: "Validación",
        description: "La fecha de inicio no puede ser mayor a la fecha de fin.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await doctorService.getAppointments({
        from: new Date(filters.fromDate).toISOString(),
        to: new Date(filters.toDate).toISOString(),
      });

      setAppointments(response);
      applyStatusFilter(response, filters.status);

      if (response.length === 0) {
        toast({
          title: "Sin resultados",
          description: "No se encontraron citas para el rango de fechas especificado.",
        });
      }
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;

        if (status === 403) {
          toast({
            title: "Acceso denegado",
            description: "No tienes permiso para ver estas citas.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description:
              error.response?.data?.message || "Error al obtener las citas.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: "Ocurrió un error inesperado.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // Aplicar filtro por estado
  // ============================================
  const applyStatusFilter = (data: AppointmentGetResponse[], status: string) => {
    if (status === "" || status === "all") {
      setFilteredAppointments(data);
    } else {
      setFilteredAppointments(
        data.filter((appointment) => appointment.status === status)
      );
    }
  };

  // ============================================
  // Manejar cambios en filtros
  // ============================================
  const handleFilterChange = (field: keyof Filters, value: string) => {
    const updatedFilters = { ...filters, [field]: value };
    setFilters(updatedFilters);

    if (appointments.length > 0) {
      applyStatusFilter(appointments, updatedFilters.status);
    }
  };

  // ============================================
  // Resetear filtros
  // ============================================
  const handleReset = () => {
    setFilters({ fromDate: "", toDate: "", status: "" });
    setAppointments([]);
    setFilteredAppointments([]);
  };

  const handleJoinVideoSession = async (appointment: AppointmentGetResponse) => {
    const sessionId = appointment.videoSessionId?.trim();
    if (!sessionId) {
      toast({
        title: "La videollamada no ha empezado",
        description: "El doctor aún no ha habilitado la sesión.",
        variant: "destructive",
      });
      return;
    }

    setJoiningAppointmentId(appointment.id);
    try {
      await doctorService.postIceCredentials(sessionId);
      router.push(`/dashboard/video-session/${sessionId}`);
    } catch (error) {
      const description = isAxiosError(error)
        ? error.response?.data?.message || "No se pudo iniciar la videollamada."
        : "No se pudo iniciar la videollamada.";

      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
    } finally {
      setJoiningAppointmentId(null);
    }
  };

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
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros de búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                onValueChange={(value) => handleFilterChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value={AppointmentStatus.SCHEDULED}>
                    {getStatusBadgeName(AppointmentStatus.SCHEDULED)}
                  </SelectItem>
                  <SelectItem value={AppointmentStatus.CONFIRMED}>
                    {getStatusBadgeName(AppointmentStatus.CONFIRMED)}
                  </SelectItem>
                  <SelectItem value={AppointmentStatus.INPROGRESS}>
                    {getStatusBadgeName(AppointmentStatus.INPROGRESS)}
                  </SelectItem>
                  <SelectItem value={AppointmentStatus.COMPLETED}>
                    {getStatusBadgeName(AppointmentStatus.COMPLETED)}
                  </SelectItem>
                  <SelectItem value={AppointmentStatus.CANCELLED}>
                    {getStatusBadgeName(AppointmentStatus.CANCELLED)}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Botones */}
            <div className="flex gap-2 items-end">
              <Button
                onClick={handleSearchAppointments}
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:pointer-events-none"
              >
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
        <TooltipProvider>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Citas ({filteredAppointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Fecha y Hora</TableHead>
                      <TableHead>Duración (min)</TableHead>
                      <TableHead>Razón</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Videollamada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppointments.map((appointment) => {
                      const isJoinDisabled =
                        !appointment.videoSessionId ||
                        joiningAppointmentId === appointment.id;
                      const tooltipMessage = appointment.videoSessionId
                        ? "Unirse a la videollamada"
                        : "La videollamada no ha empezado";

                      return (
                        <TableRow key={appointment.id}>
                          <TableCell className="font-medium">
                            {appointment.doctorFullName}
                          </TableCell>
                          <TableCell>
                            {new Date(appointment.scheduledAt).toLocaleString(
                              "es-ES",
                              {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </TableCell>
                          <TableCell>{appointment.durationMinutes}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {appointment.reason || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(appointment.status)}>
                              {getStatusBadgeName(appointment.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {appointment.status !== AppointmentStatus.COMPLETED ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex" tabIndex={0}>
                                  <Button
                                    size="sm"
                                    onClick={() => handleJoinVideoSession(appointment)}
                                    disabled={isJoinDisabled}
                                  >
                                    {joiningAppointmentId === appointment.id && (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Unirse
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{tooltipMessage}</TooltipContent>
                            </Tooltip>
                            ) : (
                              <span className="text-sm text-muted-foreground">Finalizada</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TooltipProvider>
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
    </div>
  );
}