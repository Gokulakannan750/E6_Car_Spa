import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as api from './api';
import {
  generateInvoice,
  createCustomer,
  updateCustomer,
  getCustomers,
  getInvoices,
  recordPayment,
  createJobCard,
  getVehiclesByCustomer,
  createVehicle,
  updateVehicle,
  loginApi,
  getMe,
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

  it('maps 401 Unauthorized to session expired message and code on authenticated requests', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
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
      message: 'Session expired. Please log in again.',
    });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'auth:unauthorized' }));
    dispatchSpy.mockRestore();
  });

  it('maps 401 Unauthorized on login to Invalid username or password and does not dispatch auth:unauthorized', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: 'Invalid username or password.' }),
      text: async () => '{"error":"Invalid username or password."}',
    });

    await expect(loginApi({ username: 'test', password: 'bad' })).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid username or password.',
    });
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'auth:unauthorized' }));
    dispatchSpy.mockRestore();
  });

  it('maps 423 Locked to account temporarily locked message and code', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 423,
      statusText: 'Locked',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ remainingLockoutSeconds: 180 }),
      text: async () => '{"remainingLockoutSeconds":180}',
    });

    await expect(loginApi({ username: 'test', password: 'bad' })).rejects.toMatchObject({
      status: 423,
      code: 'ACCOUNT_LOCKED',
      message: 'Account temporarily locked. Please try again later.',
      remainingLockoutSeconds: 180,
    });
  });

  it('maps 429 Too Many Requests to rate limited message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
      text: async () => '',
    });

    await expect(loginApi({ username: 'test', password: 'bad' })).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Please try again later.',
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
      message: 'Unable to connect to the server. Please try again.',
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

describe('Authentication API Client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls /api/auth/login with credentials and returns token and user payload', async () => {
    const mockLoginResponse = {
      token: 'jwt-auth-token-12345',
      user: {
        id: 'usr-1',
        fullName: 'Super Admin',
        username: 'admin',
        email: 'admin@e6carspa.com',
        role: 'Owner',
        isOwner: true,
        permissions: ['*'],
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockLoginResponse,
    });

    const result = await loginApi({ username: 'admin', password: 'ValidPassword123' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: 'ValidPassword123' }),
      })
    );
    expect(result).toEqual(mockLoginResponse);
  });

  it('handles account lockout (423) in loginApi with remainingLockoutSeconds', async () => {
    const lockoutResponse = {
      error: 'Account locked due to consecutive failed attempts.',
      remainingLockoutSeconds: 240,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 423,
      statusText: 'Locked',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => lockoutResponse,
      text: async () => JSON.stringify(lockoutResponse),
    });

    await expect(loginApi({ username: 'admin', password: 'wrong' })).rejects.toMatchObject({
      status: 423,
      code: 'ACCOUNT_LOCKED',
      remainingLockoutSeconds: 240,
      message: 'Account temporarily locked. Please try again later.',
    });
  });

  it('calls /api/auth/me to retrieve current authenticated user details', async () => {
    const mockUser = {
      id: 'usr-2',
      fullName: 'Manager Staff',
      username: 'manager1',
      role: 'Manager',
      isOwner: false,
      permissions: ['view_customers', 'create_job_cards'],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockUser,
    });

    const result = await getMe();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me'),
      expect.anything()
    );
    expect(result).toEqual(mockUser);
  });
});

describe('Customer & Vehicle API Client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls /api/customers with pagination and search query parameters', async () => {
    const mockResponse = {
      items: [
        {
          id: 'cust-1',
          name: 'Gokul',
          phoneNumber: '9876543210',
          email: null,
          address: null,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 20,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse,
    });

    const result = await getCustomers({ page: 1, pageSize: 20, search: 'Gokul' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/customers?page=1&pageSize=20&search=Gokul'),
      expect.anything()
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Gokul');
  });

  it('cleans empty strings in createCustomer payload before sending to backend', async () => {
    const mockCustomer = {
      id: 'cust-2',
      name: 'Ravi Teja',
      phoneNumber: '9988776655',
      email: null,
      address: null,
      createdAt: '2026-01-01T00:00:00Z',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockCustomer,
    });

    await createCustomer({
      name: 'Ravi Teja',
      phoneNumber: '9988776655',
      email: '',
      address: '',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/customers'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Ravi Teja',
          phoneNumber: '9988776655',
          email: null,
          address: null,
        }),
      })
    );
  });

  it('calls updateCustomer with PUT method and customer ID', async () => {
    const mockUpdated = {
      id: 'cust-1',
      name: 'Gokul Updated',
      phoneNumber: '9876543210',
      email: 'gokul@example.com',
      address: 'Chennai',
      createdAt: '2026-01-01T00:00:00Z',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockUpdated,
    });

    const result = await updateCustomer({
      id: 'cust-1',
      name: 'Gokul Updated',
      phoneNumber: '9876543210',
      email: 'gokul@example.com',
      address: 'Chennai',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/customers/cust-1'),
      expect.objectContaining({
        method: 'PUT',
      })
    );
    expect(result.name).toBe('Gokul Updated');
  });

  it('calls getVehiclesByCustomer with customer ID in URL path', async () => {
    const mockVehicles = [
      {
        id: 'veh-1',
        customerId: 'cust-1',
        registrationNumber: 'TN01AB1234',
        make: 'Hyundai',
        model: 'Creta',
        variant: 'SX',
        color: null,
        customerName: 'Gokul',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockVehicles,
    });

    const result = await getVehiclesByCustomer('cust-1');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/vehicles/by-customer/cust-1'),
      expect.anything()
    );
    expect(result).toEqual(mockVehicles);
  });

  it('calls createVehicle and handles 409 Conflict when duplicate registration number exists', async () => {
    const conflictMessage = "A vehicle with registration number 'TN01AB1234' is already registered to 'Ravi Kumar'.";

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: conflictMessage }),
      text: async () => conflictMessage,
    });

    await expect(
      createVehicle({
        customerId: 'cust-2',
        registrationNumber: 'TN01AB1234',
        make: 'Hyundai',
        model: 'Creta',
      })
    ).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: conflictMessage,
    });
  });

  it('calls updateVehicle with PUT method and vehicle ID', async () => {
    const mockUpdatedVehicle = {
      id: 'veh-1',
      customerId: 'cust-1',
      registrationNumber: 'TN01AB9999',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX(O)',
      color: 'White',
      customerName: 'Gokul',
      createdAt: '2026-01-01T00:00:00Z',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockUpdatedVehicle,
    });

    const result = await updateVehicle('veh-1', {
      registrationNumber: 'TN01AB9999',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX(O)',
      color: 'White',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/vehicles/veh-1'),
      expect.objectContaining({
        method: 'PUT',
      })
    );
    expect(result.registrationNumber).toBe('TN01AB9999');
  });
});

describe('Job Cards API Client & Helpers', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls getJobCards with query params and returns paged job cards', async () => {
    const mockResponse = {
      items: [
        {
          id: 'jc-1',
          jobCardNumber: 'JC-2026-0001',
          customerName: 'Gokul Sharma',
          customerPhone: '9876543210',
          registrationNumber: 'TN01AB1234',
          make: 'Hyundai',
          model: 'Creta',
          status: 0,
          totalAmount: 1500,
          createdAt: '2026-02-01T10:00:00Z',
          updatedAt: null,
          invoiceId: null,
          invoiceNumber: null,
          invoiceStatus: null,
          isLocked: false,
        },
      ],
      totalCount: 1,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse,
    });

    const result = await api.getJobCards({ page: 1, pageSize: 20, status: 'Draft', search: 'JC-2026' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/job-cards?page=1&pageSize=20&status=Draft&search=JC-2026'),
      expect.anything()
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].jobCardNumber).toBe('JC-2026-0001');
  });

  it('calls getJobCardById with encoded ID', async () => {
    const mockJobCard = {
      id: 'jc-1',
      jobCardNumber: 'JC-2026-0001',
      customer: { id: 'cust-1', name: 'Gokul Sharma', phoneNumber: '9876543210' },
      vehicle: { id: 'veh-1', registrationNumber: 'TN01AB1234', make: 'Hyundai', model: 'Creta' },
      status: 0,
      notes: 'Initial checkup',
      totalAmount: 1500,
      createdAt: '2026-02-01T10:00:00Z',
      services: [
        {
          id: 'jcs-1',
          serviceId: 'svc-1',
          serviceName: 'Foam Wash',
          unitPrice: 800,
          quantity: 1,
          taxPercentage: 18,
          discountAmount: 0,
          lineTotal: 800,
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockJobCard,
    });

    const result = await api.getJobCardById('jc-1');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/job-cards/jc-1'),
      expect.anything()
    );
    expect(result.jobCardNumber).toBe('JC-2026-0001');
    expect(result.services).toHaveLength(1);
  });

  it('calls createJobCard with POST method and correct payload', async () => {
    const mockCreated = {
      id: 'jc-2',
      jobNumber: 'JC-2026-0002',
      customerId: 'cust-1',
      vehicleId: 'veh-1',
      status: 0,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockCreated,
    });

    const payload = {
      customerId: 'cust-1',
      vehicleId: 'veh-1',
      services: [{ serviceId: 'svc-1', quantity: 1, discountAmount: 0 }],
      notes: 'Please clean interior',
      isGstEnabled: true,
    };

    const result = await api.createJobCard(payload);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/job-cards'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
    expect(result.id).toBe('jc-2');
  });

  it('calls updateJobCardServices with PUT method and services payload', async () => {
    const mockUpdated = {
      id: 'jc-1',
      services: [{ serviceId: 'svc-2', quantity: 2, discountAmount: 100 }],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockUpdated,
    });

    const result = await api.updateJobCardServices('jc-1', [
      { serviceId: 'svc-2', quantity: 2, discountAmount: 100 },
    ]);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/job-cards/jc-1/services'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ services: [{ serviceId: 'svc-2', quantity: 2, discountAmount: 100 }] }),
      })
    );
    expect(result.services).toHaveLength(1);
  });

  it('correctly detects locked state using isJobCardLocked helper', () => {
    // 1. Explicit locked flag
    expect(api.isJobCardLocked({ isLocked: true })).toBe(true);

    // 2. Invoiced status numeric codes (4 = Invoiced, 5 = Paid, 6 = Delivered)
    expect(api.isJobCardLocked({ status: 4 })).toBe(true);
    expect(api.isJobCardLocked({ status: 5 })).toBe(true);
    expect(api.isJobCardLocked({ status: 6 })).toBe(true);

    // 3. Invoiced status string names
    expect(api.isJobCardLocked({ status: 'Invoiced' })).toBe(true);
    expect(api.isJobCardLocked({ status: 'Paid' })).toBe(true);
    expect(api.isJobCardLocked({ status: 'Delivered' })).toBe(true);

    // 4. Issued official invoice number
    expect(api.isJobCardLocked({ invoiceNumber: 'INV-2026-0001' })).toBe(true);

    // 5. Non-draft invoice associated
    expect(api.isJobCardLocked({ invoiceId: 'inv-1', invoiceStatus: 'Generated' })).toBe(true);

    // 6. Draft job card with no invoice or draft invoice
    expect(api.isJobCardLocked({ status: 0, invoiceId: null, invoiceNumber: null })).toBe(false);
    expect(api.isJobCardLocked({ status: 0, invoiceId: 'inv-1', invoiceStatus: 'Draft' })).toBe(false);
  });
});

describe('Services & Invoice Boundary API Client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls getServices with active filtering and pagination', async () => {
    const mockServicesResponse = {
      items: [
        {
          id: 'svc-1',
          name: 'Interior Detailing',
          category: 'Detailing',
          price: 1200,
          taxPercentage: 18,
          durationMinutes: 60,
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
          description: 'Full interior deep steam clean',
        },
      ],
      totalCount: 1,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockServicesResponse,
    });

    const result = await api.getServices({ page: 1, pageSize: 50, isActive: true });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/services?page=1&pageSize=50&isActive=true'),
      expect.anything()
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Interior Detailing');
  });

  it('calls createInvoiceFromJobCard with POST method and jobCardId path', async () => {
    const mockInvoice = {
      id: 'inv-1',
      jobCardId: 'jc-1',
      jobCardNumber: 'JC-2026-0001',
      invoiceNumber: null,
      status: 'Draft',
      totalAmount: 944,
      subtotal: 800,
      gstAmount: 144,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockInvoice,
    });

    const result = await api.createInvoiceFromJobCard('jc-1');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/invoices/from-job-card/jc-1'),
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(result.status).toBe('Draft');
    expect(result.jobCardId).toBe('jc-1');
  });

  it('calls generateInvoice with POST method to finalize invoice and issue official invoice number', async () => {
    const mockGeneratedInvoice = {
      id: 'inv-1',
      invoiceNumber: 'INV-2026-0001',
      status: 'Generated',
      totalAmount: 944,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockGeneratedInvoice,
    });

    const result = await api.generateInvoice('inv-1');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/invoices/inv-1/generate'),
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(result.invoiceNumber).toBe('INV-2026-0001');
    expect(result.status).toBe('Generated');
  });

  it('calls updateInvoice with PUT method to update discount and GST settings', async () => {
    const mockUpdatedInvoice = {
      id: 'inv-1',
      discount: 100,
      isGstEnabled: true,
      notes: 'Loyalty discount applied',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockUpdatedInvoice,
    });

    const result = await api.updateInvoice('inv-1', {
      discount: 100,
      isGstEnabled: true,
      notes: 'Loyalty discount applied',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/invoices/inv-1'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ discount: 100, isGstEnabled: true, notes: 'Loyalty discount applied' }),
      })
    );
    expect(result.discount).toBe(100);
  });
});

describe('Dashboard & Reports API Client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls getDashboardSummary with date range parameters', async () => {
    const mockSummary = {
      dateRange: { fromDate: '2026-03-01', toDate: '2026-03-08' },
      jobCardKpis: { totalJobCards: 10, newJobCards: 2, inProgressJobCards: 3, completedJobCards: 5, cancelledJobCards: 0, invoicedJobCards: 5 },
      vehicleActivity: { vehiclesServiced: 10, totalServicesCompleted: 15, uniqueVehiclesServiced: 8 },
      invoiceKpis: { draftCount: 1, generatedCount: 4, partiallyPaidCount: 1, paidCount: 3, cancelledCount: 0, totalInvoicedAmount: 50000, totalPaidAmount: 40000, totalOutstandingAmount: 10000 },
      sales: { grossSubtotal: 45000, totalDiscount: 2000, gstAmount: 7000, netSales: 50000, paymentCollection: 40000, outstanding: 10000 },
      paymentCollection: { totalCollected: 40000, cash: 20000, upi: 20000, card: 0, bankTransfer: 0 },
      recentActivity: [],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockSummary,
    });

    const result = await api.getDashboardSummary({ fromDate: '2026-03-01', toDate: '2026-03-08' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/reports/dashboard?fromDate=2026-03-01&toDate=2026-03-08'),
      expect.anything()
    );
    expect(result.sales.netSales).toBe(50000);
  });
});

describe('Showrooms & Daily Operations API Client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls getShowrooms with search and isActive query parameters', async () => {
    const mockShowrooms = [
      { id: 'sr-1', name: 'Popular Hyundai', address: 'Anna Salai', isActive: true, activeStaffCountToday: 2, totalVehiclesToday: 6, createdAt: '2026-01-01T00:00:00Z' },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockShowrooms,
    });

    const result = await api.getShowrooms({ search: 'Hyundai', isActive: true });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/showrooms?search=Hyundai&isActive=true'),
      expect.anything()
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Popular Hyundai');
  });

  it('calls createShowroom with POST method and payload', async () => {
    const mockCreated = { id: 'sr-2', name: 'KUN BMW', address: 'OMR Road', phone: '9876500001', isActive: true, activeStaffCountToday: 0, totalVehiclesToday: 0, createdAt: '2026-01-01T00:00:00Z' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockCreated,
    });

    const result = await api.createShowroom({ name: 'KUN BMW', address: 'OMR Road', phone: '9876500001', isActive: true });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/showrooms'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'KUN BMW', address: 'OMR Road', phone: '9876500001', isActive: true }),
      })
    );
    expect(result.id).toBe('sr-2');
  });

  it('calls getDailyStaff and confirmDailyStaffAttendance endpoints', async () => {
    const mockDailyStaff = {
      showroomId: 'sr-1',
      showroomName: 'Popular Hyundai',
      date: '2026-03-08',
      totalVehiclesAttended: 6,
      isAttendanceConfirmed: true,
      staffAssignments: [],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockDailyStaff,
    });

    await api.getDailyStaff('sr-1', '2026-03-08');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/showrooms/sr-1/daily-staff?date=2026-03-08'),
      expect.anything()
    );

    await api.confirmDailyStaffAttendance('sr-1', '2026-03-08');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/showrooms/sr-1/daily-staff/confirm?date=2026-03-08'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('calls updateDailyStaffVehicles and setShowroomDailyBill', async () => {
    const mockAssignment = { id: 'assign-1', showroomId: 'sr-1', showroomName: 'Hyundai', staffId: 'st-1', staffName: 'Karthik', staffPhone: '9876540001', date: '2026-03-08', vehiclesAttended: 7, createdAt: '2026-03-08T00:00:00Z' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockAssignment,
    });

    await api.updateDailyStaffVehicles('assign-1', 7);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/showroom-staff-assignments/assign-1'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ vehiclesAttended: 7 }),
      })
    );

    const mockBill = { id: 'bill-1', showroomId: 'sr-1', showroomName: 'Hyundai', date: '2026-03-08', amount: 3500, amountReceived: 0, balanceAmount: 3500, status: 'Unpaid', payments: [], createdAt: '2026-03-08T00:00:00Z' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockBill,
    });

    await api.setShowroomDailyBill('sr-1', '2026-03-08', { amount: 3500, notes: 'Daily car wash count' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/showrooms/sr-1/daily-bill?date=2026-03-08'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ amount: 3500, notes: 'Daily car wash count' }),
      })
    );
  });

  it('calls showroom vehicle types and work types APIs', async () => {
    const mockVehicleTypes = [
      { id: 'vt-1', code: 'SEDAN', name: 'Sedan', displayOrder: 1, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockVehicleTypes,
    });

    const vTypes = await api.getShowroomVehicleTypes(false);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/showroom-vehicle-types'),
      expect.anything()
    );
    expect(vTypes).toHaveLength(1);
    expect(vTypes[0].code).toBe('SEDAN');

    const mockWorkTypes = [
      { id: 'wt-1', code: 'BODYWASH', name: 'Body Wash', displayOrder: 1, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockWorkTypes,
    });

    const wTypes = await api.getShowroomWorkTypes(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/showroom-work-types?includeInactive=true'),
      expect.anything()
    );
    expect(wTypes).toHaveLength(1);
    expect(wTypes[0].code).toBe('BODYWASH');
  });

  it('calls showroom operations (vehicle works, work sessions, summary) APIs', async () => {
    const mockWorks = [
      {
        id: 'vw-1',
        showroomId: 'sr-1',
        showroomMasterId: 'PO10001',
        showroomName: 'Popular Hyundai',
        staffId: 'st-1',
        staffMasterId: 'GO123L',
        staffName: 'Gokul',
        vehicleTypeId: 'vt-1',
        vehicleTypeCode: 'SEDAN',
        vehicleTypeName: 'Sedan',
        vehicleQuantity: 1,
        date: '2026-09-25T00:00:00Z',
        serviceItems: [
          { id: 'item-1', showroomVehicleWorkId: 'vw-1', workTypeId: 'wt-1', workTypeCode: 'BODYWASH', workTypeName: 'Body Wash', quantity: 1, createdAt: '2026-09-25T00:00:00Z' },
        ],
        createdAt: '2026-09-25T00:00:00Z',
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockWorks,
    });

    const works = await api.getShowroomVehicleWorks('sr-1', { date: '2026-09-25' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/showrooms/sr-1/vehicle-works?date=2026-09-25'),
      expect.anything()
    );
    expect(works).toHaveLength(1);
    expect(works[0].vehicleTypeName).toBe('Sedan');

    const mockSummary = {
      showroomId: 'sr-1',
      showroomMasterId: 'PO10001',
      showroomName: 'Popular Hyundai',
      fromDate: '2026-09-25T00:00:00Z',
      toDate: '2026-09-25T00:00:00Z',
      totalVehiclesHandled: 1,
      totalServicesPerformed: 1,
      totalActiveStaffSessions: 1,
      vehicleTypeBreakdown: [{ vehicleTypeId: 'vt-1', vehicleTypeCode: 'SEDAN', vehicleTypeName: 'Sedan', totalVehicles: 1 }],
      workTypeBreakdown: [{ workTypeId: 'wt-1', workTypeCode: 'BODYWASH', workTypeName: 'Body Wash', totalQuantity: 1 }],
      staffProductivityBreakdown: [],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockSummary,
    });

    const summary = await api.getShowroomOperationsSummary('sr-1', '2026-09-25');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/showrooms/sr-1/operations-summary?date=2026-09-25'),
      expect.anything()
    );
    expect(summary.totalVehiclesHandled).toBe(1);
  });
});

describe('Staff Advances API Client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls getStaffAdvances with pagination and status filter', async () => {
    const mockAdvancesResult = {
      items: [
        { id: 'adv-1', staffId: 'st-1', staffName: 'Karthik', amount: 5000, advanceDate: '2026-03-01', reason: 'Emergency', status: 'Outstanding', createdAt: '2026-03-01T00:00:00Z' },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      summary: { outstandingCount: 1, outstandingAmount: 5000, settledCount: 0, settledAmount: 0, totalActiveCount: 1, totalActiveAmount: 5000 },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockAdvancesResult,
    });

    const result = await api.getStaffAdvances({ page: 1, pageSize: 20, status: 'Outstanding' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/staff-advances?page=1&pageSize=20&status=Outstanding'),
      expect.anything()
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].amount).toBe(5000);
  });

  it('calls createStaffAdvance with POST method and body', async () => {
    const mockCreatedAdvance = { id: 'adv-2', staffId: 'st-2', staffName: 'Senthil', amount: 3000, advanceDate: '2026-03-05', reason: 'Personal', status: 'Outstanding', createdAt: '2026-03-05T00:00:00Z' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockCreatedAdvance,
    });

    const result = await api.createStaffAdvance({
      staffId: 'st-2',
      amount: 3000,
      advanceDate: '2026-03-05',
      reason: 'Personal',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/staff-advances'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ staffId: 'st-2', amount: 3000, advanceDate: '2026-03-05', reason: 'Personal' }),
      })
    );
    expect(result.id).toBe('adv-2');
  });

  it('calls settleStaffAdvance and obsoleteStaffAdvance endpoints', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 'adv-1', status: 'Settled' }),
    });

    await api.settleStaffAdvance('adv-1');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/staff-advances/adv-1/settle'),
      expect.objectContaining({ method: 'POST' })
    );

    await api.obsoleteStaffAdvance('adv-1', { reason: 'Entered by mistake' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/staff-advances/adv-1/obsolete'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Entered by mistake' }),
      })
    );
  });
});

describe('User Management & Permissions API Client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls getUsers and getAvailablePermissions endpoints', async () => {
    const mockUsers = [
      { id: 'usr-1', username: 'admin', fullName: 'Admin User', role: 'Owner', isActive: true, permissions: ['*'], createdAt: '2026-01-01T00:00:00Z' },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockUsers,
    });

    const result = await api.getUsers();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/users'),
      expect.anything()
    );
    expect(result).toHaveLength(1);

    await api.getAvailablePermissions();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/permissions'),
      expect.anything()
    );
  });

  it('calls createUser with POST method and payload', async () => {
    const mockCreatedUser = { id: 'usr-2', username: 'priya_mgr', fullName: 'Priya Sharma', role: 'Manager', isActive: true, permissions: ['job_cards.create'], createdAt: '2026-03-08T00:00:00Z' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockCreatedUser,
    });

    const result = await api.createUser({
      fullName: 'Priya Sharma',
      username: 'priya_mgr',
      password: 'password123',
      confirmPassword: 'password123',
      role: 'Manager',
      permissionCodes: ['job_cards.create'],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/users'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Priya Sharma',
          username: 'priya_mgr',
          password: 'password123',
          confirmPassword: 'password123',
          role: 'Manager',
          permissionCodes: ['job_cards.create'],
        }),
      })
    );
    expect(result.username).toBe('priya_mgr');
  });

  it('calls updateUser and toggleUserStatus endpoints', async () => {
    const mockUpdatedUser = { id: 'usr-2', username: 'priya_mgr', fullName: 'Priya Sharma Senior', role: 'Manager', isActive: true, permissions: ['job_cards.create'], createdAt: '2026-03-08T00:00:00Z' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockUpdatedUser,
    });

    await api.updateUser('usr-2', { fullName: 'Priya Sharma Senior', role: 'Manager' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/usr-2'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          fullName: 'Priya Sharma Senior',
          role: 'Manager',
        }),
      })
    );

    await api.toggleUserStatus('usr-2');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/usr-2/toggle-status'),
      expect.objectContaining({ method: 'PATCH' })
    );
  });
});

describe('WhatsApp Integration API Client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls getWhatsAppConfig endpoint with GET method', async () => {
    const mockConfig = {
      isEnabled: true,
      phoneNumberId: '109876543210987',
      businessAccountId: '209876543210987',
      graphApiVersion: 'v25.0',
      hasAccessToken: true,
      invoiceNotificationsEnabled: true,
      paymentCompletedNotificationsEnabled: true,
      invoiceTemplateName: 'e6_carspa_invoice_generated',
      invoiceTemplateLanguage: 'en_US',
      paymentCompletedTemplateName: 'e6_carspa_payment_completed',
      paymentCompletedTemplateLanguage: 'en_US',
      healthStatus: 'Healthy',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockConfig,
    });

    const result = await api.getWhatsAppConfig();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/settings/whatsapp'),
      expect.anything()
    );
    expect(result.isEnabled).toBe(true);
    expect(result.hasAccessToken).toBe(true);
  });

  it('calls updateWhatsAppConfig with PUT method and payload', async () => {
    const mockUpdated = {
      isEnabled: true,
      phoneNumberId: '109876543210987',
      businessAccountId: '209876543210987',
      hasAccessToken: true,
      invoiceNotificationsEnabled: true,
      paymentCompletedNotificationsEnabled: true,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockUpdated,
    });

    const result = await api.updateWhatsAppConfig({
      isEnabled: true,
      phoneNumberId: '109876543210987',
      businessAccountId: '209876543210987',
      accessToken: 'EAABwz...',
      invoiceNotificationsEnabled: true,
      paymentCompletedNotificationsEnabled: true,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/settings/whatsapp'),
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"phoneNumberId":"109876543210987"'),
      })
    );
    expect(result.isEnabled).toBe(true);
  });

  it('calls getWhatsAppHealth with probe=true and probe=false', async () => {
    const mockHealth = {
      status: 'Healthy',
      isConfigured: true,
      lastCheckedAtUtc: '2026-02-01T12:00:00Z',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockHealth,
    });

    // Default (cached / quick health)
    await api.getWhatsAppHealth(false);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/settings/whatsapp/health'),
      expect.anything()
    );

    // Live probe
    await api.getWhatsAppHealth(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/settings/whatsapp/health?probe=true'),
      expect.anything()
    );
  });

  it('calls testWhatsAppConnection and sendTestWhatsAppMessage endpoints', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ isSuccess: true, message: 'Message sent', messageId: 'wamid.123' }),
    });

    const connResult = await api.testWhatsAppConnection({
      phoneNumberId: '123',
      businessAccountId: '456',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/settings/whatsapp/test'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(connResult.isSuccess).toBe(true);

    const sendResult = await api.sendTestWhatsAppMessage({
      templateName: 'e6_carspa_invoice_generated',
      languageCode: 'en_US',
      recipientPhoneNumber: '+919876543210',
      parameters: ['Gokul', '500', 'TN01AB1234'],
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/settings/whatsapp/test-message'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"templateName":"e6_carspa_invoice_generated"'),
      })
    );
    expect(sendResult.messageId).toBe('wamid.123');
  });

  it('calls getWhatsAppTemplates and getInvoiceWhatsAppStatus endpoints', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => [{ messageType: 'InvoiceFinalized', status: 'Sent', attemptCount: 1 }],
    });

    const waStatus = await api.getInvoiceWhatsAppStatus('inv-1');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/invoices/inv-1/whatsapp-status'),
      expect.anything()
    );
    expect(waStatus).toHaveLength(1);
    expect(waStatus[0].status).toBe('Sent');
  });
});

describe('Business Profile & Settings API Client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls getBusinessProfile and updates localStorage cache', async () => {
    const mockProfile = {
      id: 'biz-1',
      businessName: 'E6 Car Spa',
      addressLine1: '36, Geetha Nagar',
      city: 'Erode',
      state: 'Tamil Nadu',
      postalCode: '638011',
      phone: '9578749449',
      email: 'info@e6carspa.com',
      invoicePrefix: 'INV',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockProfile,
    });

    const result = await api.getBusinessProfile();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/settings/business'),
      expect.anything()
    );
    expect(result.businessName).toBe('E6 Car Spa');
    expect(api.getCachedBusinessProfile()?.businessName).toBe('E6 Car Spa');
  });

  it('calls getPublicBusinessProfile and updates cached public branding', async () => {
    const mockPublicProfile = {
      businessName: 'Royal Auto Spa',
      logoPath: '/uploads/logos/royal.png',
      updatedAt: '2026-09-10T12:00:00Z',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockPublicProfile,
    });

    const result = await api.getPublicBusinessProfile();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/public/business-profile'),
      expect.anything()
    );
    expect(result.businessName).toBe('Royal Auto Spa');
    expect(result.logoPath).toBe('/uploads/logos/royal.png');
    expect(api.getCachedBusinessProfile()?.businessName).toBe('Royal Auto Spa');
    expect(api.getCachedBusinessProfile()?.logoPath).toBe('/uploads/logos/royal.png');
  });

  it('calls updateBusinessProfile with sanitized payload', async () => {
    const mockUpdated = {
      id: 'biz-1',
      businessName: 'E6 Car Spa Prime',
      addressLine1: '36, Geetha Nagar',
      city: 'Erode',
      state: 'Tamil Nadu',
      postalCode: '638011',
      phone: '9578749449',
      email: 'info@e6carspa.com',
      invoicePrefix: 'INV',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockUpdated,
    });

    const result = await api.updateBusinessProfile({
      businessName: 'E6 Car Spa Prime',
      addressLine1: '36, Geetha Nagar',
      city: 'Erode',
      state: 'Tamil Nadu',
      postalCode: '638011',
      phone: '9578749449',
      email: 'info@e6carspa.com',
      invoicePrefix: 'INV',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/settings/business'),
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"businessName":"E6 Car Spa Prime"'),
      })
    );
    expect(result.businessName).toBe('E6 Car Spa Prime');
  });

  it('calls uploadBusinessLogo with FormData and removeBusinessLogo with DELETE', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ logoUrl: '/uploads/logo.png', profile: { logoPath: '/uploads/logo.png' } }),
    });

    const dummyFile = new File(['logo bytes'], 'logo.png', { type: 'image/png' });
    await api.uploadBusinessLogo(dummyFile);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/settings/business/logo'),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );

    await api.removeBusinessLogo();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/settings/business/logo'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('correctly resolves logo URLs with relative paths and version cache busters', () => {
    expect(api.resolveLogoUrl(null)).toBe('/e6-logo.png');
    expect(api.resolveLogoUrl('')).toBe('/e6-logo.png');
    expect(api.resolveLogoUrl('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png');
    expect(api.resolveLogoUrl('/uploads/biz.png', '2026-02-01T10:00:00Z')).toContain('?v=2026-02-01T10%3A00%3A00Z');
  });
});

describe('Audit Logs API Client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls getAuditLogs with serialized query parameters', async () => {
    const mockAuditResult = {
      items: [
        {
          id: 'log-1',
          timestampUtc: '2026-02-01T10:00:00Z',
          userId: 'usr-1',
          userName: 'Admin User',
          userRole: 'Owner',
          action: 'Update',
          module: 'Settings',
          description: 'Updated business profile',
          outcome: 'Success',
          createdAt: '2026-02-01T10:00:00Z',
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockAuditResult,
    });

    const result = await api.getAuditLogs({
      page: 1,
      pageSize: 20,
      module: 'Settings',
      action: 'Update',
      outcome: 'Success',
      search: 'business',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/audit-logs?page=1&pageSize=20&module=Settings&action=Update&outcome=Success&search=business'),
      expect.anything()
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].module).toBe('Settings');
  });

  it('calls staff attendance getDaily, confirm, and unlock endpoints', async () => {
    const mockDaily = {
      date: '2026-09-22',
      isAttendanceConfirmed: true,
      attendanceConfirmedAt: '2026-09-22T18:00:00Z',
      attendanceConfirmedByName: 'Admin',
      summary: {
        totalActiveStaff: 1,
        presentCount: 1,
        halfDayCount: 0,
        leaveCount: 0,
        unmarkedCount: 0,
      },
      staffMembers: [],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockDaily,
    });

    await api.getDailyAttendance('2026-09-22');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/staff-attendance?date=2026-09-22'),
      expect.anything()
    );

    await api.confirmStaffAttendance('2026-09-22');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/staff-attendance/confirm?date=2026-09-22'),
      expect.objectContaining({ method: 'POST' })
    );

    await api.unlockStaffAttendance('2026-09-22');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/staff-attendance/unlock?date=2026-09-22'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

