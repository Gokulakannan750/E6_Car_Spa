using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    [DbContext(typeof(CarSpaManagement.Api.Infrastructure.Database.AppDbContext))]
    [Migration("20260924070000_AddStaffMasterId")]
    public partial class AddStaffMasterId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Add column as nullable first for safe backfill
            migrationBuilder.AddColumn<string>(
                name: "StaffMasterId",
                table: "Staff",
                type: "character varying(6)",
                maxLength: 6,
                nullable: true);

            // 2. Safe deterministic backfill of existing staff records
            // Format: [A-Z]{2}[0-9]{3}[A-Z]
            // Characters 1-2: First two alpha chars of name, uppercase
            // Characters 3-5: Three-digit unique sequence (001-999)
            // Character 6: Last alpha char of name, uppercase
            migrationBuilder.Sql(@"
DO $$
DECLARE
    rec RECORD;
    alpha_chars text;
    prefix2 text;
    suffix1 text;
    seq_num int;
    new_id text;
BEGIN
    FOR rec IN SELECT ""Id"", ""Name"" FROM ""Staff"" WHERE ""StaffMasterId"" IS NULL OR ""StaffMasterId"" = '' ORDER BY ""CreatedAt"", ""Id"" LOOP
        -- Extract only alphabetic characters from the name
        alpha_chars := UPPER(REGEXP_REPLACE(rec.""Name"", '[^a-zA-Z]', '', 'g'));

        -- Derive prefix (first 2 alpha chars)
        IF LENGTH(alpha_chars) >= 2 THEN
            prefix2 := SUBSTRING(alpha_chars FROM 1 FOR 2);
        ELSIF LENGTH(alpha_chars) = 1 THEN
            prefix2 := alpha_chars || 'X';
        ELSE
            prefix2 := 'XX';
        END IF;

        -- Derive suffix (last alpha char)
        IF LENGTH(alpha_chars) >= 1 THEN
            suffix1 := SUBSTRING(alpha_chars FROM LENGTH(alpha_chars) FOR 1);
        ELSE
            suffix1 := 'X';
        END IF;

        -- Find next available 3-digit sequence for this prefix+suffix combo
        seq_num := 0;
        LOOP
            seq_num := seq_num + 1;
            IF seq_num > 999 THEN
                RAISE EXCEPTION 'All 999 Staff Master IDs for pattern %___% are exhausted', prefix2, suffix1;
            END IF;
            new_id := prefix2 || LPAD(seq_num::text, 3, '0') || suffix1;
            EXIT WHEN NOT EXISTS (SELECT 1 FROM ""Staff"" WHERE ""StaffMasterId"" = new_id);
        END LOOP;

        UPDATE ""Staff"" SET ""StaffMasterId"" = new_id WHERE ""Id"" = rec.""Id"";
    END LOOP;
END $$;
");

            // 3. Alter column to NOT NULL
            migrationBuilder.AlterColumn<string>(
                name: "StaffMasterId",
                table: "Staff",
                type: "character varying(6)",
                maxLength: 6,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(6)",
                oldMaxLength: 6,
                oldNullable: true);

            // 4. Create unique index
            migrationBuilder.CreateIndex(
                name: "IX_Staff_StaffMasterId",
                table: "Staff",
                column: "StaffMasterId",
                unique: true);

            // 5. Add PostgreSQL CHECK constraint enforcing regex format
            migrationBuilder.Sql(@"ALTER TABLE ""Staff"" ADD CONSTRAINT ""CK_Staff_StaffMasterId_Format"" CHECK (""StaffMasterId"" ~ '^[A-Z]{2}[0-9]{3}[A-Z]$');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"ALTER TABLE ""Staff"" DROP CONSTRAINT IF EXISTS ""CK_Staff_StaffMasterId_Format"";");

            migrationBuilder.DropIndex(
                name: "IX_Staff_StaffMasterId",
                table: "Staff");

            migrationBuilder.DropColumn(
                name: "StaffMasterId",
                table: "Staff");
        }
    }
}
