using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    [DbContext(typeof(CarSpaManagement.Api.Infrastructure.Database.AppDbContext))]
    [Migration("20260923214500_AddShowroomMasterId")]
    public partial class AddShowroomMasterId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Add column as nullable first for safe backfill
            migrationBuilder.AddColumn<string>(
                name: "MasterId",
                table: "Showrooms",
                type: "character varying(7)",
                maxLength: 7,
                nullable: true);

            // 2. Safe deterministic backfill of existing showrooms
            // Derives 2-letter uppercase prefix from Name and assigns unique 10001, 10002...
            migrationBuilder.Sql(@"
DO $$
DECLARE
    rec RECORD;
    raw_prefix text;
    clean_prefix text;
    seq_num int;
    new_id text;
BEGIN
    FOR rec IN SELECT ""Id"", ""Name"" FROM ""Showrooms"" WHERE ""MasterId"" IS NULL OR ""MasterId"" = '' ORDER BY ""CreatedAt"", ""Id"" LOOP
        raw_prefix := UPPER(REGEXP_REPLACE(rec.""Name"", '[^a-zA-Z]', '', 'g'));
        IF LENGTH(raw_prefix) >= 2 THEN
            clean_prefix := SUBSTRING(raw_prefix FROM 1 FOR 2);
        ELSIF LENGTH(raw_prefix) = 1 THEN
            clean_prefix := raw_prefix || 'X';
        ELSE
            clean_prefix := 'SR';
        END IF;
        
        seq_num := 10000;
        LOOP
            seq_num := seq_num + 1;
            new_id := clean_prefix || LPAD(seq_num::text, 5, '0');
            EXIT WHEN NOT EXISTS (SELECT 1 FROM ""Showrooms"" WHERE ""MasterId"" = new_id);
        END LOOP;
        
        UPDATE ""Showrooms"" SET ""MasterId"" = new_id WHERE ""Id"" = rec.""Id"";
    END LOOP;
END $$;
");

            // 3. Alter column to NOT NULL
            migrationBuilder.AlterColumn<string>(
                name: "MasterId",
                table: "Showrooms",
                type: "character varying(7)",
                maxLength: 7,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(7)",
                oldMaxLength: 7,
                oldNullable: true);

            // 4. Create unique index
            migrationBuilder.CreateIndex(
                name: "IX_Showrooms_MasterId",
                table: "Showrooms",
                column: "MasterId",
                unique: true);

            // 5. Add PostgreSQL CHECK constraint enforcing regex format
            migrationBuilder.Sql(@"ALTER TABLE ""Showrooms"" ADD CONSTRAINT ""CK_Showrooms_MasterId_Format"" CHECK (""MasterId"" ~ '^[A-Z]{2}[0-9]{5}$');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"ALTER TABLE ""Showrooms"" DROP CONSTRAINT IF EXISTS ""CK_Showrooms_MasterId_Format"";");

            migrationBuilder.DropIndex(
                name: "IX_Showrooms_MasterId",
                table: "Showrooms");

            migrationBuilder.DropColumn(
                name: "MasterId",
                table: "Showrooms");
        }
    }
}
