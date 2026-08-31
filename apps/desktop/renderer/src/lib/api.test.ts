import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateInvoice,
  createCustomer,
  getInvoices,
  recordPayment,
  createJobCard,
  request,
} from './api';

describe('Desktop API Error Handling & Permission UX', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    const storage: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => {
        storage[key] = val;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        Object.keys(storage).forEach((k) => delete storage[k]);
      },
      length: 0,
      key: () => null,
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('correctly maps 403 Forbidden with specific action to user-friendly message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: 'Forbidden' }),
      text: async () => 'Forbidden',
    });

    await expect(generateInvoice('inv-123')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'PERMISSION_DENIED',
      isPermissionDenied: true,
      message: "You don't have permission to generate invoices.",
      action: 'generate invoices',
    });
  });

  it('correctly maps 403 Forbidden with custom non-technical backend error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: 'Only managers may record payments.' }),
      text: async () => 'Only managers may record payments.',
    });

    await expect(recordPayment('inv-123', { amount: 100, paymentMethod: 'Cash' })).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED',
      isPermissionDenied: true,
      message: 'Only managers may record payments.',
    });
  });

  it('falls back to default friendly message when action is omitted on 403', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ title: 'Forbidden' }),
      text: async () => 'Forbidden',
    });

    await expect(request('/api/custom-endpoint')).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED',
      isPermissionDenied: true,
      message: "You don't have permission to perform this action.",
    });
  });

  it('maps 401 Unauthorized to session expired message and code', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
      text: async () => '',
    });

    await expect(getInvoices({ page: 1, pageSize: 10 })).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Your session has expired. Please sign in again.',
    });
  });

  it('preserves 409 Conflict business message (e.g., locked job card)', async () => {
    const conflictMsg = 'This job card is locked because its invoice has already been generated.';
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: conflictMsg }),
      text: async () => conflictMsg,
    });

    await expect(
      createJobCard({ customerId: 'cust-1', vehicleId: 'veh-1', services: [] })
    ).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: conflictMsg,
    });
  });

  it('catches TypeError: Failed to fetch and converts to clean NETWORK_ERROR', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(createCustomer({ name: 'John Doe', phoneNumber: '9876543210' })).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Unable to connect to the server. Please check that the E6 Car Spa server is running and try again.',
    });
  });

  it('sanitizes 500 Internal Server Error raw technical stack dumps', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers({ 'content-type': 'text/plain' }),
      json: async () => {
        throw new Error('Not JSON');
      },
      text: async () => 'SqlException: Connection timeout at Postgres.Query() Stack trace: ...',
    });

    await expect(request('/api/reports/dashboard')).rejects.toMatchObject({
      status: 500,
      code: 'SERVER_ERROR',
      message: 'Something went wrong. Please try again.',
    });
  });
});
