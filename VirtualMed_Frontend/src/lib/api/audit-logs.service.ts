import apiClient from './axios';
import { AuditLog, AuditLogFilters, AuditLogsResponse } from '@/types';

type ApiAuditLog = {
    occurredAt?: string;
    OccurredAt?: string;
    tableName?: string;
    TableName?: string;
    operation?: string;
    Operation?: string;
    rowPk?: string;
    RowPk?: string;
    oldData?: string | null;
    OldData?: string | null;
    newData?: string | null;
    NewData?: string | null;
    appUserId?: string | null;
    AppUserId?: string | null;
};

type ApiAuditLogsPayload = {
    items?: ApiAuditLog[];
    Items?: ApiAuditLog[];
    data?: ApiAuditLog[];
    Data?: ApiAuditLog[];
    results?: ApiAuditLog[];
    Results?: ApiAuditLog[];
    auditLogs?: ApiAuditLog[];
    AuditLogs?: ApiAuditLog[];
    totalCount?: number;
    TotalCount?: number;
    pageNumber?: number;
    PageNumber?: number;
    pageSize?: number;
    PageSize?: number;
};

function normalizeItem(item: ApiAuditLog): AuditLog {
    return {
        occurredAt: item.occurredAt ?? item.OccurredAt ?? '',
        tableName: item.tableName ?? item.TableName ?? '',
        operation: item.operation ?? item.Operation ?? '',
        rowPk: item.rowPk ?? item.RowPk ?? '',
        oldData: item.oldData ?? item.OldData ?? null,
        newData: item.newData ?? item.NewData ?? null,
        appUserId: item.appUserId ?? item.AppUserId ?? null,
    };
}

function normalizeResponse(payload: ApiAuditLogsPayload | ApiAuditLog[] | null | undefined): AuditLogsResponse {
    if (Array.isArray(payload)) {
        const items = payload.map(normalizeItem);
        return {
            items,
            totalCount: items.length,
            pageNumber: 1,
            pageSize: 20,
        };
    }

    const rawItems =
        payload?.items ??
        payload?.Items ??
        payload?.data ??
        payload?.Data ??
        payload?.results ??
        payload?.Results ??
        payload?.auditLogs ??
        payload?.AuditLogs ??
        [];

    const items = rawItems.map(normalizeItem);

    return {
        items,
        totalCount: payload?.totalCount ?? payload?.TotalCount ?? items.length,
        pageNumber: payload?.pageNumber ?? payload?.PageNumber ?? 1,
        pageSize: payload?.pageSize ?? payload?.PageSize ?? 20,
    };
}

export const auditLogsService = {
    getAuditLogs: async (
        filters: AuditLogFilters,
        pagination?: { pageNumber?: number; pageSize?: number }
    ): Promise<AuditLogsResponse> => {
        const params: Record<string, string> = {};

        if (filters.tableName) params.tableName = filters.tableName;
        if (filters.operation) params.operation = filters.operation;
        if (filters.from) params.from = filters.from;
        if (filters.to) params.to = filters.to;
        if (pagination?.pageNumber) params.pageNumber = String(pagination.pageNumber);
        if (pagination?.pageSize) params.pageSize = String(pagination.pageSize);

        const response = await apiClient.get<ApiAuditLogsPayload | ApiAuditLog[]>('/audit-logs', {
            params,
        });

        return normalizeResponse(response.data);
    },

    exportAuditLogsCsv: async (filters: AuditLogFilters, maxRows = 5000): Promise<Blob> => {
        const params: Record<string, string> = {};

        if (filters.tableName) params.tableName = filters.tableName;
        if (filters.operation) params.operation = filters.operation;
        if (filters.from) params.from = filters.from;
        if (filters.to) params.to = filters.to;
        params.maxRows = String(maxRows);

        const response = await apiClient.get<Blob>('/audit-logs/export', {
            params,
            responseType: 'blob',
        });

        return response.data;
    },
};
