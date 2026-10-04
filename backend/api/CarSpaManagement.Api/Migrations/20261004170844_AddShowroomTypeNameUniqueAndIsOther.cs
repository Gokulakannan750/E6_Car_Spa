using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddShowroomTypeNameUniqueAndIsOther : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsOther",
                table: "ShowroomWorkTypes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // The seeded "Other" work type is identified by its code; from now on the flag identifies it,
            // so renaming it (or changing its code) no longer breaks the "description required" rule.
            migrationBuilder.Sql("""
                UPDATE "ShowroomWorkTypes" SET "IsOther" = true WHERE upper("Code") = 'OTHER';
                """);

            // Existing installations may already hold case-insensitive duplicate names. Keep the oldest row's
            // name and suffix later ones so the unique index can be created. Ids are unchanged, so historical
            // vehicle-work records keep pointing at the same rows.
            foreach (var table in new[] { "ShowroomVehicleTypes", "ShowroomWorkTypes" })
            {
                migrationBuilder.Sql($"""
                    WITH ranked AS (
                        SELECT "Id", row_number() OVER (PARTITION BY lower(btrim("Name")) ORDER BY "CreatedAt", "Id") AS rn
                        FROM "{table}"
                        WHERE NOT "IsDeleted"
                    )
                    UPDATE "{table}" AS t
                    SET "Name" = left(btrim(t."Name"), 80) || ' (duplicate ' || ranked.rn || ')'
                    FROM ranked
                    WHERE t."Id" = ranked."Id" AND ranked.rn > 1;
                    """);
            }

            migrationBuilder.Sql("""
                CREATE UNIQUE INDEX "UX_ShowroomVehicleTypes_Name"
                    ON "ShowroomVehicleTypes" (lower(btrim("Name"))) WHERE NOT "IsDeleted";
                CREATE UNIQUE INDEX "UX_ShowroomWorkTypes_Name"
                    ON "ShowroomWorkTypes" (lower(btrim("Name"))) WHERE NOT "IsDeleted";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Names suffixed by Up are left as they are.
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "UX_ShowroomWorkTypes_Name";
                DROP INDEX IF EXISTS "UX_ShowroomVehicleTypes_Name";
                """);

            migrationBuilder.DropColumn(
                name: "IsOther",
                table: "ShowroomWorkTypes");
        }
    }
}
