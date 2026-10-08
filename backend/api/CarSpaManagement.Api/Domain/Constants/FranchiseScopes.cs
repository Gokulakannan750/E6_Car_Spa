namespace CarSpaManagement.Api.Domain.Constants;

/// <summary>The kinds of information a franchisor can ask a franchisee to share.</summary>
public static class FranchiseScopes
{
    /// <summary>Revenue, collections and the number of jobs and invoices. This is the default request.</summary>
    public const string FinancialTotals = "financial_totals";

    public const string InvoiceList = "invoice_list";
    public const string Staff = "staff";
    public const string Customers = "customers";

    public static readonly IReadOnlyDictionary<string, string> Labels = new Dictionary<string, string>
    {
        [FinancialTotals] = "Financial totals (revenue, collections, jobs, invoices)",
        [InvoiceList] = "Invoice list",
        [Staff] = "Staff and attendance",
        [Customers] = "Customers"
    };

    public static bool IsKnown(string scope) => Labels.ContainsKey(scope);
}
