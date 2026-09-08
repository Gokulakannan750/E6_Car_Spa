using System.IO.Compression;
using System.Text;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
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

    private static string ExtractAllText(byte[] pdfBytes)
    {
        var rawString = Encoding.UTF8.GetString(pdfBytes);
        var decompressedStreams = new List<string>();

        // Decompress FlateDecode/ZLib streams
        var streamStartTag = Encoding.ASCII.GetBytes("stream\n");
        var streamStartTagCrlf = Encoding.ASCII.GetBytes("stream\r\n");
        var streamEndTag = Encoding.ASCII.GetBytes("endstream");

        int pos = 0;
        while (pos < pdfBytes.Length)
        {
            var idx = IndexOf(pdfBytes, streamStartTag, pos);
            var tagLen = streamStartTag.Length;
            if (idx == -1)
            {
                idx = IndexOf(pdfBytes, streamStartTagCrlf, pos);
                tagLen = streamStartTagCrlf.Length;
            }
            if (idx == -1) break;

            var start = idx + tagLen;
            var end = IndexOf(pdfBytes, streamEndTag, start);
            if (end == -1) break;

            var streamBytes = new byte[end - start];
            Array.Copy(pdfBytes, start, streamBytes, 0, streamBytes.Length);

            try
            {
                var len = streamBytes.Length;
                while (len > 0 && (streamBytes[len - 1] == (byte)'\r' || streamBytes[len - 1] == (byte)'\n'))
                {
                    len--;
                }
                var cleanBytes = new byte[len];
                Array.Copy(streamBytes, 0, cleanBytes, 0, len);

                using var ms = new MemoryStream(cleanBytes);
                if (cleanBytes.Length > 2 && cleanBytes[0] == 0x78)
                {
                    using var zlib = new ZLibStream(ms, CompressionMode.Decompress);
                    using var reader = new StreamReader(zlib, Encoding.UTF8);
                    decompressedStreams.Add(reader.ReadToEnd());
                }
                else
                {
                    using var deflate = new DeflateStream(ms, CompressionMode.Decompress);
                    using var reader = new StreamReader(deflate, Encoding.UTF8);
                    decompressedStreams.Add(reader.ReadToEnd());
                }
            }
            catch { }

            pos = end + streamEndTag.Length;
        }

        // Build list of CMaps from each ToUnicode stream
        var cmaps = new List<Dictionary<int, string>>();
        foreach (var stream in decompressedStreams)
        {
            if (stream.Contains("begincmap") || stream.Contains("beginbfchar") || stream.Contains("beginbfrange"))
            {
                var fontCmap = new Dictionary<int, string>();
                var charMatches = System.Text.RegularExpressions.Regex.Matches(stream, @"<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>");
                foreach (System.Text.RegularExpressions.Match m in charMatches)
                {
                    var src = Convert.ToInt32(m.Groups[1].Value, 16);
                    var dst = Convert.ToInt32(m.Groups[2].Value, 16);
                    fontCmap[src] = ((char)dst).ToString();
                }

                var rangeMatches = System.Text.RegularExpressions.Regex.Matches(stream, @"<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>");
                foreach (System.Text.RegularExpressions.Match m in rangeMatches)
                {
                    var startGid = Convert.ToInt32(m.Groups[1].Value, 16);
                    var endGid = Convert.ToInt32(m.Groups[2].Value, 16);
                    var dstStart = Convert.ToInt32(m.Groups[3].Value, 16);
                    for (int i = 0; i <= endGid - startGid; i++)
                    {
                        fontCmap[startGid + i] = ((char)(dstStart + i)).ToString();
                    }
                }

                if (fontCmap.Count > 0)
                {
                    cmaps.Add(fontCmap);
                }
            }
        }

        var sb = new StringBuilder();
        sb.AppendLine(rawString);

        // Decode hex glyphs in content streams using all font CMaps
        foreach (var stream in decompressedStreams)
        {
            sb.AppendLine(stream);

            foreach (var cmap in cmaps)
            {
                var hexTokens = System.Text.RegularExpressions.Regex.Matches(stream, @"<([0-9a-fA-F]{4,})>");
                var unspaced = new StringBuilder();
                var spaced = new StringBuilder();
                foreach (System.Text.RegularExpressions.Match m in hexTokens)
                {
                    var hex = m.Groups[1].Value;
                    for (int i = 0; i + 4 <= hex.Length; i += 4)
                    {
                        var gid = Convert.ToInt32(hex.Substring(i, 4), 16);
                        if (cmap.TryGetValue(gid, out var ch))
                        {
                            unspaced.Append(ch);
                            spaced.Append(ch);
                        }
                    }
                    spaced.Append(' ');
                }
                sb.AppendLine(unspaced.ToString());
                sb.AppendLine(spaced.ToString());
            }
        }

        return sb.ToString();
    }

    private static int IndexOf(byte[] haystack, byte[] needle, int start)
    {
        for (int i = start; i <= haystack.Length - needle.Length; i++)
        {
            bool match = true;
            for (int j = 0; j < needle.Length; j++)
            {
                if (haystack[i + j] != needle[j])
                {
                    match = false;
                    break;
                }
            }
            if (match) return i;
        }
        return -1;
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
}
