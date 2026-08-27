using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace CarSpaManagement.Api.Infrastructure.Database;

public static class PermissionSeeder
{
    public static readonly (string Code, string Name, string Module, string Description)[] StandardPermissions =
    [
        // Dashboard
        ("dashboard.view", "View Dashboard", "Dashboard", "Allows viewing dashboard overview and analytics"),

        // Customers
        ("customers.view", "View Customers", "Customers", "Allows viewing customer profiles and directory"),
        ("customers.create", "Create Customers", "Customers", "Allows adding new customers"),
        ("customers.edit", "Edit Customers", "Customers", "Allows updating customer details"),
        ("customers.delete", "Delete Customers", "Customers", "Allows deleting customer records"),

        // Vehicles
        ("vehicles.view", "View Vehicles", "Vehicles", "Allows viewing customer vehicles"),
        ("vehicles.create", "Create Vehicles", "Vehicles", "Allows registering new vehicles"),
        ("vehicles.edit", "Edit Vehicles", "Vehicles", "Allows updating vehicle details"),
        ("vehicles.delete", "Delete Vehicles", "Vehicles", "Allows deleting customer vehicles"),

        // Job Cards
        ("jobcards.view", "View Job Cards", "Job Cards", "Allows viewing job card lists and details"),
        ("jobcards.create", "Create Job Cards", "Job Cards", "Allows creating new job cards"),
        ("jobcards.edit", "Edit Job Cards", "Job Cards", "Allows editing and updating job cards"),
        ("jobcards.delete", "Delete Job Cards", "Job Cards", "Allows deleting job cards"),
        ("jobcards.print", "Print Job Cards", "Job Cards", "Allows printing job cards"),

        // Catalogue
        ("catalogue.view", "View Catalogue", "Catalogue", "Allows viewing services and catalogue items"),
        ("catalogue.create", "Create Catalogue Item", "Catalogue", "Allows adding new services to the catalogue"),
        ("catalogue.edit", "Edit Catalogue Item", "Catalogue", "Allows updating service details and catalogue pricing"),
        ("catalogue.delete", "Delete Catalogue Item", "Catalogue", "Allows deleting services from the catalogue"),

        // Invoices
        ("invoices.view", "View Invoices", "Invoices", "Allows viewing invoices and payment history"),
        ("invoices.edit_draft", "Edit Draft Invoices", "Invoices", "Allows editing draft invoices"),
        ("invoices.generate", "Generate Invoices", "Invoices", "Allows generating final tax invoices"),
        ("invoices.cancel", "Cancel Invoices", "Invoices", "Allows cancelling invoices"),
        ("invoices.discount", "Apply Discounts", "Invoices", "Allows applying discounts to invoices and job cards"),
        ("invoices.price_override", "Override Prices", "Invoices", "Allows overriding standard catalogue prices on billing items"),
        ("invoices.record_payment", "Record Payment", "Invoices", "Allows recording payments against invoices"),
        ("invoices.print", "Print Invoices", "Invoices", "Allows printing generated invoices"),

        // Payments
        ("payments.view", "View Payments", "Payments", "Allows viewing invoice and customer payment records"),
        ("payments.record", "Record Payment", "Payments", "Allows recording payments received"),
        ("payments.edit", "Edit Payment", "Payments", "Allows updating payment transaction details"),
        ("payments.void", "Void Payment", "Payments", "Allows voiding or reversing payment transactions"),

        // Showroom
        ("showroom.view", "View Showroom", "Showroom", "Allows viewing showroom daily activities and dashboard"),
        ("showroom.manage", "Manage Showrooms", "Showroom", "Allows creating and managing showrooms"),
        ("showroom.assign_staff", "Assign Staff", "Showroom", "Allows assigning staff to showroom for the day"),
        ("showroom.edit_attendance", "Edit Attendance", "Showroom", "Allows updating staff vehicle counts"),
        ("showroom.confirm_attendance", "Confirm Attendance", "Showroom", "Allows confirming showroom daily attendance"),
        ("showroom.manage_billing", "Manage Billing", "Showroom", "Allows setting daily showroom billing amount"),
        ("showroom.record_payment", "Record Payment", "Showroom", "Allows recording payments from showrooms"),
        ("showroom.delete_payment", "Delete Showroom Payment", "Showroom", "Allows deleting showroom payment transactions"),
        ("showroom.view_history", "View History", "Showroom", "Allows viewing historical records and productivity"),

        // Staff & Staff Advances
        ("staff.view", "View Staff", "Staff", "Allows viewing staff members"),
        ("staff.create", "Create Staff", "Staff", "Allows adding new staff members"),
        ("staff.edit", "Edit Staff", "Staff", "Allows updating staff details"),
        ("staff.delete", "Delete Staff", "Staff", "Allows deleting staff member records"),
        ("staff.advances", "Manage Advances", "Staff", "Allows issuing and tracking staff advances"),
        ("staff_advances.view", "View Staff Advances", "Staff Advances", "Allows viewing staff advances and history"),
        ("staff_advances.create", "Create Staff Advance", "Staff Advances", "Allows recording new staff advances"),
        ("staff_advances.edit", "Edit Staff Advance", "Staff Advances", "Allows editing staff advance details"),
        ("staff_advances.delete", "Delete Staff Advance", "Staff Advances", "Allows deleting staff advance records"),
        ("staff_advances.settle", "Settle Staff Advance", "Staff Advances", "Allows marking staff advances as settled upon salary recovery"),
        ("staff_advances.obsolete", "Obsolete Staff Advance", "Staff Advances", "Allows marking staff advances as obsolete with mandatory reason"),

        // Reports
        ("reports.view", "View Reports", "Reports", "Allows viewing business and financial reports"),
        ("reports.sales", "Sales Report", "Reports", "Allows viewing sales and revenue reports"),
        ("reports.payments", "Payment Collection Report", "Reports", "Allows viewing payment collection reports"),
        ("reports.invoices", "Outstanding Invoice Report", "Reports", "Allows viewing outstanding invoices and ageing"),
        ("reports.gst", "GST Report", "Reports", "Allows viewing tax and GST summary reports"),
        ("reports.job_cards", "Job Card Report", "Reports", "Allows viewing job card activity and status reports"),
        ("reports.showrooms", "Showroom Report", "Reports", "Allows viewing showroom daily billing and attendance reports"),
        ("reports.staff_productivity", "Staff Productivity Report", "Reports", "Allows viewing staff assignment and productivity reports"),
        ("reports.staff_advances", "Staff Advances Report", "Reports", "Allows viewing staff advances and settlement reports"),
        ("reports.export", "Export Reports", "Reports", "Allows exporting reports to Excel/PDF"),

        // Audit
        ("audit.view", "View Audit Trail", "Audit", "Allows viewing system audit history."),

        // Settings
        ("settings.view", "View Settings", "Settings", "Allows viewing application settings"),
        ("settings.edit", "Edit Settings", "Settings", "Allows updating application configuration"),
        ("settings.business", "Manage Business Settings", "Settings", "Allows managing business profile, company details, and invoice configuration"),

        // Users
        ("users.view", "View Users", "Users", "Allows viewing user accounts and permissions"),
        ("users.create", "Create Users", "Users", "Allows adding new Manager and Staff users"),
        ("users.edit", "Edit Users", "Users", "Allows updating user accounts and permissions"),
        ("users.deactivate", "Deactivate Users", "Users", "Allows activating and deactivating users")
    ];

    public static async Task SeedAsync(AppDbContext db)
    {
        var existingCodes = await db.Permissions
            .Select(p => p.Code)
            .ToHashSetAsync();

        var missingPermissions = StandardPermissions
            .Where(sp => !existingCodes.Contains(sp.Code))
            .Select(sp => new Permission
            {
                Id = Guid.NewGuid(),
                Code = sp.Code,
                Name = sp.Name,
                Module = sp.Module,
                Description = sp.Description,
                CreatedAt = DateTime.UtcNow
            })
            .ToList();

        if (missingPermissions.Count > 0)
        {
            await db.Permissions.AddRangeAsync(missingPermissions);
            await db.SaveChangesAsync();
            Log.Information("Idempotently seeded {Count} new permissions into database", missingPermissions.Count);
        }
    }
}
