using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class TenantRowLevelSecurity : Migration
    {
        // Every company-owned table. A test checks this list against the model, so a new table cannot be forgotten.
        private static readonly string[] CompanyTables =
        {
            "AuditLogs",
            "BusinessProfiles",
            "Customers",
            "InvoiceItems",
            "InvoiceNumberAllocations",
            "InvoiceNumberSeries",
            "InvoicePublicLinks",
            "Invoices",
            "JobCardServices",
            "JobCards",
            "OrganizationCounters",
            "OutsideJobs",
            "Payments",
            "Services",
            "ShowroomDailyAttendances",
            "ShowroomDailyBills",
            "ShowroomPayments",
            "ShowroomStaffAssignments",
            "ShowroomStaffSwaps",
            "ShowroomStaffWorkSessions",
            "ShowroomVehicleTypes",
            "ShowroomVehicleWorkItems",
            "ShowroomVehicleWorks",
            "ShowroomWorkTypes",
            "Showrooms",
            "Staff",
            "StaffAdvances",
            "StaffAttendances",
            "StaffDailyAttendanceConfirmations",
            "StaffSalarySettlements",
            "SystemPreferences",
            "UserPermissions",
            "Users",
            "Vehicles",
            "Vendors",
            "WhatsAppConfigurations",
            "WhatsAppMessages"
        };

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Row-level security is the second lock behind the application's query filters. The API tells the
            // connection which company it works for (app.current_org); with no company set, no row is visible or
            // writable. FORCE applies the policy to the table owner too. PostgreSQL superusers always bypass row
            // security, so production must connect as an ordinary (non-superuser) role.
            //
            // app.bypass_rls = 'on' exists only for migrations and platform maintenance that must touch every
            // company's rows; the API never sets it.
            foreach (var table in CompanyTables)
            {
                migrationBuilder.Sql($@"ALTER TABLE ""{table}"" ENABLE ROW LEVEL SECURITY;");
                migrationBuilder.Sql($@"ALTER TABLE ""{table}"" FORCE ROW LEVEL SECURITY;");
                migrationBuilder.Sql($@"CREATE POLICY tenant_isolation ON ""{table}""
                    USING (""OrganizationId"" = NULLIF(current_setting('app.current_org', true), '')::uuid
                           OR current_setting('app.bypass_rls', true) = 'on')
                    WITH CHECK (""OrganizationId"" = NULLIF(current_setting('app.current_org', true), '')::uuid
                           OR current_setting('app.bypass_rls', true) = 'on');");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in CompanyTables)
            {
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS tenant_isolation ON ""{table}"";");
                migrationBuilder.Sql($@"ALTER TABLE ""{table}"" NO FORCE ROW LEVEL SECURITY;");
                migrationBuilder.Sql($@"ALTER TABLE ""{table}"" DISABLE ROW LEVEL SECURITY;");
            }
        }
    }
}
