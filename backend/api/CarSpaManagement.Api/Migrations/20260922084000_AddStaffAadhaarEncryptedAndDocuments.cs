using System;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260922084000_AddStaffAadhaarEncryptedAndDocuments")]
    public partial class AddStaffAadhaarEncryptedAndDocuments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AadhaarNumberEncrypted",
                table: "Staff",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AadhaarDocumentPath",
                table: "Staff",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AadhaarDocumentFileName",
                table: "Staff",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AadhaarDocumentContentType",
                table: "Staff",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "AadhaarDocumentSize",
                table: "Staff",
                type: "bigint",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AadhaarNumberEncrypted",
                table: "Staff");

            migrationBuilder.DropColumn(
                name: "AadhaarDocumentPath",
                table: "Staff");

            migrationBuilder.DropColumn(
                name: "AadhaarDocumentFileName",
                table: "Staff");

            migrationBuilder.DropColumn(
                name: "AadhaarDocumentContentType",
                table: "Staff");

            migrationBuilder.DropColumn(
                name: "AadhaarDocumentSize",
                table: "Staff");
        }
    }
}
