using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceJobCardUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Invoices_JobCardId_Status",
                table: "Invoices");

            migrationBuilder.CreateIndex(
                name: "UX_Invoices_JobCardId",
                table: "Invoices",
                column: "JobCardId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_Invoices_JobCardId",
                table: "Invoices");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_JobCardId_Status",
                table: "Invoices",
                columns: new[] { "JobCardId", "Status" });
        }
    }
}
