import { ApiErrorResponse } from '../types/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export class ApiError extends Error {
  statusCode: number;
  error?: string;

  constructor(message: string, statusCode: number, error?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.error = error;
  }
}

interface FetchOptions extends RequestInit {
  token?: string | null;
}

export async function apiClient<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const { token, headers, ...customConfig } = options;

  const authToken =
    token !== undefined
      ? token
      : typeof window !== 'undefined'
        ? localStorage.getItem('ym_access_token')
        : null;

  const config: RequestInit = {
    method: customConfig.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
    ...customConfig,
  };

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const response = await fetch(url, config);

  if (response.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('ym_access_token');
    localStorage.removeItem('ym_user_data');
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorDetail: string | undefined;

    try {
      const errorData: ApiErrorResponse = await response.json();
      if (Array.isArray(errorData.message)) {
        errorMessage = errorData.message.join(', ');
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
      errorDetail = errorData.error;
    } catch {
      // JSON parsing fallback
    }

    throw new ApiError(errorMessage, response.status, errorDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}
