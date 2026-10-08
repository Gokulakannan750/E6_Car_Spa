using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class TenantFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_WhatsAppConfigurations_Singleton",
                table: "WhatsAppConfigurations");

            migrationBuilder.DropIndex(
                name: "UX_Vehicles_RegistrationNumber",
                table: "Vehicles");

            migrationBuilder.DropIndex(
                name: "IX_Users_SingleOwner",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_Username",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "UX_SystemPreferences_Singleton",
                table: "SystemPreferences");

            migrationBuilder.DropIndex(
                name: "IX_StaffDailyAttendanceConfirmations_Date",
                table: "StaffDailyAttendanceConfirmations");

            migrationBuilder.DropIndex(
                name: "IX_Staff_StaffMasterId",
                table: "Staff");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomWorkTypes_Code",
                table: "ShowroomWorkTypes");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomVehicleTypes_Code",
                table: "ShowroomVehicleTypes");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomStaffSwaps_SwapId",
                table: "ShowroomStaffSwaps");

            migrationBuilder.DropIndex(
                name: "IX_Showrooms_MasterId",
                table: "Showrooms");

            migrationBuilder.DropIndex(
                name: "UX_JobCards_JobCardNumber",
                table: "JobCards");

            migrationBuilder.DropIndex(
                name: "UX_Invoices_InvoiceNumber",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "UX_InvoiceNumberSeries_SeriesKind",
                table: "InvoiceNumberSeries");

            migrationBuilder.DropIndex(
                name: "UX_InvoiceNumberAllocations_NormalizedNumber",
                table: "InvoiceNumberAllocations");

            migrationBuilder.DropIndex(
                name: "UX_BusinessProfiles_Singleton",
                table: "BusinessProfiles");

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "WhatsAppMessages",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "WhatsAppConfigurations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Vendors",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Vehicles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Users",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "UserPermissions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "SystemPreferences",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "StaffSalarySettlements",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "StaffDailyAttendanceConfirmations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "StaffAttendances",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "StaffAdvances",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Staff",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomWorkTypes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomVehicleWorks",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomVehicleWorkItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomVehicleTypes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomStaffWorkSessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomStaffSwaps",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomStaffAssignments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Showrooms",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomPayments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomDailyBills",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomDailyAttendances",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Services",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "OutsideJobs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "JobCardServices",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "JobCards",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Invoices",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "InvoicePublicLinks",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "InvoiceNumberSeries",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "InvoiceNumberAllocations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "InvoiceItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Customers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "BusinessProfiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "AuditLogs",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Organizations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Organizations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationCounters",
                columns: table => new
                {
                    OrganizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Value = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationCounters", x => new { x.OrganizationId, x.Name });
                    table.ForeignKey(
                        name: "FK_OrganizationCounters_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            // The existing installation becomes company 0001. Skipped on a brand-new database (no rows anywhere), where
            // the first company is created by first-time setup instead.
            migrationBuilder.Sql("""
                INSERT INTO "Organizations" ("Id", "Code", "Name", "IsActive", "CreatedAt", "IsDeleted")
                SELECT '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001', '0001',
                       COALESCE((SELECT "BusinessName" FROM "BusinessProfiles" WHERE NOT "IsDeleted" ORDER BY "CreatedAt" LIMIT 1), ''),
                       TRUE, NOW(), FALSE
                WHERE EXISTS (SELECT 1 FROM "WhatsAppMessages")
                       OR EXISTS (SELECT 1 FROM "WhatsAppConfigurations")
                       OR EXISTS (SELECT 1 FROM "Vendors")
                       OR EXISTS (SELECT 1 FROM "Vehicles")
                       OR EXISTS (SELECT 1 FROM "Users")
                       OR EXISTS (SELECT 1 FROM "UserPermissions")
                       OR EXISTS (SELECT 1 FROM "SystemPreferences")
                       OR EXISTS (SELECT 1 FROM "StaffSalarySettlements")
                       OR EXISTS (SELECT 1 FROM "StaffDailyAttendanceConfirmations")
                       OR EXISTS (SELECT 1 FROM "StaffAttendances")
                       OR EXISTS (SELECT 1 FROM "StaffAdvances")
                       OR EXISTS (SELECT 1 FROM "Staff")
                       OR EXISTS (SELECT 1 FROM "ShowroomWorkTypes")
                       OR EXISTS (SELECT 1 FROM "ShowroomVehicleWorks")
                       OR EXISTS (SELECT 1 FROM "ShowroomVehicleWorkItems")
                       OR EXISTS (SELECT 1 FROM "ShowroomVehicleTypes")
                       OR EXISTS (SELECT 1 FROM "ShowroomStaffWorkSessions")
                       OR EXISTS (SELECT 1 FROM "ShowroomStaffSwaps")
                       OR EXISTS (SELECT 1 FROM "ShowroomStaffAssignments")
                       OR EXISTS (SELECT 1 FROM "Showrooms")
                       OR EXISTS (SELECT 1 FROM "ShowroomPayments")
                       OR EXISTS (SELECT 1 FROM "ShowroomDailyBills")
                       OR EXISTS (SELECT 1 FROM "ShowroomDailyAttendances")
                       OR EXISTS (SELECT 1 FROM "Services")
                       OR EXISTS (SELECT 1 FROM "Payments")
                       OR EXISTS (SELECT 1 FROM "OutsideJobs")
                       OR EXISTS (SELECT 1 FROM "JobCardServices")
                       OR EXISTS (SELECT 1 FROM "JobCards")
                       OR EXISTS (SELECT 1 FROM "Invoices")
                       OR EXISTS (SELECT 1 FROM "InvoicePublicLinks")
                       OR EXISTS (SELECT 1 FROM "InvoiceNumberAllocations")
                       OR EXISTS (SELECT 1 FROM "InvoiceItems")
                       OR EXISTS (SELECT 1 FROM "Customers")
                       OR EXISTS (SELECT 1 FROM "BusinessProfiles")
                       OR EXISTS (SELECT 1 FROM "AuditLogs");
                """);

            // A brand-new database has no company; the two numbering series an old migration seeded belong to nobody.
            // (Each company creates its own series the first time it needs a number.)
            migrationBuilder.Sql("""
                DELETE FROM "InvoiceNumberSeries" WHERE NOT EXISTS (SELECT 1 FROM "Organizations");
                """);

            migrationBuilder.Sql("""
                UPDATE "WhatsAppMessages" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "WhatsAppConfigurations" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "Vendors" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "Vehicles" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "Users" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "UserPermissions" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "SystemPreferences" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "StaffSalarySettlements" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "StaffDailyAttendanceConfirmations" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "StaffAttendances" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "StaffAdvances" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "Staff" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "ShowroomWorkTypes" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "ShowroomVehicleWorks" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "ShowroomVehicleWorkItems" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "ShowroomVehicleTypes" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "ShowroomStaffWorkSessions" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "ShowroomStaffSwaps" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "ShowroomStaffAssignments" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "Showrooms" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "ShowroomPayments" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "ShowroomDailyBills" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "ShowroomDailyAttendances" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "Services" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "Payments" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "OutsideJobs" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "JobCardServices" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "JobCards" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "Invoices" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "InvoicePublicLinks" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "InvoiceNumberSeries" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "InvoiceNumberAllocations" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "InvoiceItems" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "Customers" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "BusinessProfiles" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                UPDATE "AuditLogs" SET "OrganizationId" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001' WHERE "OrganizationId" IS NULL;
                """);

            // Job-card numbering continues exactly where the old global counter stopped.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF to_regclass('job_card_number_seq') IS NOT NULL
                       AND EXISTS (SELECT 1 FROM "Organizations" WHERE "Id" = '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001') THEN
                        INSERT INTO "OrganizationCounters" ("OrganizationId", "Name", "Value")
                        SELECT '0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001', 'JobCard', CASE WHEN is_called THEN last_value ELSE last_value - 1 END
                        FROM job_card_number_seq;
                    END IF;
                END $$;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "WhatsAppMessages",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "WhatsAppConfigurations",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "Vendors",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "Vehicles",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "Users",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "UserPermissions",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "SystemPreferences",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "StaffSalarySettlements",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "StaffDailyAttendanceConfirmations",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "StaffAttendances",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "StaffAdvances",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "Staff",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomWorkTypes",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomVehicleWorks",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomVehicleWorkItems",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomVehicleTypes",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomStaffWorkSessions",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomStaffSwaps",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomStaffAssignments",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "Showrooms",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomPayments",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomDailyBills",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "ShowroomDailyAttendances",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "Services",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "Payments",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "OutsideJobs",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "JobCardServices",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "JobCards",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "Invoices",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "InvoicePublicLinks",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "InvoiceNumberSeries",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "InvoiceNumberAllocations",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "InvoiceItems",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "Customers",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "BusinessProfiles",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "AuditLogs",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_WhatsAppMessages_OrganizationId",
                table: "WhatsAppMessages",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_WhatsAppConfigurations_OrganizationId",
                table: "WhatsAppConfigurations",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "UX_WhatsAppConfigurations_Singleton",
                table: "WhatsAppConfigurations",
                columns: new[] { "OrganizationId", "SingletonKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Vendors_OrganizationId",
                table: "Vendors",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Vehicles_OrganizationId",
                table: "Vehicles",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "UX_Vehicles_RegistrationNumber",
                table: "Vehicles",
                columns: new[] { "OrganizationId", "RegistrationNumber" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Users_OrganizationId",
                table: "Users",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_SingleOwner",
                table: "Users",
                columns: new[] { "OrganizationId", "Role" },
                unique: true,
                filter: "\"Role\" = 1 AND \"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                columns: new[] { "OrganizationId", "Username" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_UserPermissions_OrganizationId",
                table: "UserPermissions",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_SystemPreferences_OrganizationId",
                table: "SystemPreferences",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "UX_SystemPreferences_Singleton",
                table: "SystemPreferences",
                columns: new[] { "OrganizationId", "SingletonKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StaffSalarySettlements_OrganizationId",
                table: "StaffSalarySettlements",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffDailyAttendanceConfirmations_Date",
                table: "StaffDailyAttendanceConfirmations",
                columns: new[] { "OrganizationId", "Date" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_StaffDailyAttendanceConfirmations_OrganizationId",
                table: "StaffDailyAttendanceConfirmations",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffAttendances_OrganizationId",
                table: "StaffAttendances",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffAdvances_OrganizationId",
                table: "StaffAdvances",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Staff_OrganizationId",
                table: "Staff",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Staff_OrganizationId_StaffMasterId",
                table: "Staff",
                columns: new[] { "OrganizationId", "StaffMasterId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomWorkTypes_OrganizationId",
                table: "ShowroomWorkTypes",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomWorkTypes_OrganizationId_Code",
                table: "ShowroomWorkTypes",
                columns: new[] { "OrganizationId", "Code" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomVehicleWorks_OrganizationId",
                table: "ShowroomVehicleWorks",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomVehicleWorkItems_OrganizationId",
                table: "ShowroomVehicleWorkItems",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomVehicleTypes_OrganizationId",
                table: "ShowroomVehicleTypes",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomVehicleTypes_OrganizationId_Code",
                table: "ShowroomVehicleTypes",
                columns: new[] { "OrganizationId", "Code" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffWorkSessions_OrganizationId",
                table: "ShowroomStaffWorkSessions",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffSwaps_OrganizationId",
                table: "ShowroomStaffSwaps",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffSwaps_OrganizationId_SwapId",
                table: "ShowroomStaffSwaps",
                columns: new[] { "OrganizationId", "SwapId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffAssignments_OrganizationId",
                table: "ShowroomStaffAssignments",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Showrooms_OrganizationId",
                table: "Showrooms",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Showrooms_OrganizationId_MasterId",
                table: "Showrooms",
                columns: new[] { "OrganizationId", "MasterId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomPayments_OrganizationId",
                table: "ShowroomPayments",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomDailyBills_OrganizationId",
                table: "ShowroomDailyBills",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomDailyAttendances_OrganizationId",
                table: "ShowroomDailyAttendances",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Services_OrganizationId",
                table: "Services",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_OrganizationId",
                table: "Payments",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_OutsideJobs_OrganizationId",
                table: "OutsideJobs",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_JobCardServices_OrganizationId",
                table: "JobCardServices",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_JobCards_OrganizationId",
                table: "JobCards",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "UX_JobCards_JobCardNumber",
                table: "JobCards",
                columns: new[] { "OrganizationId", "JobCardNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_OrganizationId",
                table: "Invoices",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "UX_Invoices_InvoiceNumber",
                table: "Invoices",
                columns: new[] { "OrganizationId", "InvoiceNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InvoicePublicLinks_OrganizationId",
                table: "InvoicePublicLinks",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_InvoiceNumberSeries_OrganizationId",
                table: "InvoiceNumberSeries",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "UX_InvoiceNumberSeries_SeriesKind",
                table: "InvoiceNumberSeries",
                columns: new[] { "OrganizationId", "SeriesKind" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_InvoiceNumberAllocations_OrganizationId",
                table: "InvoiceNumberAllocations",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "UX_InvoiceNumberAllocations_NormalizedNumber",
                table: "InvoiceNumberAllocations",
                columns: new[] { "OrganizationId", "NormalizedNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InvoiceItems_OrganizationId",
                table: "InvoiceItems",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_OrganizationId",
                table: "Customers",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_BusinessProfiles_OrganizationId",
                table: "BusinessProfiles",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "UX_BusinessProfiles_Singleton",
                table: "BusinessProfiles",
                columns: new[] { "OrganizationId", "SingletonKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_OrganizationId",
                table: "AuditLogs",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationCounters_OrganizationId",
                table: "OrganizationCounters",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "UX_Organizations_Code",
                table: "Organizations",
                column: "Code",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditLogs_Organizations_OrganizationId",
                table: "AuditLogs",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_BusinessProfiles_Organizations_OrganizationId",
                table: "BusinessProfiles",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Customers_Organizations_OrganizationId",
                table: "Customers",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InvoiceItems_Organizations_OrganizationId",
                table: "InvoiceItems",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InvoiceNumberAllocations_Organizations_OrganizationId",
                table: "InvoiceNumberAllocations",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InvoiceNumberSeries_Organizations_OrganizationId",
                table: "InvoiceNumberSeries",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InvoicePublicLinks_Organizations_OrganizationId",
                table: "InvoicePublicLinks",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Invoices_Organizations_OrganizationId",
                table: "Invoices",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_JobCards_Organizations_OrganizationId",
                table: "JobCards",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_JobCardServices_Organizations_OrganizationId",
                table: "JobCardServices",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_OutsideJobs_Organizations_OrganizationId",
                table: "OutsideJobs",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Organizations_OrganizationId",
                table: "Payments",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Services_Organizations_OrganizationId",
                table: "Services",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ShowroomDailyAttendances_Organizations_OrganizationId",
                table: "ShowroomDailyAttendances",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ShowroomDailyBills_Organizations_OrganizationId",
                table: "ShowroomDailyBills",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ShowroomPayments_Organizations_OrganizationId",
                table: "ShowroomPayments",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Showrooms_Organizations_OrganizationId",
                table: "Showrooms",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ShowroomStaffAssignments_Organizations_OrganizationId",
                table: "ShowroomStaffAssignments",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ShowroomStaffSwaps_Organizations_OrganizationId",
                table: "ShowroomStaffSwaps",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ShowroomStaffWorkSessions_Organizations_OrganizationId",
                table: "ShowroomStaffWorkSessions",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ShowroomVehicleTypes_Organizations_OrganizationId",
                table: "ShowroomVehicleTypes",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ShowroomVehicleWorkItems_Organizations_OrganizationId",
                table: "ShowroomVehicleWorkItems",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ShowroomVehicleWorks_Organizations_OrganizationId",
                table: "ShowroomVehicleWorks",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ShowroomWorkTypes_Organizations_OrganizationId",
                table: "ShowroomWorkTypes",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Staff_Organizations_OrganizationId",
                table: "Staff",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_StaffAdvances_Organizations_OrganizationId",
                table: "StaffAdvances",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_StaffAttendances_Organizations_OrganizationId",
                table: "StaffAttendances",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_StaffDailyAttendanceConfirmations_Organizations_Organizatio~",
                table: "StaffDailyAttendanceConfirmations",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_StaffSalarySettlements_Organizations_OrganizationId",
                table: "StaffSalarySettlements",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SystemPreferences_Organizations_OrganizationId",
                table: "SystemPreferences",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UserPermissions_Organizations_OrganizationId",
                table: "UserPermissions",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Organizations_OrganizationId",
                table: "Users",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Vehicles_Organizations_OrganizationId",
                table: "Vehicles",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Vendors_Organizations_OrganizationId",
                table: "Vendors",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_WhatsAppConfigurations_Organizations_OrganizationId",
                table: "WhatsAppConfigurations",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_WhatsAppMessages_Organizations_OrganizationId",
                table: "WhatsAppMessages",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Hand-written indexes that were platform-wide become per company.
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "UX_InvoiceNumberSeries_Prefix";
                CREATE UNIQUE INDEX "UX_InvoiceNumberSeries_Prefix"
                    ON "InvoiceNumberSeries" ("OrganizationId", upper("Prefix")) WHERE "IsDeleted" = false;

                DROP INDEX IF EXISTS "UX_ShowroomVehicleTypes_Name";
                CREATE UNIQUE INDEX "UX_ShowroomVehicleTypes_Name"
                    ON "ShowroomVehicleTypes" ("OrganizationId", lower(btrim("Name"))) WHERE NOT "IsDeleted";

                DROP INDEX IF EXISTS "UX_ShowroomWorkTypes_Name";
                CREATE UNIQUE INDEX "UX_ShowroomWorkTypes_Name"
                    ON "ShowroomWorkTypes" ("OrganizationId", lower(btrim("Name"))) WHERE NOT "IsDeleted";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AuditLogs_Organizations_OrganizationId",
                table: "AuditLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_BusinessProfiles_Organizations_OrganizationId",
                table: "BusinessProfiles");

            migrationBuilder.DropForeignKey(
                name: "FK_Customers_Organizations_OrganizationId",
                table: "Customers");

            migrationBuilder.DropForeignKey(
                name: "FK_InvoiceItems_Organizations_OrganizationId",
                table: "InvoiceItems");

            migrationBuilder.DropForeignKey(
                name: "FK_InvoiceNumberAllocations_Organizations_OrganizationId",
                table: "InvoiceNumberAllocations");

            migrationBuilder.DropForeignKey(
                name: "FK_InvoiceNumberSeries_Organizations_OrganizationId",
                table: "InvoiceNumberSeries");

            migrationBuilder.DropForeignKey(
                name: "FK_InvoicePublicLinks_Organizations_OrganizationId",
                table: "InvoicePublicLinks");

            migrationBuilder.DropForeignKey(
                name: "FK_Invoices_Organizations_OrganizationId",
                table: "Invoices");

            migrationBuilder.DropForeignKey(
                name: "FK_JobCards_Organizations_OrganizationId",
                table: "JobCards");

            migrationBuilder.DropForeignKey(
                name: "FK_JobCardServices_Organizations_OrganizationId",
                table: "JobCardServices");

            migrationBuilder.DropForeignKey(
                name: "FK_OutsideJobs_Organizations_OrganizationId",
                table: "OutsideJobs");

            migrationBuilder.DropForeignKey(
                name: "FK_Payments_Organizations_OrganizationId",
                table: "Payments");

            migrationBuilder.DropForeignKey(
                name: "FK_Services_Organizations_OrganizationId",
                table: "Services");

            migrationBuilder.DropForeignKey(
                name: "FK_ShowroomDailyAttendances_Organizations_OrganizationId",
                table: "ShowroomDailyAttendances");

            migrationBuilder.DropForeignKey(
                name: "FK_ShowroomDailyBills_Organizations_OrganizationId",
                table: "ShowroomDailyBills");

            migrationBuilder.DropForeignKey(
                name: "FK_ShowroomPayments_Organizations_OrganizationId",
                table: "ShowroomPayments");

            migrationBuilder.DropForeignKey(
                name: "FK_Showrooms_Organizations_OrganizationId",
                table: "Showrooms");

            migrationBuilder.DropForeignKey(
                name: "FK_ShowroomStaffAssignments_Organizations_OrganizationId",
                table: "ShowroomStaffAssignments");

            migrationBuilder.DropForeignKey(
                name: "FK_ShowroomStaffSwaps_Organizations_OrganizationId",
                table: "ShowroomStaffSwaps");

            migrationBuilder.DropForeignKey(
                name: "FK_ShowroomStaffWorkSessions_Organizations_OrganizationId",
                table: "ShowroomStaffWorkSessions");

            migrationBuilder.DropForeignKey(
                name: "FK_ShowroomVehicleTypes_Organizations_OrganizationId",
                table: "ShowroomVehicleTypes");

            migrationBuilder.DropForeignKey(
                name: "FK_ShowroomVehicleWorkItems_Organizations_OrganizationId",
                table: "ShowroomVehicleWorkItems");

            migrationBuilder.DropForeignKey(
                name: "FK_ShowroomVehicleWorks_Organizations_OrganizationId",
                table: "ShowroomVehicleWorks");

            migrationBuilder.DropForeignKey(
                name: "FK_ShowroomWorkTypes_Organizations_OrganizationId",
                table: "ShowroomWorkTypes");

            migrationBuilder.DropForeignKey(
                name: "FK_Staff_Organizations_OrganizationId",
                table: "Staff");

            migrationBuilder.DropForeignKey(
                name: "FK_StaffAdvances_Organizations_OrganizationId",
                table: "StaffAdvances");

            migrationBuilder.DropForeignKey(
                name: "FK_StaffAttendances_Organizations_OrganizationId",
                table: "StaffAttendances");

            migrationBuilder.DropForeignKey(
                name: "FK_StaffDailyAttendanceConfirmations_Organizations_Organizatio~",
                table: "StaffDailyAttendanceConfirmations");

            migrationBuilder.DropForeignKey(
                name: "FK_StaffSalarySettlements_Organizations_OrganizationId",
                table: "StaffSalarySettlements");

            migrationBuilder.DropForeignKey(
                name: "FK_SystemPreferences_Organizations_OrganizationId",
                table: "SystemPreferences");

            migrationBuilder.DropForeignKey(
                name: "FK_UserPermissions_Organizations_OrganizationId",
                table: "UserPermissions");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Organizations_OrganizationId",
                table: "Users");

            migrationBuilder.DropForeignKey(
                name: "FK_Vehicles_Organizations_OrganizationId",
                table: "Vehicles");

            migrationBuilder.DropForeignKey(
                name: "FK_Vendors_Organizations_OrganizationId",
                table: "Vendors");

            migrationBuilder.DropForeignKey(
                name: "FK_WhatsAppConfigurations_Organizations_OrganizationId",
                table: "WhatsAppConfigurations");

            migrationBuilder.DropForeignKey(
                name: "FK_WhatsAppMessages_Organizations_OrganizationId",
                table: "WhatsAppMessages");

            migrationBuilder.DropTable(
                name: "OrganizationCounters");

            migrationBuilder.DropTable(
                name: "Organizations");

            migrationBuilder.DropIndex(
                name: "IX_WhatsAppMessages_OrganizationId",
                table: "WhatsAppMessages");

            migrationBuilder.DropIndex(
                name: "IX_WhatsAppConfigurations_OrganizationId",
                table: "WhatsAppConfigurations");

            migrationBuilder.DropIndex(
                name: "UX_WhatsAppConfigurations_Singleton",
                table: "WhatsAppConfigurations");

            migrationBuilder.DropIndex(
                name: "IX_Vendors_OrganizationId",
                table: "Vendors");

            migrationBuilder.DropIndex(
                name: "IX_Vehicles_OrganizationId",
                table: "Vehicles");

            migrationBuilder.DropIndex(
                name: "UX_Vehicles_RegistrationNumber",
                table: "Vehicles");

            migrationBuilder.DropIndex(
                name: "IX_Users_OrganizationId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_SingleOwner",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_Username",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_UserPermissions_OrganizationId",
                table: "UserPermissions");

            migrationBuilder.DropIndex(
                name: "IX_SystemPreferences_OrganizationId",
                table: "SystemPreferences");

            migrationBuilder.DropIndex(
                name: "UX_SystemPreferences_Singleton",
                table: "SystemPreferences");

            migrationBuilder.DropIndex(
                name: "IX_StaffSalarySettlements_OrganizationId",
                table: "StaffSalarySettlements");

            migrationBuilder.DropIndex(
                name: "IX_StaffDailyAttendanceConfirmations_Date",
                table: "StaffDailyAttendanceConfirmations");

            migrationBuilder.DropIndex(
                name: "IX_StaffDailyAttendanceConfirmations_OrganizationId",
                table: "StaffDailyAttendanceConfirmations");

            migrationBuilder.DropIndex(
                name: "IX_StaffAttendances_OrganizationId",
                table: "StaffAttendances");

            migrationBuilder.DropIndex(
                name: "IX_StaffAdvances_OrganizationId",
                table: "StaffAdvances");

            migrationBuilder.DropIndex(
                name: "IX_Staff_OrganizationId",
                table: "Staff");

            migrationBuilder.DropIndex(
                name: "IX_Staff_OrganizationId_StaffMasterId",
                table: "Staff");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomWorkTypes_OrganizationId",
                table: "ShowroomWorkTypes");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomWorkTypes_OrganizationId_Code",
                table: "ShowroomWorkTypes");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomVehicleWorks_OrganizationId",
                table: "ShowroomVehicleWorks");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomVehicleWorkItems_OrganizationId",
                table: "ShowroomVehicleWorkItems");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomVehicleTypes_OrganizationId",
                table: "ShowroomVehicleTypes");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomVehicleTypes_OrganizationId_Code",
                table: "ShowroomVehicleTypes");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomStaffWorkSessions_OrganizationId",
                table: "ShowroomStaffWorkSessions");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomStaffSwaps_OrganizationId",
                table: "ShowroomStaffSwaps");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomStaffSwaps_OrganizationId_SwapId",
                table: "ShowroomStaffSwaps");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomStaffAssignments_OrganizationId",
                table: "ShowroomStaffAssignments");

            migrationBuilder.DropIndex(
                name: "IX_Showrooms_OrganizationId",
                table: "Showrooms");

            migrationBuilder.DropIndex(
                name: "IX_Showrooms_OrganizationId_MasterId",
                table: "Showrooms");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomPayments_OrganizationId",
                table: "ShowroomPayments");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomDailyBills_OrganizationId",
                table: "ShowroomDailyBills");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomDailyAttendances_OrganizationId",
                table: "ShowroomDailyAttendances");

            migrationBuilder.DropIndex(
                name: "IX_Services_OrganizationId",
                table: "Services");

            migrationBuilder.DropIndex(
                name: "IX_Payments_OrganizationId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_OutsideJobs_OrganizationId",
                table: "OutsideJobs");

            migrationBuilder.DropIndex(
                name: "IX_JobCardServices_OrganizationId",
                table: "JobCardServices");

            migrationBuilder.DropIndex(
                name: "IX_JobCards_OrganizationId",
                table: "JobCards");

            migrationBuilder.DropIndex(
                name: "UX_JobCards_JobCardNumber",
                table: "JobCards");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_OrganizationId",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "UX_Invoices_InvoiceNumber",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_InvoicePublicLinks_OrganizationId",
                table: "InvoicePublicLinks");

            migrationBuilder.DropIndex(
                name: "IX_InvoiceNumberSeries_OrganizationId",
                table: "InvoiceNumberSeries");

            migrationBuilder.DropIndex(
                name: "UX_InvoiceNumberSeries_SeriesKind",
                table: "InvoiceNumberSeries");

            migrationBuilder.DropIndex(
                name: "IX_InvoiceNumberAllocations_OrganizationId",
                table: "InvoiceNumberAllocations");

            migrationBuilder.DropIndex(
                name: "UX_InvoiceNumberAllocations_NormalizedNumber",
                table: "InvoiceNumberAllocations");

            migrationBuilder.DropIndex(
                name: "IX_InvoiceItems_OrganizationId",
                table: "InvoiceItems");

            migrationBuilder.DropIndex(
                name: "IX_Customers_OrganizationId",
                table: "Customers");

            migrationBuilder.DropIndex(
                name: "IX_BusinessProfiles_OrganizationId",
                table: "BusinessProfiles");

            migrationBuilder.DropIndex(
                name: "UX_BusinessProfiles_Singleton",
                table: "BusinessProfiles");

            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_OrganizationId",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "WhatsAppMessages");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "WhatsAppConfigurations");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "UserPermissions");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "SystemPreferences");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "StaffSalarySettlements");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "StaffDailyAttendanceConfirmations");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "StaffAttendances");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "StaffAdvances");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Staff");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "ShowroomWorkTypes");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "ShowroomVehicleWorks");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "ShowroomVehicleWorkItems");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "ShowroomVehicleTypes");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "ShowroomStaffWorkSessions");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "ShowroomStaffSwaps");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "ShowroomStaffAssignments");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Showrooms");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "ShowroomPayments");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "ShowroomDailyBills");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "ShowroomDailyAttendances");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Services");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "OutsideJobs");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "JobCardServices");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "JobCards");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "InvoicePublicLinks");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "InvoiceNumberSeries");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "InvoiceNumberAllocations");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "InvoiceItems");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "BusinessProfiles");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "AuditLogs");

            migrationBuilder.CreateIndex(
                name: "UX_WhatsAppConfigurations_Singleton",
                table: "WhatsAppConfigurations",
                column: "SingletonKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_Vehicles_RegistrationNumber",
                table: "Vehicles",
                column: "RegistrationNumber",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Users_SingleOwner",
                table: "Users",
                column: "Role",
                unique: true,
                filter: "\"Role\" = 1 AND \"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "UX_SystemPreferences_Singleton",
                table: "SystemPreferences",
                column: "SingletonKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StaffDailyAttendanceConfirmations_Date",
                table: "StaffDailyAttendanceConfirmations",
                column: "Date",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Staff_StaffMasterId",
                table: "Staff",
                column: "StaffMasterId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomWorkTypes_Code",
                table: "ShowroomWorkTypes",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomVehicleTypes_Code",
                table: "ShowroomVehicleTypes",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffSwaps_SwapId",
                table: "ShowroomStaffSwaps",
                column: "SwapId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Showrooms_MasterId",
                table: "Showrooms",
                column: "MasterId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_JobCards_JobCardNumber",
                table: "JobCards",
                column: "JobCardNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_Invoices_InvoiceNumber",
                table: "Invoices",
                column: "InvoiceNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_InvoiceNumberSeries_SeriesKind",
                table: "InvoiceNumberSeries",
                column: "SeriesKind",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "UX_InvoiceNumberAllocations_NormalizedNumber",
                table: "InvoiceNumberAllocations",
                column: "NormalizedNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_BusinessProfiles_Singleton",
                table: "BusinessProfiles",
                column: "SingletonKey",
                unique: true);

            // Restore the platform-wide hand-written indexes (they were dropped with the OrganizationId column).
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "UX_InvoiceNumberSeries_Prefix";
                CREATE UNIQUE INDEX "UX_InvoiceNumberSeries_Prefix"
                    ON "InvoiceNumberSeries" (upper("Prefix")) WHERE "IsDeleted" = false;
                CREATE UNIQUE INDEX IF NOT EXISTS "UX_ShowroomVehicleTypes_Name"
                    ON "ShowroomVehicleTypes" (lower(btrim("Name"))) WHERE NOT "IsDeleted";
                CREATE UNIQUE INDEX IF NOT EXISTS "UX_ShowroomWorkTypes_Name"
                    ON "ShowroomWorkTypes" (lower(btrim("Name"))) WHERE NOT "IsDeleted";
                """);
        }
    }
}
