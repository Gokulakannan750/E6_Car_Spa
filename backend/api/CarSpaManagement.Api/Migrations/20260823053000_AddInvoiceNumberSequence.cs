using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
 public partial class AddInvoiceNumberSequence : Migration
 {
 protected override void Up(MigrationBuilder migrationBuilder)
 {
 migrationBuilder.Sql(@"
 DO $$
 BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'invoice_number_seq') THEN
 CREATE SEQUENCE invoice_number_seq START 1 INCREMENT 1 MINVALUE 1 OWNED BY NONE;
 END IF;
 END
 $$;
 ");
 }

 protected override void Down(MigrationBuilder migrationBuilder)
 {
 migrationBuilder.Sql("DROP SEQUENCE IF EXISTS invoice_number_seq;");
 }
 }
}
