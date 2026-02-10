export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface GeoPolygon {
  coordinates: GeoPoint[];
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface Capabilities {
  [key: string]: boolean | string | number;
}
