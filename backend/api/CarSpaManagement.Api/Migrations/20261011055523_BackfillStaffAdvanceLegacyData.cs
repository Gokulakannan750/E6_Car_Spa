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
