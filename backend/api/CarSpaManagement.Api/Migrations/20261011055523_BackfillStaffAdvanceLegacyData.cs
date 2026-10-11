using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class BackfillStaffAdvanceLegacyData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // This repairs every company's rows. Row-level security hides rows from any connection that is not working
            // for a company, so a migration that must touch all of them says so for this transaction only (the same
            // switch the franchise functions use). On a database without row-level security it does nothing.
            migrationBuilder.Sql("SELECT set_config('app.bypass_rls', 'on', true);");

            migrationBuilder.Sql("""
                UPDATE "StaffAdvances"
                SET "Status" = 'Outstanding'
                WHERE "Status" IS NULL OR "Status" = 'Pending';

                UPDATE "StaffAdvances"
                SET "Reason" = COALESCE(
                    NULLIF(BTRIM("Description"), ''),
                    NULLIF(BTRIM("AdvanceType"), ''),
                    'Staff Advance')
                WHERE "Reason" IS NULL OR BTRIM("Reason") = '';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
