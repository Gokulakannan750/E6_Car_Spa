using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    [DbContext(typeof(CarSpaManagement.Api.Infrastructure.Database.AppDbContext))]
    [Migration("20260929135000_AddOutsideJobIdToInvoiceItems")]
    public partial class AddOutsideJobIdToInvoiceItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "OutsideJobId",
                table: "InvoiceItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_InvoiceItems_OutsideJobId",
                table: "InvoiceItems",
                column: "OutsideJobId");

            migrationBuilder.AddForeignKey(
                name: "FK_InvoiceItems_OutsideJobs_OutsideJobId",
                table: "InvoiceItems",
                column: "OutsideJobId",
                principalTable: "OutsideJobs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InvoiceItems_OutsideJobs_OutsideJobId",
                table: "InvoiceItems");

            migrationBuilder.DropIndex(
                name: "IX_InvoiceItems_OutsideJobId",
                table: "InvoiceItems");

            migrationBuilder.DropColumn(
                name: "OutsideJobId",
                table: "InvoiceItems");
        }
    }
}
