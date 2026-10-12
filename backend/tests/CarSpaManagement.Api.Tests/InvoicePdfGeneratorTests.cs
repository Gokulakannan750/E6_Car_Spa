using System.Text;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using UglyToad.PdfPig;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class InvoicePdfGeneratorTests
{
    private static Invoice CreateSampleInvoice()
    {
        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = "John Doe",
            PhoneNumber = "9876543210",
            Email = "john.doe@example.com"
        };

        var vehicle = new Vehicle
        {
            Id = Guid.NewGuid(),
            RegistrationNumber = "TN 38 AA 1234",
            Make = "Hyundai",
            Model = "Creta",
            Color = "Polar White"
        };

        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "INV-2026-000013",
            InvoiceDate = new DateTime(2026, 3, 15),
            CustomerId = customer.Id,
            Customer = customer,
            VehicleId = vehicle.Id,
            Vehicle = vehicle,
            Status = InvoiceStatus.Generated,
            IsGstEnabled = true,
            Subtotal = 2000.00m,
            Discount = 200.00m,
            TaxableAmount = 1800.00m,
            GstAmount = 324.00m,
            TotalAmount = 2124.00m,
            PaidAmount = 1500.00m,
            BalanceAmount = 624.00m,
            Notes = "Water wash and interior foam cleaning completed perfectly.",
            InvoiceItems = new List<InvoiceItem>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Description = "Full Body Foam Wash",
                    Quantity = 1,
                    UnitPrice = 1200.00m,
                    TotalAmount = 1200.00m
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    Description = "Interior Vacuum & Sanitization",
                    Quantity = 1,
                    UnitPrice = 800.00m,
                    TotalAmount = 800.00m
                }
            }
        };

        return invoice;
    }

    /// <summary>
    /// Reads the visible text of the PDF with PdfPig, which decodes any embedded font. The PDF uses
    /// whatever font the machine has (Arial on Windows, a fallback on Linux CI), so the tests must not
    /// depend on how one particular font encodes its glyphs.
    /// </summary>
    private static string ExtractAllText(byte[] pdfBytes)
    {
        using var document = PdfDocument.Open(pdfBytes);
        var sb = new StringBuilder();
        foreach (var page in document.GetPages())
        {
            sb.AppendLine(page.Text);
            sb.AppendLine(string.Join(" ", page.GetWords().Select(w => w.Text)));
        }
        return sb.ToString();
    }

    [Fact]
    public void GenerateInvoicePdf_ReturnsNonEmptyBytes()
    {
        var generator = new InvoicePdfGenerator();
        var invoice = CreateSampleInvoice();

        var bytes = generator.GenerateInvoicePdf(invoice);

        Assert.NotNull(bytes);
        Assert.NotEmpty(bytes);
        Assert.True(bytes.Length > 1000);
    }

    [Fact]
    public void GenerateInvoicePdf_BeginsWithPdfHeader()
    {
        var generator = new InvoicePdfGenerator();
        var invoice = CreateSampleInvoice();

        var bytes = generator.GenerateInvoicePdf(invoice);

        Assert.True(bytes.Length >= 5);
        Assert.Equal((byte)'%', bytes[0]);
        Assert.Equal((byte)'P', bytes[1]);
        Assert.Equal((byte)'D', bytes[2]);
        Assert.Equal((byte)'F', bytes[3]);
        Assert.Equal((byte)'-', bytes[4]);
    }

    [Fact]
    public void GenerateInvoicePdf_ContainsInvoiceNumber()
    {
        var generator = new InvoicePdfGenerator();
        var invoice = CreateSampleInvoice();

        var bytes = generator.GenerateInvoicePdf(invoice);
        var text = ExtractAllText(bytes);

        Assert.Contains("INV-2026-000013", text);
    }

    [Fact]
    public void GenerateInvoicePdf_ContainsCustomerName()
    {
        var generator = new InvoicePdfGenerator();
        var invoice = CreateSampleInvoice();

        var bytes = generator.GenerateInvoicePdf(invoice);
        var text = ExtractAllText(bytes);

        Assert.Contains("John Doe", text);
    }

    [Fact]
    public void GenerateInvoicePdf_ContainsVehicleRegistration()
    {
        var generator = new InvoicePdfGenerator();
        var invoice = CreateSampleInvoice();

        var bytes = generator.GenerateInvoicePdf(invoice);
        var text = ExtractAllText(bytes);

        Assert.True(text.Contains("TN 38 AA 1234") || (text.Contains("TN") && text.Contains("1234")), "Vehicle registration number must be present in generated PDF.");
    }

    [Fact]
    public void GenerateInvoicePdf_ContainsInvoiceItemInformation()
    {
        var generator = new InvoicePdfGenerator();
        var invoice = CreateSampleInvoice();

        var bytes = generator.GenerateInvoicePdf(invoice);
        var text = ExtractAllText(bytes);

        Assert.Contains("Full Body Foam Wash", text);
        Assert.True(text.Contains("Interior Vacuum") && text.Contains("Sanitization"), "Invoice item details must be present in generated PDF.");
    }

    [Fact]
    public void GenerateInvoicePdf_UsesAuthoritativeInvoiceTotals()
    {
        var generator = new InvoicePdfGenerator();
        var invoice = CreateSampleInvoice();
        invoice.TotalAmount = 2124.00m;
        invoice.PaidAmount = 1500.00m;
        invoice.BalanceAmount = 624.00m;

        var bytes = generator.GenerateInvoicePdf(invoice);
        var text = ExtractAllText(bytes);

        Assert.Contains("2,124.00", text);
        Assert.Contains("1,500.00", text);
        Assert.Contains("624.00", text);
    }

    [Fact]
    public void GenerateInvoicePdf_DoesNotRecalculateDomainValues()
    {
        var generator = new InvoicePdfGenerator();
        var invoice = CreateSampleInvoice();

        // Custom amounts that don't match simple items sum
        invoice.Subtotal = 9999.00m;
        invoice.TotalAmount = 8888.00m;
        invoice.PaidAmount = 5000.00m;
        invoice.BalanceAmount = 3888.00m;

        var bytes = generator.GenerateInvoicePdf(invoice);
        var text = ExtractAllText(bytes);

        // Entity was not mutated
        Assert.Equal(9999.00m, invoice.Subtotal);
        Assert.Equal(8888.00m, invoice.TotalAmount);
        Assert.Equal(5000.00m, invoice.PaidAmount);
        Assert.Equal(3888.00m, invoice.BalanceAmount);

        // Authoritative values rendered in PDF
        Assert.Contains("8,888.00", text);
        Assert.Contains("5,000.00", text);
        Assert.Contains("3,888.00", text);
    }

    [Fact]
    public void GenerateInvoicePdf_HandlesMissingBusinessProfileGracefully()
    {
        var generator = new InvoicePdfGenerator();
        var invoice = CreateSampleInvoice();

        var bytes = generator.GenerateInvoicePdf(invoice, businessProfile: null);

        Assert.NotNull(bytes);
        Assert.True(bytes.Length > 0);
    }

    [Fact]
    public void GenerateInvoicePdf_HandlesMissingLogoGracefully()
    {
        var generator = new InvoicePdfGenerator();
        var invoice = CreateSampleInvoice();
        var profile = new BusinessProfile
        {
            Id = Guid.NewGuid(),
            BusinessName = "E6 Car Spa Test",
            LogoPath = "/uploads/logos/non_existent_logo_12345.png"
        };

        var bytes = generator.GenerateInvoicePdf(invoice, profile);

        Assert.NotNull(bytes);
        Assert.True(bytes.Length > 0);
    }

    [Fact]
    public void GenerateInvoicePdf_DoesNotExposeSecrets()
    {
        var generator = new InvoicePdfGenerator();
        var invoice = CreateSampleInvoice();
        var rawContent = Encoding.UTF8.GetString(generator.GenerateInvoicePdf(invoice));

        Assert.DoesNotContain("Bearer", rawContent);
        Assert.DoesNotContain("EAAB", rawContent);
        Assert.DoesNotContain("client_secret", rawContent);
    }

    [Fact]
    public void PdfSizeValidation_VerifiesGeneratedPdfIsWithinLimit()
    {
        var generator = new InvoicePdfGenerator();
        var invoice = CreateSampleInvoice();
        var bytes = generator.GenerateInvoicePdf(invoice);

        // Standard A4 PDF should be well below 5 MB (typically 20KB - 200KB)
        Assert.True(bytes.Length < 5 * 1024 * 1024);
        Assert.True(bytes.Length > 1024);
    }

    // ── Company-neutral documents ───────────────────────────────────────────────────

    private static readonly string[] LegacyBuiltInText =
    {
        "E6 CAR SPA", "E6 Car Spa", "e6carspa", "Geetha", "Sakthi", "9578749449", "Perundurai",
        "Premium Auto Detailing", "vehicle detailing services"
    };

    private static void AssertNoLegacyText(string text)
    {
        foreach (var legacy in LegacyBuiltInText)
            Assert.DoesNotContain(legacy, text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void GenerateInvoicePdf_ShowsTheCompanysOwnDetailsTaglineAndTerms()
    {
        var profile = new BusinessProfile
        {
            Id = Guid.NewGuid(),
            BusinessName = "Sunrise Detailing",
            AddressLine1 = "12 Park Road",
            City = "Pune",
            State = "Maharashtra",
            PostalCode = "411001",
            Phone = "9123456789",
            Email = "hello@sunrise.example",
            Tagline = "Shine every day",
            TermsAndConditions = "Pay within 7 days." + Environment.NewLine + "No refunds after delivery.",
            BrandColor = "#0F766E"
        };

        var text = ExtractAllText(new InvoicePdfGenerator().GenerateInvoicePdf(CreateSampleInvoice(), profile));

        Assert.Contains("SUNRISE DETAILING", text);
        Assert.Contains("12 Park Road", text);
        Assert.Contains("Pune", text);
        Assert.Contains("411001", text);
        Assert.Contains("9123456789", text);
        Assert.Contains("hello@sunrise.example", text);
        Assert.Contains("Shine every day", text);
        Assert.Contains("onditions", text);
        Assert.Contains("within", text);
        Assert.Contains("refunds", text);
        Assert.Contains("Thank you for choosing Sunrise Detailing!", text);
        AssertNoLegacyText(text);
    }

    [Fact]
    public void GenerateInvoicePdf_WithNoProfile_PrintsNoCompanyDetailsAtAll()
    {
        var text = ExtractAllText(new InvoicePdfGenerator().GenerateInvoicePdf(CreateSampleInvoice(), businessProfile: null));

        Assert.Contains("INV-2026-000013", text);
        Assert.Contains("Thank you!", text);
        Assert.DoesNotContain("onditions", text);
        Assert.DoesNotContain("hone:", text);
        Assert.DoesNotContain("mail:", text);
        AssertNoLegacyText(text);
    }

    [Fact]
    public void GenerateInvoicePdf_WithAnEmptyProfile_PrintsNoCompanyDetailsAtAll()
    {
        var text = ExtractAllText(new InvoicePdfGenerator().GenerateInvoicePdf(CreateSampleInvoice(), new BusinessProfile()));

        Assert.DoesNotContain("onditions", text);
        Assert.DoesNotContain("hone:", text);
        AssertNoLegacyText(text);
    }

    [Fact]
    public void GenerateInvoicePdf_LeavesOutTheContactLinesThatAreNotFilledIn()
    {
        var profile = new BusinessProfile { BusinessName = "Only A Name", Phone = "9123456789" };

        var text = ExtractAllText(new InvoicePdfGenerator().GenerateInvoicePdf(CreateSampleInvoice(), profile));

        Assert.Contains("ONLY A NAME", text);
        Assert.Contains("hone:", text);
        Assert.Contains("9123456789", text);
        Assert.DoesNotContain("mail:", text);
        AssertNoLegacyText(text);
    }

    [Fact]
    public void GenerateInvoicePdf_GstInvoice_HasNoHsnSacColumnOrHardCodedCode()
    {
        var invoice = CreateSampleInvoice();
        invoice.IsGstEnabled = true;
        foreach (var item in invoice.InvoiceItems) item.TaxRatePercent = 18m;

        var text = ExtractAllText(new InvoicePdfGenerator().GenerateInvoicePdf(invoice, new BusinessProfile { BusinessName = "Sunrise" }));

        Assert.DoesNotContain("998714", text);
        Assert.DoesNotContain("998729", text);
        Assert.DoesNotContain("SAC", text);
        Assert.DoesNotContain("HSN", text);
    }
}
