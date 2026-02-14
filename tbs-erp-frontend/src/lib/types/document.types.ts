import type { QueryParams } from './common.types';
import type { DocumentCategory } from './enums';

export interface Document {
  id: string;
  name: string;
  mimeType: string;
  category: DocumentCategory;
  entityType: string;
  entityId: string;
  fileSize: number;
  version: number;
  uploadedBy: string;
  uploadedByUser?: { id: string; fullName: string };
  url?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentQueryParams extends QueryParams {
  entityType?: string;
  category?: DocumentCategory;
}
