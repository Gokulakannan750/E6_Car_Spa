using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations.Platform
{
    /// <inheritdoc />
    public partial class GenericProductCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AndroidLicences",
                table: "Subscriptions");

            migrationBuilder.DropColumn(
                name: "BothLicences",
                table: "Subscriptions");

            migrationBuilder.DropColumn(
                name: "WindowsLicences",
                table: "Subscriptions");

            migrationBuilder.DropColumn(
                name: "AndroidLicences",
                table: "SignupOrders");

            migrationBuilder.DropColumn(
                name: "BothLicences",
                table: "SignupOrders");

            migrationBuilder.DropColumn(
                name: "WindowsLicences",
                table: "SignupOrders");

            migrationBuilder.DropColumn(
                name: "AndroidUserPriceMinor",
                table: "PlanVersions");

            migrationBuilder.DropColumn(
                name: "BothUserPriceMinor",
                table: "PlanVersions");

            migrationBuilder.DropColumn(
                name: "WindowsUserPriceMinor",
                table: "PlanVersions");

            migrationBuilder.AddColumn<string>(
                name: "Capabilities",
                table: "Products",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DatabasePrefix",
                table: "Products",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SeatModel",
                table: "Products",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TrialPlanCode",
                table: "Products",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "ProductFeatures",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    ValueType = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Label = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductFeatures", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductFeatures_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProductSeatTypes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductSeatTypes", x => x.Id);
                    table.CheckConstraint("CK_ProductSeatTypes_Code", "\"Code\" = lower(\"Code\")");
                    table.ForeignKey(
                        name: "FK_ProductSeatTypes_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PlanVersionSeatPrices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SeatTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PriceMinor = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlanVersionSeatPrices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlanVersionSeatPrices_PlanVersions_PlanVersionId",
                        column: x => x.PlanVersionId,
                        principalTable: "PlanVersions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PlanVersionSeatPrices_ProductSeatTypes_SeatTypeId",
                        column: x => x.SeatTypeId,
                        principalTable: "ProductSeatTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SignupOrderSeats",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SignupOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    SeatTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SignupOrderSeats", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SignupOrderSeats_ProductSeatTypes_SeatTypeId",
                        column: x => x.SeatTypeId,
                        principalTable: "ProductSeatTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SignupOrderSeats_SignupOrders_SignupOrderId",
                        column: x => x.SignupOrderId,
                        principalTable: "SignupOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SubscriptionSeats",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubscriptionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SeatTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubscriptionSeats", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SubscriptionSeats_ProductSeatTypes_SeatTypeId",
                        column: x => x.SeatTypeId,
                        principalTable: "ProductSeatTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SubscriptionSeats_Subscriptions_SubscriptionId",
                        column: x => x.SubscriptionId,
                        principalTable: "Subscriptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlanVersionSeatPrices_PlanVersionId_SeatTypeId",
                table: "PlanVersionSeatPrices",
                columns: new[] { "PlanVersionId", "SeatTypeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlanVersionSeatPrices_SeatTypeId",
                table: "PlanVersionSeatPrices",
                column: "SeatTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductFeatures_ProductId_Key",
                table: "ProductFeatures",
                columns: new[] { "ProductId", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductSeatTypes_ProductId_Code",
                table: "ProductSeatTypes",
                columns: new[] { "ProductId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SignupOrderSeats_SeatTypeId",
                table: "SignupOrderSeats",
                column: "SeatTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_SignupOrderSeats_SignupOrderId_SeatTypeId",
                table: "SignupOrderSeats",
                columns: new[] { "SignupOrderId", "SeatTypeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionSeats_SeatTypeId",
                table: "SubscriptionSeats",
                column: "SeatTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionSeats_SubscriptionId_SeatTypeId",
                table: "SubscriptionSeats",
                columns: new[] { "SubscriptionId", "SeatTypeId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlanVersionSeatPrices");

            migrationBuilder.DropTable(
                name: "ProductFeatures");

            migrationBuilder.DropTable(
                name: "SignupOrderSeats");

            migrationBuilder.DropTable(
                name: "SubscriptionSeats");

            migrationBuilder.DropTable(
                name: "ProductSeatTypes");

            migrationBuilder.DropColumn(
                name: "Capabilities",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "DatabasePrefix",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "SeatModel",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "TrialPlanCode",
                table: "Products");

            migrationBuilder.AddColumn<int>(
                name: "AndroidLicences",
                table: "Subscriptions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "BothLicences",
                table: "Subscriptions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "WindowsLicences",
                table: "Subscriptions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "AndroidLicences",
                table: "SignupOrders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "BothLicences",
                table: "SignupOrders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "WindowsLicences",
                table: "SignupOrders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "AndroidUserPriceMinor",
                table: "PlanVersions",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "BothUserPriceMinor",
                table: "PlanVersions",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "WindowsUserPriceMinor",
                table: "PlanVersions",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);
        }
    }
}
