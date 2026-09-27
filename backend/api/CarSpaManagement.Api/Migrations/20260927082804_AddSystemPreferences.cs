using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSystemPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SystemPreferences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SingletonKey = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    DateFormat = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "DD/MM/YYYY"),
                    TimeFormat = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false, defaultValue: "12h"),
                    CurrencySymbol = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false, defaultValue: "₹"),
                    DecimalPrecision = table.Column<int>(type: "integer", nullable: false, defaultValue: 2),
                    DefaultPrintCopies = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    AutoPrintReceipt = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    RefreshInterval = table.Column<int>(type: "integer", nullable: false, defaultValue: 30),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemPreferences", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "UX_SystemPreferences_Singleton",
                table: "SystemPreferences",
                column: "SingletonKey",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SystemPreferences");
        }
    }
}
