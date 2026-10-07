import { post } from '../client';
import type { CreateReportRequest } from '../types';

export const safetyApi = {
  report: (body: CreateReportRequest) => post<void>('/reports', body),
};
