import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuditLogsView } from '@/components/dashboard/admin/audit-logs-view';
import { auditLogsService } from '@/lib/api/audit-logs.service';

vi.mock('@/lib/api/audit-logs.service', () => ({
  auditLogsService: {
    getAuditLogs: vi.fn(),
    exportAuditLogsCsv: vi.fn(),
  },
}));

const firstPageItems = [
  {
    occurredAt: '2023-10-24T14:22:15.004Z',
    tableName: 'Patients',
    operation: 'I',
    rowPk: 'p_98234',
    oldData: '{"status":"PENDING"}',
    newData: '{"status":"ACTIVE"}',
    appUserId: 'j.doe@vmed.ai',
  },
  {
    occurredAt: '2023-10-24T14:18:42.012Z',
    tableName: 'Prescriptions',
    operation: 'U',
    rowPk: 'rx_22119',
    oldData: '{"dosage":"500mg"}',
    newData: '{"dosage":"750mg"}',
    appUserId: 's.miller@vmed.ai',
  },
];

const secondPageItems = [
  {
    occurredAt: '2023-10-24T13:55:01.882Z',
    tableName: 'Appointments',
    operation: 'D',
    rowPk: 'apt_0041',
    oldData: '{"status":"CREATED"}',
    newData: '{"status":"DELETED"}',
    appUserId: 'system-cron',
  },
];

describe('AuditLogsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(auditLogsService.getAuditLogs).mockResolvedValue({
      items: firstPageItems as any,
      totalCount: 40,
      pageNumber: 1,
      pageSize: 20,
    });

    vi.mocked(auditLogsService.exportAuditLogsCsv).mockResolvedValue(
      new Blob(['csv-content'], { type: 'text/csv' })
    );
  });

  it('carga registros al montar y muestra información principal', async () => {
    render(<AuditLogsView />);

    expect(screen.getByRole('heading', { name: /logs de auditoría/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(auditLogsService.getAuditLogs).toHaveBeenCalledWith({}, { pageNumber: 1 });
    });

    expect(screen.getByText('Patients')).toBeInTheDocument();
    expect(screen.getByText('Prescriptions')).toBeInTheDocument();
  });

  it('muestra el detalle al presionar Ver detalles', async () => {
    const user = userEvent.setup();
    render(<AuditLogsView />);

    await waitFor(() => {
      expect(screen.getByText('Prescriptions')).toBeInTheDocument();
    });

    const detailButtons = screen.getAllByRole('button', { name: /ver detalles/i });
    await user.click(detailButtons[1]);

    expect(screen.getByText(/"dosage": "500mg"/i)).toBeInTheDocument();
    expect(screen.getByText(/"dosage": "750mg"/i)).toBeInTheDocument();
  });

  it('permite navegar a la página siguiente y anterior', async () => {
    const user = userEvent.setup();

    vi.mocked(auditLogsService.getAuditLogs).mockImplementation(
      async (_filters, pagination) => {
        if (pagination?.pageNumber === 2) {
          return {
            items: secondPageItems as any,
            totalCount: 40,
            pageNumber: 2,
            pageSize: 20,
          };
        }

        return {
          items: firstPageItems as any,
          totalCount: 40,
          pageNumber: 1,
          pageSize: 20,
        };
      }
    );

    render(<AuditLogsView />);

    await waitFor(() => {
      expect(screen.getByText('Patients')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /siguiente/i }));

    await waitFor(() => {
      expect(auditLogsService.getAuditLogs).toHaveBeenCalledWith({}, { pageNumber: 2 });
    });

    expect(screen.getByText('Appointments')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /anterior/i }));

    await waitFor(() => {
      expect(auditLogsService.getAuditLogs).toHaveBeenCalledWith({}, { pageNumber: 1 });
    });
  });

  it('aplica filtros de fecha y exporta usando backend con maxRows por defecto', async () => {
    const user = userEvent.setup();
    const { container } = render(<AuditLogsView />);

    await waitFor(() => {
      expect(auditLogsService.getAuditLogs).toHaveBeenCalled();
    });

    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBe(2);

    fireEvent.change(dateInputs[0], { target: { value: '2023-10-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2023-10-24' } });

    await user.click(screen.getByRole('button', { name: /aplicar filtros/i }));

    await waitFor(() => {
      expect(auditLogsService.getAuditLogs).toHaveBeenCalledWith(
        { from: '2023-10-01', to: '2023-10-24' },
        { pageNumber: 1 }
      );
    });

    await user.click(screen.getByRole('button', { name: /exportar csv/i }));

    await waitFor(() => {
      expect(auditLogsService.exportAuditLogsCsv).toHaveBeenCalledWith(
        { from: '2023-10-01', to: '2023-10-24' },
        5000
      );
    });
  });
});
