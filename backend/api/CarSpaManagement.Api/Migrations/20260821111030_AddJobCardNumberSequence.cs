using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
 public partial class AddJobCardNumberSequence : Migration
 {
 protected override void Up(MigrationBuilder migrationBuilder)
 {
 migrationBuilder.Sql(@"
 CREATE SEQUENCE IF NOT EXISTS job_card_number_seq
 START 11
 INCREMENT 1
 MINVALUE 1
 OWNED BY NONE;
 ");
 }

 protected override void Down(MigrationBuilder migrationBuilder)
 {
 migrationBuilder.Sql("DROP SEQUENCE IF EXISTS job_card_number_seq;");
 }
 }
}
