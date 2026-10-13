using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations.Platform
{
    /// <inheritdoc />
    public partial class UserLicencesAndSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AndroidLicences",
                table: "Subscriptions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "BothLicences",
                table: "Subscriptions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "WindowsLicences",
                table: "Subscriptions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "AndroidUserPriceMinor",
                table: "PlanVersions",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "BothUserPriceMinor",
                table: "PlanVersions",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "WindowsUserPriceMinor",
                table: "PlanVersions",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateTable(
                name: "PlatformSettings",
                columns: table => new
                {
                    Key = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Value = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformSettings", x => x.Key);
                });

            // Existing subscriptions keep the users they could have: one licence for both apps per user allowed before
            // (the plan's users plus 5 per "5 more users" pack). That pack is replaced by single user licences.
            migrationBuilder.Sql("""
                UPDATE "Subscriptions" s
                SET "BothLicences" = GREATEST(1, v."IncludedSeats" + 5 * COALESCE((
                    SELECT SUM(i."Quantity") FROM "SubscriptionItems" i
                    JOIN "AddOnPrices" p ON p."Id" = i."AddOnPriceId"
                    JOIN "AddOns" a ON a."Id" = p."AddOnId"
                    WHERE i."SubscriptionId" = s."Id" AND a."Code" = 'seats_5' AND i."EffectiveTo" IS NULL), 0))
                FROM "PlanVersions" v
                WHERE v."Id" = s."PlanVersionId";

                UPDATE "SubscriptionItems" i SET "EffectiveTo" = now()
                FROM "AddOnPrices" p, "AddOns" a
                WHERE p."Id" = i."AddOnPriceId" AND a."Id" = p."AddOnId" AND a."Code" = 'seats_5' AND i."EffectiveTo" IS NULL;

                UPDATE "AddOns" SET "IsActive" = false WHERE "Code" = 'seats_5';
                """);

            // The seeded plans become per-licence prices (placeholders until Trovo sets real ones; nobody is billed yet).
            // Yearly = 10 x monthly. Plans Trovo created itself are left alone.
            migrationBuilder.Sql("""
                UPDATE "PlanVersions" v
                SET "PriceMinor" = 0,
                    "IncludedSeats" = 1,
                    "AndroidUserPriceMinor" = (CASE p."Code" WHEN 'starter' THEN 49900 ELSE 79900 END) * (CASE v."Interval" WHEN 'Year' THEN 10 ELSE 1 END),
                    "WindowsUserPriceMinor" = (CASE p."Code" WHEN 'starter' THEN 69900 ELSE 119900 END) * (CASE v."Interval" WHEN 'Year' THEN 10 ELSE 1 END),
                    "BothUserPriceMinor" = (CASE p."Code" WHEN 'starter' THEN 99900 ELSE 149900 END) * (CASE v."Interval" WHEN 'Year' THEN 10 ELSE 1 END)
                FROM "Plans" p
                WHERE p."Id" = v."PlanId" AND p."Code" IN ('starter', 'professional')
                  AND v."AndroidUserPriceMinor" = 0 AND v."WindowsUserPriceMinor" = 0 AND v."BothUserPriceMinor" = 0;

                UPDATE "PlanEntitlements" e SET "Value" = '1'
                FROM "PlanVersions" v JOIN "Plans" p ON p."Id" = v."PlanId"
                WHERE e."PlanVersionId" = v."Id" AND e."FeatureKey" = 'users.max_active' AND p."Code" IN ('starter', 'professional');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The data changes (licences, prices, the retired 5-user pack) are not reversed; only the columns go.
            migrationBuilder.DropTable(
                name: "PlatformSettings");

            migrationBuilder.DropColumn(
                name: "AndroidLicences",
                table: "Subscriptions");

            migrationBuilder.DropColumn(
                name: "BothLicences",
                table: "Subscriptions");

            migrationBuilder.DropColumn(
                name: "WindowsLicences",
                table: "Subscriptions");

            migrationBuilder.DropColumn(
                name: "AndroidUserPriceMinor",
                table: "PlanVersions");

            migrationBuilder.DropColumn(
                name: "BothUserPriceMinor",
                table: "PlanVersions");

            migrationBuilder.DropColumn(
                name: "WindowsUserPriceMinor",
                table: "PlanVersions");
        }
    }
}
