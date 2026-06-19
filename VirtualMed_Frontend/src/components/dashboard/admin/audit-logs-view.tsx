'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AuditLog, AuditLogFilters, AuditOperationCode } from '@/types';
import { auditLogsService } from '@/lib/api/audit-logs.service';

const ALL_VALUE = '__all__';

const operationOptions: Array<{ label: string; value: AuditOperationCode }> = [
    { label: 'Inserción', value: 'I' },
    { label: 'Actualización', value: 'U' },
    { label: 'Eliminación', value: 'D' },
];

function getOperationLabel(operation: string) {
    if (operation === 'I') return 'Inserción';
    if (operation === 'U') return 'Actualización';
    if (operation === 'D') return 'Eliminación';
    return operation || 'Sin operación';
}

function getOperationBadgeClass(operation: string) {
    if (operation === 'I') return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent';
    if (operation === 'U') return 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-transparent';
    if (operation === 'D') return 'bg-rose-100 text-rose-700 hover:bg-rose-100 border-transparent';
    return 'bg-slate-100 text-slate-700 hover:bg-slate-100 border-transparent';
}

function formatDate(dateValue: string) {
    if (!dateValue) return '-';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return dateValue;

    const dateText = new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date);

    const timeText = new Intl.DateTimeFormat('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
        hour12: false,
    }).format(date);

    return `${dateText} ${timeText}`;
}

function formatJsonData(input?: string | null) {
    if (!input) return 'Sin datos';

    try {
        const parsed = JSON.parse(input);
        return JSON.stringify(parsed, null, 2);
    } catch {
        return input;
    }
}

function getUserInitials(userId?: string | null) {
    if (!userId) return 'SI';

    const clean = userId.includes('@') ? userId.split('@')[0] : userId;
    const chunks = clean.split(/[._-]/).filter(Boolean);

    if (chunks.length === 0) return 'US';
    if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();

    return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
}

function getLogKey(log: AuditLog) {
    return `${log.occurredAt}-${log.tableName}-${log.rowPk}-${log.operation}`;
}

export function AuditLogsView() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [knownTableNames, setKnownTableNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [filters, setFilters] = useState<{
        tableName: string;
        operation: string;
        from: string;
        to: string;
    }>({
        tableName: '',
        operation: '',
        from: '',
        to: '',
    });

    const [activeFilters, setActiveFilters] = useState<AuditLogFilters>({});
    const [selectedLogKey, setSelectedLogKey] = useState<string | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const [pageNumber, setPageNumber] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)));

    const selectedLog = useMemo(
        () => logs.find((log) => getLogKey(log) === selectedLogKey) ?? null,
        [logs, selectedLogKey]
    );

    const fetchLogs = useCallback(async (filtersToUse: AuditLogFilters, targetPageNumber: number) => {
        setLoading(true);
        setError(null);

        try {
            const response = await auditLogsService.getAuditLogs(filtersToUse, {
                pageNumber: targetPageNumber,
            });

            setLogs(response.items);
            setTotalCount(response.totalCount);
            setPageNumber(response.pageNumber);
            setPageSize(response.pageSize);

            const newTableNames = response.items
                .map((item) => item.tableName)
                .filter((tableName) => !!tableName.trim());

            setKnownTableNames((current) => {
                const merged = [...current, ...newTableNames];
                return Array.from(new Set(merged)).sort((a, b) => a.localeCompare(b, 'es'));
            });

            if (response.items.length > 0) {
                const firstKey = getLogKey(response.items[0]);
                setSelectedLogKey((current) => {
                    if (!current) return firstKey;
                    const exists = response.items.some((item) => getLogKey(item) === current);
                    return exists ? current : firstKey;
                });
            } else {
                setSelectedLogKey(null);
            }
        } catch {
            setLogs([]);
            setSelectedLogKey(null);
            setError('No fue posible obtener los logs de auditoría. Intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs(activeFilters, pageNumber);
    }, [activeFilters, fetchLogs, pageNumber]);

    const handleApplyFilters = () => {
        if (filters.from && filters.to && filters.from > filters.to) {
            setError('La fecha de inicio no puede ser mayor a la fecha de fin.');
            return;
        }

        const nextFilters: AuditLogFilters = {};

        if (filters.tableName) nextFilters.tableName = filters.tableName;
        if (filters.operation) nextFilters.operation = filters.operation as AuditOperationCode;
        if (filters.from) nextFilters.from = filters.from;
        if (filters.to) nextFilters.to = filters.to;

        setPageNumber(1);
        setActiveFilters(nextFilters);
    };

    const handleClearFilters = () => {
        setFilters({
            tableName: '',
            operation: '',
            from: '',
            to: '',
        });
        setPageNumber(1);
        setActiveFilters({});
    };

    const getVisiblePages = () => {
        const pages = new Set<number>([1, totalPages, pageNumber - 1, pageNumber, pageNumber + 1]);

        return Array.from(pages)
            .filter((page) => page >= 1 && page <= totalPages)
            .sort((a, b) => a - b);
    };

    const handleExportCsv = () => {
        setExporting(true);

        auditLogsService
            .exportAuditLogsCsv(activeFilters, 5000)
            .then((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');

                link.href = url;
                link.download = `logs-auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
                link.click();

                URL.revokeObjectURL(url);
            })
            .catch(() => {
                setError('No fue posible exportar los logs de auditoría. Intenta nuevamente.');
            })
            .finally(() => {
                setExporting(false);
            });
    };

    return (
        <div className="space-y-6 pt-16">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-gray-900">Logs de Auditoría</h1>
                    <p className="text-sm text-gray-600">
                        Monitorea transacciones del sistema y eventos de seguridad de la plataforma VirtualMed.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={handleExportCsv} disabled={loading || exporting}>
                        <Download className="h-4 w-4" />
                        {exporting ? 'Exportando...' : 'Exportar CSV'}
                    </Button>

                    <Button onClick={() => fetchLogs(activeFilters, pageNumber)} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </Button>
                </div>
            </div>

            <Card className="border-gray-200 bg-white">
                <CardContent className="pt-6">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
                        <div className="space-y-1 lg:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre de tabla</p>
                            <Select
                                value={filters.tableName || ALL_VALUE}
                                onValueChange={(value) =>
                                    setFilters((prev) => ({
                                        ...prev,
                                        tableName: value === ALL_VALUE ? '' : value,
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Todas las tablas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_VALUE}>Todas las tablas</SelectItem>
                                    {knownTableNames.map((tableName) => (
                                        <SelectItem key={tableName} value={tableName}>
                                            {tableName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1 lg:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Operación</p>
                            <Select
                                value={filters.operation || ALL_VALUE}
                                onValueChange={(value) =>
                                    setFilters((prev) => ({
                                        ...prev,
                                        operation: value === ALL_VALUE ? '' : value,
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Todas las operaciones" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_VALUE}>Todas las operaciones</SelectItem>
                                    {operationOptions.map((operation) => (
                                        <SelectItem key={operation.value} value={operation.value}>
                                            {operation.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fecha inicio</p>
                            <Input
                                type="date"
                                value={filters.from}
                                onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
                            />
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fecha fin</p>
                            <Input
                                type="date"
                                value={filters.to}
                                onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        <Button onClick={handleApplyFilters} disabled={loading}>
                            Aplicar filtros
                        </Button>
                        <Button variant="outline" onClick={handleClearFilters} disabled={loading}>
                            Limpiar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>Error al cargar auditoría</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Card className="overflow-hidden border-gray-200 bg-white">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600">
                                <tr>
                                    <th className="px-4 py-3 text-left">Ocurrido en</th>
                                    <th className="px-4 py-3 text-left">Tabla</th>
                                    <th className="px-4 py-3 text-left">Operación</th>
                                    <th className="px-4 py-3 text-left">Llave PK</th>
                                    <th className="px-4 py-3 text-left">Usuario app</th>
                                    <th className="px-4 py-3 text-left">Acción</th>
                                </tr>
                            </thead>

                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                                            Cargando logs de auditoría...
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                                            No hay registros para los filtros seleccionados.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => {
                                        const key = getLogKey(log);
                                        const isSelected = key === selectedLogKey;

                                        return (
                                            <tr
                                                key={key}
                                                className={`border-t border-gray-100 transition-colors ${isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50'
                                                    }`}
                                            >
                                                <td className="px-4 py-3 font-medium text-gray-800">{formatDate(log.occurredAt)}</td>
                                                <td className="px-4 py-3 text-blue-700">{log.tableName || '-'}</td>
                                                <td className="px-4 py-3">
                                                    <Badge variant="secondary" className={getOperationBadgeClass(log.operation)}>
                                                        {getOperationLabel(log.operation)}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700">
                                                        {log.rowPk || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
                                                            {getUserInitials(log.appUserId)}
                                                        </span>
                                                        <span className="text-gray-700">{log.appUserId || 'Sistema'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Button
                                                        variant="link"
                                                        className="h-auto px-0 py-0 text-blue-700"
                                                        onClick={() => setSelectedLogKey(key)}
                                                    >
                                                        Ver detalles
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
                        <p>
                            Mostrando {logs.length} registros. Página {pageNumber} de {totalPages}. Total: {totalCount}.
                        </p>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={loading || pageNumber <= 1}
                                onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
                            >
                                Anterior
                            </Button>

                            <div className="flex items-center gap-1">
                                {getVisiblePages().map((page, index, array) => {
                                    const previousPage = array[index - 1];
                                    const showEllipsis = previousPage && page - previousPage > 1;

                                    return (
                                        <div key={page} className="flex items-center gap-1">
                                            {showEllipsis && <span className="px-1 text-gray-400">...</span>}
                                            <Button
                                                variant={page === pageNumber ? 'default' : 'outline'}
                                                size="sm"
                                                className="min-w-9"
                                                disabled={loading}
                                                onClick={() => setPageNumber(page)}
                                            >
                                                {page}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                disabled={loading || pageNumber >= totalPages}
                                onClick={() => setPageNumber((current) => Math.min(totalPages, current + 1))}
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-gray-200 bg-white">
                <CardContent className="pt-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Datos anteriores</h3>
                            <pre className="max-h-64 overflow-auto rounded-md bg-white p-3 text-xs leading-relaxed text-gray-700">
                                {formatJsonData(selectedLog?.oldData)}
                            </pre>
                        </div>

                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-700">Datos nuevos</h3>
                            <pre className="max-h-64 overflow-auto rounded-md bg-white p-3 text-xs leading-relaxed text-gray-700">
                                {formatJsonData(selectedLog?.newData)}
                            </pre>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
