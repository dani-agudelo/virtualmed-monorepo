// RAG admin: integración directa con chatbot FastAPI (/ingest/*)
import axios from 'axios';
import {
  createChatbotClient,
  extractChatbotErrorMessage,
} from './chatbot-client';
import { RagDocument, UploadRagDocumentResponse } from '@/types';

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

interface RagDocumentItemDto {
  file_name: string;
  indexed_nodes: number;
  file_size_bytes: number;
}

interface IngestUploadResponseDto {
  file_name: string;
  indexed_documents: number;
  indexed_nodes: number;
  collection_name: string;
}

const ragClient = createChatbotClient({
  json: false,
  timeoutMs: 180_000,
  withInternalKey: true,
});

function mapListItem(item: RagDocumentItemDto): RagDocument {
  return {
    id: item.file_name,
    fileName: item.file_name,
    status: 'Indexed',
    fileSizeBytes: item.file_size_bytes,
    indexedNodeCount: item.indexed_nodes,
    errorMessage: null,
    createdAt: '',
    indexedAt: null,
  };
}

export const ragDocumentService = {
  list: async (): Promise<RagDocument[]> => {
    try {
      const { data } = await ragClient.get<RagDocumentItemDto[]>('/ingest/documents');
      return (data ?? []).map(mapListItem).sort((a, b) =>
        a.fileName.localeCompare(b.fileName, 'es')
      );
    } catch (error) {
      throw new Error(extractChatbotErrorMessage(error, 'No fue posible listar documentos RAG.'));
    }
  },

  upload: async (
    file: File,
    onUploadProgress?: (percent: number) => void
  ): Promise<UploadRagDocumentResponse> => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Solo se permiten archivos PDF.');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error('El archivo supera el máximo de 20 MB.');
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await ragClient.post<IngestUploadResponseDto>(
        '/ingest/upload',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (event) => {
            if (!event.total) return;
            onUploadProgress?.(Math.round((event.loaded * 100) / event.total));
          },
        }
      );

      return {
        message: 'Documento indexado correctamente.',
        document: {
          id: data.file_name,
          fileName: data.file_name,
          status: 'Indexed',
          fileSizeBytes: file.size,
          indexedNodeCount: data.indexed_nodes,
          errorMessage: null,
          createdAt: new Date().toISOString(),
          indexedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        throw new Error(
          extractChatbotErrorMessage(error, `Ya existe un documento con el nombre '${file.name}'.`)
        );
      }
      throw new Error(extractChatbotErrorMessage(error, 'Error al subir el documento.'));
    }
  },

  delete: async (fileName: string): Promise<void> => {
    const encoded = encodeURIComponent(fileName);
    try {
      await ragClient.delete(`/ingest/documents/${encoded}`);
    } catch (error) {
      throw new Error(extractChatbotErrorMessage(error, 'No fue posible eliminar el documento.'));
    }
  },
};
