using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
 /// <inheritdoc />
 public partial class AlterInvoiceColumns : Migration
 {
 /// <inheritdoc />
 protected override void Up(MigrationBuilder migrationBuilder)
 {
 migrationBuilder.DropColumn(
 name: "GstEnabled",
 table: "Invoices");

 migrationBuilder.RenameColumn(
 name: "GrandTotal",
 table: "Invoices",
 newName: "TotalAmount");

 migrationBuilder.RenameColumn(
 name: "AmountPaid",
 table: "Invoices",
 newName: "PaidAmount");

 migrationBuilder.AddColumn<decimal>(
 name: "TaxableAmount",
 table: "Invoices",
 type: "numeric(18,2)",
 precision: 18,
 scale: 2,
 nullable: false,
 defaultValue: 0m);

 migrationBuilder.AddColumn<bool>(
 name: "GstEnabled",
 table: "Invoices",
 type: "boolean",
 nullable: false,
 defaultValue: true);

 migrationBuilder.RenameColumn(
 name: "Total",
 table: "InvoiceItems",
 newName: "TotalAmount");

 migrationBuilder.RenameColumn(
 name: "ServiceName",
 table: "InvoiceItems",
 newName: "Description");

 migrationBuilder.AddColumn<decimal>(
 name: "TaxableAmount",
 table: "InvoiceItems",
 type: "numeric(18,2)",
 precision: 18,
 scale: 2,
 nullable: false,
 defaultValue: 0m);

 migrationBuilder.AddColumn<decimal>(
 name: "TaxAmount",
 table: "InvoiceItems",
 type: "numeric(18,2)",
 precision: 18,
 scale: 2,
 nullable: false,
 defaultValue: 0m);
 }

 /// <inheritdoc />
 protected override void Down(MigrationBuilder migrationBuilder)
 {
 migrationBuilder.DropColumn(
 name: "TaxableAmount",
 table: "Invoices");

 migrationBuilder.DropColumn(
 name: "TaxableAmount",
 table: "InvoiceItems");

 migrationBuilder.DropColumn(
 name: "TaxAmount",
 table: "InvoiceItems");

 migrationBuilder.RenameColumn(
 name: "PaidAmount",
 table: "Invoices",
 newName: "AmountPaid");

 migrationBuilder.RenameColumn(
 name: "TotalAmount",
 table: "Invoices",
 newName: "GrandTotal");

 migrationBuilder.RenameColumn(
 name: "TotalAmount",
 table: "InvoiceItems",
 newName: "Total");

 migrationBuilder.RenameColumn(
 name: "Description",
 table: "InvoiceItems",
 newName: "ServiceName");

 migrationBuilder.AddColumn<bool>(
 name: "GstEnabled",
 table: "Invoices",
 type: "boolean",
 nullable: false,
 defaultValue: true);
 }
 }
}
