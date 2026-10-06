using System.Text.Json;
using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.Common;

/// <summary>A message template Trovo creates and maintains on a client's WhatsApp Business Account.</summary>
/// <param name="ParameterKeys">Snapshot JSON keys (see WhatsAppService queue methods), in {{1}}..{{n}} order.</param>
public sealed record ManagedWhatsAppTemplate(
    WhatsAppMessageType MessageType,
    string Purpose,
    string Name,
    string Language,
    string Category,
    string? HeaderFormat,
    string BodyText,
    IReadOnlyList<string> ParameterKeys,
    IReadOnlyList<string> BodyExamples)
{
    /// <summary>Builds the BODY parameters from a queued message's snapshot, in template order.</summary>
    public List<string> ResolveParameters(JsonElement snapshot)
    {
        var values = new List<string>(ParameterKeys.Count);
        foreach (var key in ParameterKeys)
        {
            var value = snapshot.ValueKind == JsonValueKind.Object
                && snapshot.TryGetProperty(key, out var prop)
                && prop.ValueKind == JsonValueKind.String
                    ? prop.GetString()
                    : null;
            values.Add(string.IsNullOrWhiteSpace(value) ? WhatsAppTemplateCatalog.FallbackFor(key) : value.Trim());
        }
        return values;
    }
}

/// <summary>
/// The managed template pack: one approved template per message the app sends. Templates belong to each
/// client's own WhatsApp Business Account, so the pack is created there by API (no template editor).
/// Names are versioned; a wording change ships as a new name so approved templates are never edited in place.
/// </summary>
public static class WhatsAppTemplateCatalog
{
    public static readonly ManagedWhatsAppTemplate InvoiceReady = new(
        WhatsAppMessageType.InvoiceFinalized,
        Purpose: "Invoice ready (with PDF)",
        Name: "trovo_invoice_ready_v1",
        Language: "en",
        Category: "UTILITY",
        HeaderFormat: "DOCUMENT",
        BodyText: "Hello {{1}}, your invoice {{2}} for vehicle {{3}} is ready. Total amount: ₹{{4}}. Please find the invoice attached. Thank you!",
        ParameterKeys: ["customerName", "invoiceNumber", "vehicleRegistration", "totalAmount"],
        BodyExamples: ["Ravi", "GST/0001", "TN33AB1234", "1,180.00"]);

    public static readonly ManagedWhatsAppTemplate PaymentReceived = new(
        WhatsAppMessageType.PaymentCompleted,
        Purpose: "Payment received",
        Name: "trovo_payment_received_v1",
        Language: "en",
        Category: "UTILITY",
        HeaderFormat: null,
        BodyText: "Hello {{1}}, we have received your payment of ₹{{2}} for invoice {{3}}. Balance due: ₹{{4}}. Thank you!",
        ParameterKeys: ["customerName", "paymentReceived", "invoiceNumber", "balance"],
        BodyExamples: ["Ravi", "1,180.00", "GST/0001", "0.00"]);

    public static IReadOnlyList<ManagedWhatsAppTemplate> All { get; } = [InvoiceReady, PaymentReceived];

    public static bool TryGet(string? templateName, out ManagedWhatsAppTemplate template)
    {
        template = All.FirstOrDefault(t => string.Equals(t.Name, templateName?.Trim(), StringComparison.OrdinalIgnoreCase))!;
        return template is not null;
    }

    // Same defaults the legacy resolver uses, so a missing value never blocks a send.
    internal static string FallbackFor(string key) => key switch
    {
        "customerName" => "Customer",
        "invoiceNumber" => "INV",
        "vehicleRegistration" => "N/A",
        "totalAmount" or "paymentReceived" or "balance" => "0.00",
        _ => "-",
    };
}
