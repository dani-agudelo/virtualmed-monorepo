'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Database, Loader2, Trash2, UploadCloud } from 'lucide-react';

import { ragDocumentService } from '@/lib/api/rag-document.service';
import type { RagDocument } from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/constants/userRole';
import { Button } from '@/components/ui/button';

type QueueItem = {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'done' | 'error';
  message?: string;
};

const STATUS_LABELS: Record<RagDocument['status'], string> = {
  Pending: 'Pendiente',
  Ingesting: 'Indexando',
  Indexed: 'Indexado',
  Failed: 'Error',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RagDocumentsAdminView() {
  const { user } = useAuthStore();
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const processingRef = useRef(false);

  const isAdmin = user?.role === UserRole.ADMIN;

  const canUpload = useMemo(
    () => isAdmin || (user?.permission ?? []).includes('RagDocument:Upload'),
    [isAdmin, user?.permission]
  );
  const canDelete = useMemo(
    () => isAdmin || (user?.permission ?? []).includes('RagDocument:Delete'),
    [isAdmin, user?.permission]
  );

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await ragDocumentService.list();
      setDocuments(items);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const enqueueFiles = (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter((file) =>
      file.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFiles.length === 0) return;

    setQueue((prev) => [
      ...prev,
      ...pdfFiles.map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        status: 'queued' as const,
      })),
    ]);
  };

  useEffect(() => {
    if (!canUpload || processingRef.current) return;

    const nextItem = queue.find((item) => item.status === 'queued');
    if (!nextItem) return;

    processingRef.current = true;
    const itemId = nextItem.id;

    const uploadNext = async () => {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, status: 'uploading' } : item
        )
      );

      try {
        setUploadProgress(0);
        await ragDocumentService.upload(nextItem.file, setUploadProgress);
        setQueue((prev) => {
          const updated = prev.map((item) =>
            item.id === itemId
              ? { ...item, status: 'done' as const, message: 'Indexado correctamente' }
              : item
          );
          const hasPending = updated.some(
            (item) => item.status === 'queued' || item.status === 'uploading'
          );
          if (!hasPending) void loadDocuments();
          return updated;
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error al subir el documento';

        setQueue((prev) => {
          const updated = prev.map((item) =>
            item.id === itemId ? { ...item, status: 'error' as const, message } : item
          );
          const hasPending = updated.some(
            (item) => item.status === 'queued' || item.status === 'uploading'
          );
          if (!hasPending) void loadDocuments();
          return updated;
        });
      } finally {
        setUploadProgress(null);
        processingRef.current = false;
        setQueue((prev) => [...prev]);
      }
    };

    void uploadNext();
  }, [queue, canUpload, loadDocuments]);

  const handleDelete = async (document: RagDocument) => {
    if (!canDelete) return;
    const confirmed = window.confirm(`¿Eliminar "${document.fileName}" del corpus RAG?`);
    if (!confirmed) return;

    try {
      await ragDocumentService.delete(document.fileName);
      await loadDocuments();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : 'No fue posible eliminar el documento.'
      );
    }
  };

  return (
    <div className="mt-14 space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-semibold text-slate-950">Base de conocimiento RAG</h1>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Sube PDFs clínicos para el asistente. Conexión directa al servicio RAG (puerto 8000).
          Máximo 20 MB por archivo. Los archivos se indexan uno a la vez.
        </p>
      </div>

      {canUpload && (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            enqueueFiles(event.dataTransfer.files);
          }}
          onClick={() => document.getElementById('ragFileInput')?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'
          }`}
        >
          <UploadCloud className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <p className="font-semibold text-blue-600">Arrastra PDFs aquí o haz clic para seleccionar</p>
          <p className="mt-1 text-xs text-slate-500">Solo PDF · Máx. 20 MB · Cola secuencial</p>
          {uploadProgress !== null && (
            <p className="mt-3 text-sm text-slate-600">Subiendo… {uploadProgress}%</p>
          )}
          <input
            id="ragFileInput"
            type="file"
            className="hidden"
            accept=".pdf,application/pdf"
            multiple
            onChange={(event) => {
              if (event.target.files) enqueueFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
      )}

      {queue.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Cola de subida</h2>
          <div className="space-y-2">
            {queue.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{item.file.name}</span>
                <span className="ml-4 shrink-0 text-slate-500">
                  {item.status === 'queued' && 'En cola'}
                  {item.status === 'uploading' && 'Indexando…'}
                  {item.status === 'done' && 'Listo'}
                  {item.status === 'error' && (item.message || 'Error')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Documentos indexados</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando documentos…
          </div>
        ) : documents.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No hay documentos en el corpus todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Archivo</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Tamaño</th>
                  <th className="px-4 py-3 font-medium">Fragmentos</th>
                  {canDelete && <th className="px-4 py-3 font-medium">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{document.fileName}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                        {STATUS_LABELS[document.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatBytes(document.fileSizeBytes)}</td>
                    <td className="px-4 py-3">{document.indexedNodeCount ?? '—'}</td>
                    {canDelete && (
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(document)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
