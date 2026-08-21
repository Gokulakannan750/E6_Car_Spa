# Backend Phase 2 — Customer, Vehicle and Service APIs
## Report

**Date:** 2026-08-19
**Phase:** Backend Phase 2 — Customer, Vehicle and Service APIs
**UI Changes:** None

---

## 1. Files Created

### Application Layer

| File | Purpose |
|------|---------|
| `Application/DTOs/Customers/CustomerDtos.cs` | Customer DTOs + DataAnnotations |
| `Application/DTOs/Vehicles/VehicleDtos.cs` | Vehicle DTOs + DataAnnotations |
| `Application/DTOs/Services/ServiceDtos.cs` | Service DTOs + DataAnnotations |
| `Application/Interfaces/ICustomerService.cs` | Customer service contract |
| `Application/Interfaces/IVehicleService.cs` | Vehicle service contract |
| `Application/Interfaces/IServiceService.cs` | Service service contract |
| `Application/Services/CustomerService.cs` | Customer business logic |
| `Application/Services/VehicleService.cs` | Vehicle business logic |
| `Application/Services/ServiceService.cs` | Service business logic |

### Infrastructure Layer

| File | Change |
|------|--------|
| `Infrastructure/Database/AppDbContext.cs` | Added `DbSet<>` properties for all 5 entity types |
| `Infrastructure/Database/DependencyInjection.cs` | Npgsql provider (from Phase 1) |

### Presentation Layer

| File | Purpose |
|------|---------|
| `Controllers/CustomersController.cs` | Full CRUD REST API |
| `Controllers/vehiclesController.cs` | Full CRUD REST API |
| `Controllers/ServicesController.cs` | Full CRUD REST API |

### Updated

| File | Change |
|------|--------|
| `Program.cs` | DI registration + ValidationProblemDetails behavior |

---

## 2. Validation

**Used DataAnnotations on DTO records** (no FluentValidation package — built-in ASP.NET Core model validation sufficient).

| DTO | Validations |
|-----|-------------|
| `CreateCustomerRequest` | Required Name, PhoneNumber; MaxLength; Email format |
| `UpdateCustomerRequest` | Same as Create |
| `CreateVehicleRequest` | Required Name, RegistrationNumber, Make, Model, CustomerId |
| `UpdateVehicleRequest` | Required Name, RegistrationNumber, Make, Model |
| `CreateServiceRequest` | Required Name, Price, TaxPercentage; Range checks on Price/Tax |
| `UpdateServiceRequest` | Same as Create |

Invalid requests return `ProblemDetails` (400 Bad Request) with structured field-level errors.

---

## 3. API Endpoints

### Customers (`/api/customers`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/customers/{id}` | Get customer by ID |
| GET | `/api/customers/by-phone/{phoneNumber}` | Lookup by phone |
| GET | `/api/customers?page=&pageSize=&search=` | Paginated list, search on name/phone/email |
| POST | `/api/customers` | Create (validates phone uniqueness) |
| PUT | `/api/customers/{id}` | Update (validates phone uniqueness excluding self) |
| DELETE | `/api/customers/{id}` | Soft delete |

### Vehicles (`/api/vehicles`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/vehicles/{id}` | Get vehicle by ID |
| GET | `/api/vehicles/by-customer/{customerId}` | Vehicles for a customer |
| GET | `/api/vehicles?page=&pageSize=&search=` | Paginated list, search on reg/make/model |
| POST | `/api/vehicles` | Create (validates customer exists) |
| PUT | `/api/vehicles/{id}` | Update |
| DELETE | `/api/vehicles/{id}` | Soft delete |

### Services (`/api/services`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/services/{id}` | Get service by ID |
| GET | `/api/services/categories` | Get distinct active categories |
| GET | `/api/services?isActive=&page=&pageSize=&search=&category=` | Paginated list, filter by active/category/search |
| POST | `/api/services` | Create |
| PUT | `/api/services/{id}` | Update |
| DELETE | `/api/services/{id}` | Soft delete |

---

## 4. Business Logic

- **Soft delete** — All entities use `IsDeleted` (database-level + global query filter)
- **CreatedAt / UpdatedAt** — Auto-managed by `SaveChangesAsync` override in AppDbContext (no trigger dependencies)
- **Duplicate prevention** — Phone number uniqueness (customers), registration number uniqueness (vehicles), service name uniqueness
- **Customer lookup** — Vehicle creation validates customer exists
- **Search** — Case-insensitive search on relevant fields
- **Pagination** — Configurable page/pageSize on all list endpoints

---

## 5. Build Result

```
Build succeeded.
0 Warning(s)
0 Error(s)
Time Elapsed 00:00:02.95
```

---

## 6. Runtime Verification

All endpoints tested and confirmed working:

| Endpoint | Status |
|----------|--------|
| `GET /api/health` | Healthy ✅ |
| `POST /api/customers` | 201 Created ✅ |
| `GET /api/customers/{id}` | 200 OK ✅ |
| `GET /api/customers/by-phone/{phone}` | 200 OK ✅ |
| `POST /api/vehicles` | 201 Created ✅ |
| `GET /api/vehicles/{id}` | 200 OK ✅ |
| `GET /api/vehicles/by-customer/{id}` | 200 OK ✅ |
| `GET /api/vehicles` (paginated) | 200 OK ✅ |
| `POST /api/services` | 201 Created ✅ |
| `GET /api/services` (filtered) | 200 OK ✅ |
| `GET /api/services/categories` | 200 OK ✅ |
| Validation: missing Name | 400 Bad Request ✅ |
| Validation: invalid email | 400 Bad Request ✅ |

---

## 7. Database Status

- **E6CarSpaNew** — clean (0 rows in all business tables)
- **PostgreSQL 18.4** on port 5432
- **5 tables** with 14 indexes, 5 foreign keys, 1 unique constraint
- All verified from Phase 1

---

## 8. No UI Changes

Zero changes made to the frontend. All work was strictly backend.

---

## 9. Remaining Issues

**None.** All steps complete.

---

Ready for **Backend Phase 3** (Job Card APIs) whenever you are.
