using System.ComponentModel.DataAnnotations;
using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Domain.Platform;

// Trovo's subscriptions and billing, kept in the catalog database. Every company (franchisees too) pays Trovo for
// itself; nothing here is shared between companies. Money is stored in minor units (paise) next to its currency.

[System.Text.Json.Serialization.JsonConverter(typeof(System.Text.Json.Serialization.JsonStringEnumConverter<BillingInterval>))]
public enum BillingInterval
{
    Month = 0,
    Year = 1
}

public enum EntitlementValueType
{
    Bool = 0,
    Int = 1
}

/// <summary>A plan of a product, for example "Professional". Its prices and features live in versions.</summary>
public class Plan
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public PlatformProduct? Product { get; set; }

    [Required, MaxLength(40)]
    public string Code { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public List<PlanVersion> Versions { get; set; } = [];
}

/// <summary>
/// The commercial terms of a plan for one billing interval. Never changed once a subscription uses it: a new price
/// is a new version, and existing subscribers keep theirs until they renew onto the new one or change plan.
/// </summary>
public class PlanVersion
{
    public Guid Id { get; set; }
    public Guid PlanId { get; set; }
    public Plan? Plan { get; set; }

    public int Version { get; set; }
    public BillingInterval Interval { get; set; }

    [Required, MaxLength(3)]
    public string Currency { get; set; } = "INR";

    /// <summary>A fixed company fee per period, on top of the user licences (0 when the price is licences only).</summary>
    public long PriceMinor { get; set; }

    /// <summary>The fewest user licences a subscription on this version may have (normally 1).</summary>
    public int IncludedSeats { get; set; }

    /// <summary>Price per period of one user licence for the Android app only.</summary>
    public long AndroidUserPriceMinor { get; set; }

    /// <summary>Price per period of one user licence for the Windows app only.</summary>
    public long WindowsUserPriceMinor { get; set; }

    /// <summary>Price per period of one user licence for both apps.</summary>
    public long BothUserPriceMinor { get; set; }

    public long UserPriceMinor(AppAccess access) => access switch
    {
        AppAccess.Android => AndroidUserPriceMinor,
        AppAccess.Windows => WindowsUserPriceMinor,
        _ => BothUserPriceMinor
    };

    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public DateTime CreatedAt { get; set; }

    public List<PlanEntitlement> Entitlements { get; set; } = [];
}

/// <summary>A feature a plan version grants, for example showroom.enabled = true. Keys come from <c>FeatureKeys</c>.</summary>
public class PlanEntitlement
{
    public Guid Id { get; set; }
    public Guid PlanVersionId { get; set; }

    [Required, MaxLength(80)]
    public string FeatureKey { get; set; } = string.Empty;

    public EntitlementValueType ValueType { get; set; }

    [Required, MaxLength(40)]
    public string Value { get; set; } = string.Empty;
}

/// <summary>Something bought on top of a plan: a module (Showroom, Franchise network) or a pack (5 more users).</summary>
public class AddOn
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }

    [Required, MaxLength(40)]
    public string Code { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>The feature this add-on grants (a module switches it on; a pack adds its quantity to a number).</summary>
    [Required, MaxLength(80)]
    public string FeatureKey { get; set; } = string.Empty;

    /// <summary>For a module "true"; for a pack the amount one unit adds (e.g. "5" users).</summary>
    [Required, MaxLength(40)]
    public string Value { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }

    public List<AddOnPrice> Prices { get; set; } = [];
}

/// <summary>A versioned price of an add-on for one billing interval (same rules as plan versions).</summary>
public class AddOnPrice
{
    public Guid Id { get; set; }
    public Guid AddOnId { get; set; }
    public AddOn? AddOn { get; set; }

    public int Version { get; set; }
    public BillingInterval Interval { get; set; }

    [Required, MaxLength(3)]
    public string Currency { get; set; } = "INR";

    public long UnitPriceMinor { get; set; }
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Who Trovo bills and where the invoice goes. One per company in v1: every company pays for itself.</summary>
public class BillingAccount
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public PlatformCompany? Company { get; set; }

    [Required, MaxLength(150)]
    public string BillingName { get; set; } = string.Empty;

    [MaxLength(150)]
    public string? BillingEmail { get; set; }

    [MaxLength(20)]
    public string? BillingPhone { get; set; }

    [MaxLength(15)]
    public string? Gstin { get; set; }

    [MaxLength(500)]
    public string? BillingAddress { get; set; }

    /// <summary>Two-digit GST state code of the billing address (decides CGST+SGST or IGST once Trovo charges GST).</summary>
    [MaxLength(2)]
    public string? StateCode { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public enum SubscriptionStatus
{
    /// <summary>Checkout started, not paid. The company is not usable yet.</summary>
    Incomplete = 0,
    /// <summary>Free trial with full access until TrialEndsAt.</summary>
    Trialing = 1,
    /// <summary>Paid through CurrentPeriodEnd.</summary>
    Active = 2,
    /// <summary>A renewal failed; full access continues until GraceEndsAt.</summary>
    PastDue = 3,
    /// <summary>Grace or trial ended unpaid: the company can sign in, view and export, but not change anything.</summary>
    ReadOnly = 4,
    /// <summary>Switched off by Trovo (with a reason). Nobody can sign in.</summary>
    Suspended = 5,
    /// <summary>Ended. Read-only for the retention period, then the data is deleted on request.</summary>
    Canceled = 6
}

/// <summary>A company's subscription to a plan version. At most one current subscription per company.</summary>
public class Subscription
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public PlatformCompany? Company { get; set; }

    public Guid BillingAccountId { get; set; }
    public BillingAccount? BillingAccount { get; set; }

    public Guid PlanVersionId { get; set; }
    public PlanVersion? PlanVersion { get; set; }

    public SubscriptionStatus Status { get; set; }

    /// <summary>The state before a suspension, restored when Trovo reactivates the company.</summary>
    public SubscriptionStatus? StatusBeforeSuspension { get; set; }

    /// <summary>True while this is the company's current subscription (only one per company).</summary>
    public bool IsCurrent { get; set; } = true;

    public DateTime StartedAt { get; set; }
    public DateTime CurrentPeriodStart { get; set; }
    public DateTime CurrentPeriodEnd { get; set; }
    public DateTime? TrialEndsAt { get; set; }
    public DateTime? GraceEndsAt { get; set; }
    public bool CancelAtPeriodEnd { get; set; }
    public DateTime? CanceledAt { get; set; }

    /// <summary>Until when a canceled company keeps read-only access to its data.</summary>
    public DateTime? RetainUntil { get; set; }

    /// <summary>User licences bought: each active user needs one of their app type.</summary>
    public int AndroidLicences { get; set; }
    public int WindowsLicences { get; set; }
    public int BothLicences { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public LicenceCounts Licences
    {
        get => new(AndroidLicences, WindowsLicences, BothLicences);
        set
        {
            AndroidLicences = value.Android;
            WindowsLicences = value.Windows;
            BothLicences = value.Both;
        }
    }

    [MaxLength(30)]
    public string? GatewayProvider { get; set; }

    [MaxLength(100)]
    public string? GatewaySubscriptionId { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public List<SubscriptionItem> Items { get; set; } = [];
}

public enum SubscriptionItemType
{
    AddOn = 0
}

/// <summary>An add-on on a subscription, with its quantity. History is kept by closing items, not deleting them.</summary>
public class SubscriptionItem
{
    public Guid Id { get; set; }
    public Guid SubscriptionId { get; set; }
    public Subscription? Subscription { get; set; }

    public SubscriptionItemType ItemType { get; set; }

    public Guid AddOnPriceId { get; set; }
    public AddOnPrice? AddOnPrice { get; set; }

    public int Quantity { get; set; } = 1;
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
}

public enum PlatformActorType
{
    System = 0,
    Admin = 1,
    Gateway = 2,
    Owner = 3
}

/// <summary>Append-only history of a subscription: trial started, activated, renewed, payment failed, suspended...</summary>
public class SubscriptionEvent
{
    public Guid Id { get; set; }
    public Guid SubscriptionId { get; set; }

    [Required, MaxLength(60)]
    public string EventType { get; set; } = string.Empty;

    public DateTime EffectiveAt { get; set; }
    public PlatformActorType ActorType { get; set; }
    public Guid? ActorId { get; set; }

    /// <summary>Small JSON with the details (old and new state, amounts, reason).</summary>
    public string? Metadata { get; set; }

    public DateTime CreatedAt { get; set; }
}

public enum BillingInvoiceStatus
{
    Draft = 0,
    Open = 1,
    Paid = 2,
    Void = 3,
    Uncollectible = 4
}

/// <summary>
/// An invoice from Trovo to a company for the software subscription. Its own number series (TROVO/2026-27/0001);
/// never mixed with the company's own GST/ and BILL/ invoices to its customers.
/// </summary>
public class BillingInvoice
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public Guid? SubscriptionId { get; set; }
    public Guid BillingAccountId { get; set; }

    [Required, MaxLength(40)]
    public string InvoiceNumber { get; set; } = string.Empty;

    [Required, MaxLength(3)]
    public string Currency { get; set; } = "INR";

    public long SubtotalMinor { get; set; }

    /// <summary>GST charged. Zero while Trovo is not registered for GST.</summary>
    public long TaxMinor { get; set; }

    /// <summary>The GST rate applied (e.g. 18.00), or null when no GST was charged.</summary>
    public decimal? TaxRatePercent { get; set; }

    public long TotalMinor { get; set; }
    public long AmountDueMinor { get; set; }
    public BillingInvoiceStatus Status { get; set; }

    public DateTime? PeriodStart { get; set; }
    public DateTime? PeriodEnd { get; set; }
    public DateTime IssuedAt { get; set; }
    public DateTime DueAt { get; set; }
    public DateTime? PaidAt { get; set; }

    /// <summary>Snapshot of the billing details at issue time, so later edits never change an issued invoice.</summary>
    [MaxLength(150)]
    public string BillToName { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? BillToAddress { get; set; }

    [MaxLength(15)]
    public string? BillToGstin { get; set; }

    public DateTime CreatedAt { get; set; }

    public List<BillingInvoiceLine> Lines { get; set; } = [];
}

public class BillingInvoiceLine
{
    public Guid Id { get; set; }
    public Guid BillingInvoiceId { get; set; }

    [Required, MaxLength(200)]
    public string Description { get; set; } = string.Empty;

    public int Quantity { get; set; } = 1;
    public long UnitPriceMinor { get; set; }
    public long AmountMinor { get; set; }
    public int SortOrder { get; set; }
}

public enum PaymentTransactionStatus
{
    Pending = 0,
    Succeeded = 1,
    Failed = 2,
    Refunded = 3,
    PartiallyRefunded = 4
}

/// <summary>
/// One payment attempt against a Trovo invoice: a manual payment (bank transfer, UPI) recorded by Trovo, or a
/// gateway payment. Never overwritten: a refund is recorded on top, not by changing the original amount.
/// </summary>
public class PaymentTransaction
{
    public Guid Id { get; set; }
    public Guid BillingInvoiceId { get; set; }
    public BillingInvoice? BillingInvoice { get; set; }

    /// <summary>"Manual" for payments Trovo records itself, or the gateway's name.</summary>
    [Required, MaxLength(30)]
    public string Provider { get; set; } = "Manual";

    [MaxLength(100)]
    public string? ProviderOrderId { get; set; }

    [MaxLength(100)]
    public string? ProviderPaymentId { get; set; }

    public long AmountMinor { get; set; }

    [Required, MaxLength(3)]
    public string Currency { get; set; } = "INR";

    public PaymentTransactionStatus Status { get; set; }
    public DateTime? PaidAt { get; set; }
    public long RefundedAmountMinor { get; set; }

    /// <summary>For manual payments: the method and reference (e.g. "UPI 4521…", "NEFT UTR …").</summary>
    [MaxLength(200)]
    public string? Reference { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>A gateway notification, stored once per provider event id so it is processed exactly once.</summary>
public class PaymentWebhookEvent
{
    public Guid Id { get; set; }

    [Required, MaxLength(30)]
    public string Provider { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string ProviderEventId { get; set; } = string.Empty;

    [Required, MaxLength(64)]
    public string PayloadHash { get; set; } = string.Empty;

    [MaxLength(60)]
    public string? EventType { get; set; }

    public DateTime ReceivedAt { get; set; }

    [Required, MaxLength(20)]
    public string ProcessingStatus { get; set; } = "Received";

    public DateTime? ProcessedAt { get; set; }
    public int RetryCount { get; set; }

    [MaxLength(1000)]
    public string? LastError { get; set; }
}

public enum PlatformAdminRole
{
    /// <summary>Everything, including the audit log and migrations.</summary>
    Owner = 0,
    /// <summary>Plans, subscriptions, invoices and payments.</summary>
    Billing = 1,
    /// <summary>Companies, registration codes, suspend and reactivate.</summary>
    Support = 2,
    /// <summary>View only.</summary>
    ReadOnly = 3
}

/// <summary>A Trovo staff member who administers the platform. Entirely separate from every company's users.</summary>
public class PlatformAdmin
{
    public Guid Id { get; set; }

    [Required, MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(500)]
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>The 2-step verification (TOTP) secret, encrypted with the server key. Null until set up.</summary>
    [MaxLength(500)]
    public string? TotpSecretEncrypted { get; set; }

    public bool TotpConfirmed { get; set; }

    /// <summary>Set for a one-time password (new admin or reset): the admin must choose a new password before anything else.</summary>
    public bool MustChangePassword { get; set; }

    public PlatformAdminRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public int FailedSignInAttempts { get; set; }
    public DateTime? LockedUntil { get; set; }
    public DateTime? LastSignInAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Append-only record of every change a platform admin makes (who, what, which company, before and after, why).
/// The catalog's application login may only add and read these rows.
/// </summary>
public class PlatformAuditLog
{
    public Guid Id { get; set; }
    public Guid? AdministratorId { get; set; }

    [MaxLength(150)]
    public string? AdministratorEmail { get; set; }

    [Required, MaxLength(80)]
    public string Action { get; set; } = string.Empty;

    public Guid? TargetCompanyId { get; set; }
    public string? BeforeValues { get; set; }
    public string? AfterValues { get; set; }

    [MaxLength(500)]
    public string? Reason { get; set; }

    [MaxLength(64)]
    public string? CorrelationId { get; set; }

    [MaxLength(64)]
    public string? IpAddress { get; set; }

    public DateTime CreatedAt { get; set; }
}

/// <summary>Running counters in the catalog, e.g. the Trovo invoice number per financial year.</summary>
public class PlatformCounter
{
    [Required, MaxLength(60)]
    public string Key { get; set; } = string.Empty;

    public long Value { get; set; }
}

/// <summary>The feature keys plans and add-ons can grant. Code checks only these keys, never plan names.</summary>
/// <summary>How many user licences of each app type a subscription has.</summary>
public readonly record struct LicenceCounts(int Android, int Windows, int Both)
{
    public const int MaxPerType = 500;

    public int Total => Android + Windows + Both;

    public int Of(AppAccess access) => access switch
    {
        AppAccess.Android => Android,
        AppAccess.Windows => Windows,
        _ => Both
    };

    /// <summary>What is wrong with these numbers (negative, absurd, or fewer than the plan needs), or null.</summary>
    public string? Problem(int minimum)
    {
        foreach (var (name, count) in new[] { ("Android", Android), ("Windows", Windows), ("Windows + Android", Both) })
        {
            if (count < 0 || count > MaxPerType) return $"{name} licences must be between 0 and {MaxPerType}.";
        }
        var needed = Math.Max(1, minimum);
        return Total < needed ? $"At least {needed} user licence{(needed == 1 ? " is" : "s are")} needed." : null;
    }
}

public static class FeatureKeys
{
    public const string UsersMaxActive = "users.max_active";
    public const string Showroom = "showroom.enabled";
    public const string WhatsAppAutomation = "whatsapp_automation.enabled";
    public const string FranchiseNetwork = "franchise_network.enabled";
    public const string FranchiseNetworkBranches = "franchise_network.max_branches";
    public const string OutsideJobs = "outside_jobs.enabled";
    public const string StaffAdvances = "staff_advances.enabled";
    public const string AdvancedReports = "reports.advanced";
    public const string AuditTrail = "audit_trail.enabled";

    // Computed from the subscription's licences (not set on plans or add-ons); reported with the other features.
    public const string LicencesAndroid = "licences.android";
    public const string LicencesWindows = "licences.windows";
    public const string LicencesBoth = "licences.both";

    public static readonly IReadOnlyDictionary<string, EntitlementValueType> All = new Dictionary<string, EntitlementValueType>
    {
        [UsersMaxActive] = EntitlementValueType.Int,
        [Showroom] = EntitlementValueType.Bool,
        [WhatsAppAutomation] = EntitlementValueType.Bool,
        [FranchiseNetwork] = EntitlementValueType.Bool,
        [FranchiseNetworkBranches] = EntitlementValueType.Int,
        [OutsideJobs] = EntitlementValueType.Bool,
        [StaffAdvances] = EntitlementValueType.Bool,
        [AdvancedReports] = EntitlementValueType.Bool,
        [AuditTrail] = EntitlementValueType.Bool,
    };
}

/// <summary>
/// A business setting Trovo changes from the admin portal (trial length, grace days...). Overrides the server's
/// configured default; see <c>PlatformSettingsService</c>.
/// </summary>
public class PlatformSetting
{
    [Key, MaxLength(60)]
    public string Key { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string Value { get; set; } = string.Empty;

    public DateTime UpdatedAt { get; set; }

    [MaxLength(150)]
    public string? UpdatedBy { get; set; }
}

[System.Text.Json.Serialization.JsonConverter(typeof(System.Text.Json.Serialization.JsonStringEnumConverter<SignupStart>))]
public enum SignupStart
{
    Trial = 0,
    Paid = 1
}

[System.Text.Json.Serialization.JsonConverter(typeof(System.Text.Json.Serialization.JsonStringEnumConverter<SignupStatus>))]
public enum SignupStatus
{
    /// <summary>A paid order waiting for its payment.</summary>
    AwaitingPayment = 0,
    /// <summary>Done: the company exists (trial started, or paid and activated).</summary>
    Completed = 1,
    /// <summary>Not paid in time.</summary>
    Expired = 2,
    /// <summary>Paid, but creating the company failed; Trovo finishes it by hand.</summary>
    NeedsAttention = 3,
    /// <summary>Payment received; the company is being created right now.</summary>
    Processing = 4
}

/// <summary>
/// A business signing up on the public website: its details, what it chose, the price fixed when it ordered, and what
/// happened. The company is created only when the trial starts or the payment arrives, so abandoned checkouts leave
/// no databases behind.
/// </summary>
public class SignupOrder
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }

    public SignupStart Start { get; set; }
    public SignupStatus Status { get; set; }

    [Required, MaxLength(150)]
    public string BusinessName { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string OwnerName { get; set; } = string.Empty;

    /// <summary>10-digit Indian mobile number, digits only.</summary>
    [Required, MaxLength(10)]
    public string Mobile { get; set; } = string.Empty;

    /// <summary>Lower-case email.</summary>
    [Required, MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required, MaxLength(80)]
    public string City { get; set; } = string.Empty;

    [Required, MaxLength(80)]
    public string State { get; set; } = string.Empty;

    [MaxLength(15)]
    public string? Gstin { get; set; }

    [MaxLength(40)]
    public string? PlanCode { get; set; }

    public BillingInterval? Interval { get; set; }
    public int AndroidLicences { get; set; }
    public int WindowsLicences { get; set; }
    public int BothLicences { get; set; }

    /// <summary>Add-on codes and quantities chosen (JSON object).</summary>
    [MaxLength(1000)]
    public string? AddOnsJson { get; set; }

    /// <summary>The price fixed at ordering, in minor units; the payment must match it.</summary>
    public long AmountMinor { get; set; }

    [Required, MaxLength(3)]
    public string Currency { get; set; } = "INR";

    /// <summary>The quoted lines (JSON), kept to show the customer exactly what they agreed to.</summary>
    [MaxLength(4000)]
    public string? QuoteJson { get; set; }

    /// <summary>SHA-256 of the secret the customer's browser holds; needed to pay or see the order.</summary>
    [Required, MaxLength(64)]
    public string TokenHash { get; set; } = string.Empty;

    public Guid? CompanyId { get; set; }

    [MaxLength(30)]
    public string? PaymentProvider { get; set; }

    [MaxLength(100)]
    public string? PaymentReference { get; set; }

    [MaxLength(500)]
    public string? FailureReason { get; set; }

    [MaxLength(64)]
    public string? IpAddress { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
