import { inject, Injectable } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type {
  AssociateBookshelfDetectionRequest,
  BookshelfAnalysisResponse,
  BookshelfCandidateSearchResponse,
  BookshelfDetectionResponse,
  BookshelfPhotoDetail,
  BookshelfPhotoSummary,
  BookshelfScanDetection,
  UpdateBookshelfPhotoRequest,
} from '../api/api.types';

export type SaveBookshelfDetection = Pick<
  BookshelfScanDetection,
  | 'boundingBox'
  | 'confidence'
  | 'observedAuthors'
  | 'observedIsbn10'
  | 'observedIsbn13'
  | 'observedPublisher'
  | 'observedSpineText'
  | 'observedTitle'
  | 'position'
> & {
  libraryItemId: null | string;
  selectedGoogleBooksVolumeId: null | string;
};

/** Promise-based API facade for visual shelf analysis and explicitly retained photos. */
@Injectable({ providedIn: 'root' })
export class Bookshelves {
  private readonly api = inject(ApiClient);

  public analyze(image: File): Promise<BookshelfAnalysisResponse> {
    const body = new FormData();
    body.append('image', image, image.name);
    return this.api.post<BookshelfAnalysisResponse, FormData>('/api/bookshelf-scans/analyze', body);
  }

  public search(query: string): Promise<BookshelfCandidateSearchResponse> {
    return this.api.get<BookshelfCandidateSearchResponse>('/api/bookshelf-scans/search', {
      query,
    });
  }

  public save(
    image: File,
    label: string,
    detections: SaveBookshelfDetection[],
  ): Promise<BookshelfPhotoDetail> {
    const body = new FormData();
    body.append('image', image, image.name);
    body.append('label', label);
    body.append('manifest', JSON.stringify({ detections }));
    return this.api.post<BookshelfPhotoDetail, FormData>('/api/bookshelf-photos', body);
  }

  public list(): Promise<BookshelfPhotoSummary[]> {
    return this.api.get<BookshelfPhotoSummary[]>('/api/bookshelf-photos');
  }

  public get(id: string): Promise<BookshelfPhotoDetail> {
    return this.api.get<BookshelfPhotoDetail>(`/api/bookshelf-photos/${id}`);
  }

  public image(id: string, thumbnail = false): Promise<Blob> {
    const suffix = thumbnail ? 'thumbnail' : 'image';
    return this.api.getBlob(`/api/bookshelf-photos/${id}/${suffix}`);
  }

  public rename(id: string, label: string): Promise<BookshelfPhotoDetail> {
    const request: UpdateBookshelfPhotoRequest = { label };
    return this.api.patch<BookshelfPhotoDetail, UpdateBookshelfPhotoRequest>(
      `/api/bookshelf-photos/${id}`,
      request,
    );
  }

  public delete(id: string): Promise<void> {
    return this.api.delete(`/api/bookshelf-photos/${id}`);
  }

  public associate(
    photoId: string,
    detectionId: string,
    request: AssociateBookshelfDetectionRequest,
  ): Promise<BookshelfDetectionResponse> {
    return this.api.patch<BookshelfDetectionResponse, AssociateBookshelfDetectionRequest>(
      `/api/bookshelf-photos/${photoId}/detections/${detectionId}`,
      request,
    );
  }
}
