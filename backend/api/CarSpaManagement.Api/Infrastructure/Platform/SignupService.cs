using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Serilog;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>The business details from the website's first step.</summary>
public sealed record SignupBusiness(string Name, string OwnerName, string Mobile, string Email, string City, string State, string? Gstin);

/// <summary>A sign-up: the business, and either a free trial or a plan to pay for.</summary>
public sealed record SignupRequest(SignupBusiness Business, bool StartTrial, PlanChoice? Plan, bool AcceptTerms);

/// <summary>What the website shows after a sign-up step. Codes are present only once, when the company is created.</summary>
public sealed record SignupResult(
    Guid OrderId,
    string? OrderToken,
    SignupStatus Status,
    SignupStart Start,
    PriceQuote? Quote,
    long AmountMinor,
    string Currency,
    DateTime ExpiresAt,
    bool TestPayments,
    string? CompanyCode = null,
    string? RegistrationCode = null,
    DateTime? RegistrationCodeExpiresAt = null,
    DateTime? TrialEndsAt = null,
    DateTime? PaidUntil = null,
    string? InvoiceNumber = null);

/// <summary>
/// Businesses signing up on the public website. A trial creates the company at once; a paid order fixes the price,
/// and the company is created only when the payment arrives (today the test payment; later the gateway). The browser
/// keeps a secret order token; nothing about an order is shown without it.
/// </summary>
public sealed partial class SignupService(
    PlatformDbContext catalog,
    CompanyDatabaseProvisioner provisioner,
    SubscriptionService subscriptions,
    BillingInvoiceService invoices,
    PriceQuoteService quotes,
    PlatformAuditService audit,
    IHostEnvironment environment,
    IOptions<PlatformOptions> options)
{
    public const string TestProvider = "Test";

    private PlatformOptions Settings => options.Value;

    /// <summary>Test payments are allowed only when configured, and never in the Production environment.</summary>
    public bool TestPaymentsAllowed => Settings.TestPayments && !environment.IsProduction();

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")]
    private static partial Regex EmailPattern();

    [GeneratedRegex(@"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")]
    private static partial Regex GstinPattern();

    public async Task<SignupResult> CreateAsync(SignupRequest request, string? ipAddress, CancellationToken cancellationToken = default)
    {
        if (!request.AcceptTerms) throw new ValidationException("Please accept the Terms and the Refund policy.");
        var business = Clean(request.Business);
        var product = await provisioner.EnsureCatalogAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var token = NewToken();

        var order = new SignupOrder
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            BusinessName = business.Name,
            OwnerName = business.OwnerName,
            Mobile = business.Mobile,
            Email = business.Email,
            City = business.City,
            State = business.State,
            Gstin = business.Gstin,
            TokenHash = Hash(token),
            IpAddress = ipAddress,
            CreatedAt = now,
            ExpiresAt = now.AddHours(Settings.SignupOrderHours),
            Currency = "INR"
        };

        if (request.StartTrial)
        {
            // One free trial per email and per mobile number.
            if (await catalog.SignupOrders.AnyAsync(o => o.ProductId == product.Id && o.Start == SignupStart.Trial
                    && o.Status == SignupStatus.Completed && (o.Email == business.Email || o.Mobile == business.Mobile), cancellationToken))
            {
                throw new ConflictException("A free trial was already used with this email or mobile number. Choose a plan, or contact Trovo.");
            }

            order.Start = SignupStart.Trial;
            order.Status = SignupStatus.Processing;
            catalog.SignupOrders.Add(order);
            await catalog.SaveChangesAsync(cancellationToken);

            CreatedCompany created;
            Subscription subscription;
            try
            {
                created = await provisioner.CreateCompanyAsync(business.Name, null, cancellationToken);
                await FillBillingAccountAsync(created.Company.Id, order, cancellationToken);
                subscription = await subscriptions.CurrentAsync(created.Company.Id, cancellationToken);
            }
            catch (Exception ex) when (ex is not ValidationException)
            {
                Log.Error(ex, "Sign-up order {OrderId}: the trial company could not be created", order.Id);
                catalog.ChangeTracker.Clear();
                await catalog.SignupOrders.Where(o => o.Id == order.Id).ExecuteUpdateAsync(set => set
                    .SetProperty(o => o.Status, SignupStatus.NeedsAttention)
                    .SetProperty(o => o.FailureReason, ex.Message.Length > 500 ? ex.Message[..500] : ex.Message), CancellationToken.None);
                throw new ConflictException("We could not set up your trial just now. Please try again in a few minutes or call Trovo.");
            }

            order.Status = SignupStatus.Completed;
            order.CompanyId = created.Company.Id;
            order.CompletedAt = DateTime.UtcNow;
            order.BothLicences = subscription.BothLicences;
            await catalog.SaveChangesAsync(cancellationToken);
            await audit.RecordAsync("signup.trial_started", created.Company.Id, null,
                new { order.Id, created.Company.Code, business.Name, business.Email, trialEndsAt = subscription.TrialEndsAt }, "Public sign-up", cancellationToken);
            Log.Information("Sign-up: trial started for company {Code} (order {OrderId})", created.Company.Code, order.Id);

            return new SignupResult(order.Id, token, order.Status, order.Start, null, 0, order.Currency, order.ExpiresAt, TestPaymentsAllowed,
                created.Company.Code, created.RegistrationCode, created.RegistrationCodeExpiresAt, subscription.TrialEndsAt);
        }

        if (request.Plan is not { } choice) throw new ValidationException("Choose a plan, or start the free trial.");
        var quote = await quotes.QuoteAsync(product.Id, choice, Settings, cancellationToken);

        order.Start = SignupStart.Paid;
        order.Status = SignupStatus.AwaitingPayment;
        order.PlanCode = quote.PlanCode;
        order.Interval = quote.Interval;
        order.AndroidLicences = quote.Licences.Android;
        order.WindowsLicences = quote.Licences.Windows;
        order.BothLicences = quote.Licences.Both;
        order.AddOnsJson = JsonSerializer.Serialize(quote.AddOns);
        order.AmountMinor = quote.TotalMinor;
        order.Currency = quote.Currency;
        order.QuoteJson = JsonSerializer.Serialize(quote.Lines);
        catalog.SignupOrders.Add(order);
        await catalog.SaveChangesAsync(cancellationToken);
        Log.Information("Sign-up: order {OrderId} for {Plan} awaits payment of {Amount}", order.Id, quote.PlanCode, quote.TotalMinor);

        return new SignupResult(order.Id, token, order.Status, order.Start, quote, order.AmountMinor, order.Currency, order.ExpiresAt, TestPaymentsAllowed);
    }

    /// <summary>
    /// The "Pay (test)" button: completes a paid order as if the payment had arrived. Refused unless test payments are
    /// allowed on this server.
    /// </summary>
    public async Task<SignupResult> PayTestAsync(Guid orderId, string? token, CancellationToken cancellationToken = default)
    {
        if (!TestPaymentsAllowed) throw new NotFoundException("Test payments are not available on this server.");
        var order = await FindAsync(orderId, token, cancellationToken);
        return await CompletePaidAsync(order, TestProvider, $"TEST-{order.Id:N}", order.AmountMinor, cancellationToken);
    }

    /// <summary>
    /// Creates the company of a paid order, starts its subscription for one period, issues its first invoice and
    /// records the payment against it. Runs once per order: a second call is refused while or after it runs.
    /// Also the entry point for the payment gateway later (Phase 2.5).
    /// </summary>
    public async Task<SignupResult> CompletePaidAsync(SignupOrder order, string provider, string reference, long paidMinor,
        CancellationToken cancellationToken = default)
    {
        if (order.Start != SignupStart.Paid) throw new ConflictException("This order is a free trial; there is nothing to pay.");
        if (order.Status == SignupStatus.AwaitingPayment && order.ExpiresAt <= DateTime.UtcNow)
        {
            order.Status = SignupStatus.Expired;
            await catalog.SaveChangesAsync(cancellationToken);
        }
        if (order.Status == SignupStatus.Expired) throw new ConflictException("This order has expired. Please start again.");
        if (paidMinor != order.AmountMinor) throw new ValidationException("The amount paid does not match the order.");

        // Claim the order atomically, so two payment calls cannot both create a company.
        var claimed = await catalog.SignupOrders
            .Where(o => o.Id == order.Id && o.Status == SignupStatus.AwaitingPayment)
            .ExecuteUpdateAsync(set => set.SetProperty(o => o.Status, SignupStatus.Processing), cancellationToken);
        if (claimed == 0) throw new ConflictException("This order has already been paid.");
        await catalog.Entry(order).ReloadAsync(cancellationToken);

        try
        {
            var interval = order.Interval ?? BillingInterval.Month;
            var now = DateTime.UtcNow;
            var paidUntil = interval == BillingInterval.Year ? now.AddYears(1) : now.AddMonths(1);
            var addOns = JsonSerializer.Deserialize<Dictionary<string, int>>(order.AddOnsJson ?? "{}") ?? new Dictionary<string, int>();
            var licences = new LicenceCounts(order.AndroidLicences, order.WindowsLicences, order.BothLicences);

            var created = await provisioner.CreateCompanyAsync(order.BusinessName,
                new CompanyPlan(order.PlanCode!, interval, addOns, paidUntil, licences), cancellationToken);
            await FillBillingAccountAsync(created.Company.Id, order, cancellationToken);

            var subscription = await subscriptions.CurrentAsync(created.Company.Id, cancellationToken);
            var invoice = await invoices.CreateForPeriodAsync(subscription, subscription.CurrentPeriodStart, subscription.CurrentPeriodEnd, cancellationToken);
            if (invoice.TotalMinor != order.AmountMinor)
            {
                Log.Warning("Sign-up order {OrderId}: invoice total {Invoice} differs from the order {Order} (prices changed in between)",
                    order.Id, invoice.TotalMinor, order.AmountMinor);
            }
            await subscriptions.RecordPaymentAsync(invoice.Id, invoice.TotalMinor, provider, reference, now,
                new SubscriptionActor(PlatformActorType.Gateway), cancellationToken);

            order.Status = SignupStatus.Completed;
            order.CompanyId = created.Company.Id;
            order.CompletedAt = DateTime.UtcNow;
            order.PaymentProvider = provider;
            order.PaymentReference = reference;
            await catalog.SaveChangesAsync(cancellationToken);
            await audit.RecordAsync("signup.paid", created.Company.Id, null,
                new { order.Id, created.Company.Code, order.BusinessName, order.PlanCode, interval = interval.ToString(), order.AmountMinor, provider, invoice.InvoiceNumber },
                "Public sign-up", cancellationToken);
            Log.Information("Sign-up: order {OrderId} paid ({Provider}); company {Code} created", order.Id, provider, created.Company.Code);

            return new SignupResult(order.Id, null, order.Status, order.Start, null, order.AmountMinor, order.Currency, order.ExpiresAt, TestPaymentsAllowed,
                created.Company.Code, created.RegistrationCode, created.RegistrationCodeExpiresAt, null, subscription.CurrentPeriodEnd, invoice.InvoiceNumber);
        }
        catch (Exception ex)
        {
            // Paid but not finished: never lose the order. Trovo sees it and completes it by hand.
            Log.Error(ex, "Sign-up order {OrderId} was paid but the company could not be created", order.Id);
            catalog.ChangeTracker.Clear();
            await catalog.SignupOrders.Where(o => o.Id == order.Id)
                .ExecuteUpdateAsync(set => set
                    .SetProperty(o => o.Status, SignupStatus.NeedsAttention)
                    .SetProperty(o => o.PaymentProvider, provider)
                    .SetProperty(o => o.PaymentReference, reference)
                    .SetProperty(o => o.FailureReason, ex.Message.Length > 500 ? ex.Message[..500] : ex.Message), CancellationToken.None);
            throw new ConflictException("Your payment was received but we could not finish setting up your company. Trovo has been told and will call you.");
        }
    }

    /// <summary>An order's state for the website (e.g. after a page reload). Codes are never shown again here.</summary>
    public async Task<SignupResult> StatusAsync(Guid orderId, string? token, CancellationToken cancellationToken = default)
    {
        var order = await FindAsync(orderId, token, cancellationToken);
        if (order.Status == SignupStatus.AwaitingPayment && order.ExpiresAt <= DateTime.UtcNow)
        {
            order.Status = SignupStatus.Expired;
            await catalog.SaveChangesAsync(cancellationToken);
        }
        var code = order.CompanyId is { } companyId
            ? await catalog.Companies.Where(c => c.Id == companyId).Select(c => c.Code).FirstOrDefaultAsync(cancellationToken)
            : null;
        var lines = order.QuoteJson is null ? null : JsonSerializer.Deserialize<List<QuoteLine>>(order.QuoteJson);
        PriceQuote? quote = order.Start == SignupStart.Paid && lines is not null
            ? new PriceQuote(order.PlanCode!, order.PlanCode!, order.Interval ?? BillingInterval.Month,
                new LicenceCounts(order.AndroidLicences, order.WindowsLicences, order.BothLicences),
                JsonSerializer.Deserialize<Dictionary<string, int>>(order.AddOnsJson ?? "{}") ?? new Dictionary<string, int>(),
                lines, lines.Sum(l => l.AmountMinor), order.AmountMinor - lines.Sum(l => l.AmountMinor), null, order.AmountMinor, order.Currency, null)
            : null;
        return new SignupResult(order.Id, null, order.Status, order.Start, quote, order.AmountMinor, order.Currency, order.ExpiresAt,
            TestPaymentsAllowed, code);
    }

    private async Task<SignupOrder> FindAsync(Guid orderId, string? token, CancellationToken cancellationToken)
    {
        var order = await catalog.SignupOrders.FirstOrDefaultAsync(o => o.Id == orderId, cancellationToken);
        // A wrong token looks exactly like a missing order.
        if (order is null || string.IsNullOrEmpty(token) || !CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(order.TokenHash), Encoding.ASCII.GetBytes(Hash(token))))
        {
            throw new NotFoundException("Order not found.");
        }
        return order;
    }

    private async Task FillBillingAccountAsync(Guid companyId, SignupOrder order, CancellationToken cancellationToken)
    {
        var account = await catalog.BillingAccounts.FirstOrDefaultAsync(b => b.CompanyId == companyId, cancellationToken);
        if (account is null) return;
        account.BillingName = order.BusinessName;
        account.BillingEmail = order.Email;
        account.BillingPhone = $"+91 {order.Mobile}";
        account.BillingAddress = $"{order.City}, {order.State}";
        account.Gstin = order.Gstin;
        account.StateCode = order.Gstin?[..2];
        account.UpdatedAt = DateTime.UtcNow;
        await catalog.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Trims and checks the business details; the messages are shown under the website's fields.</summary>
    public static SignupBusiness Clean(SignupBusiness? business)
    {
        if (business is null) throw new ValidationException("Enter your business details.");
        static string Text(string? value, string field, int min, int max)
        {
            var trimmed = Regex.Replace(value?.Trim() ?? string.Empty, @"\s+", " ");
            if (trimmed.Length < min || trimmed.Length > max) throw new ValidationException($"{field} must be {min} to {max} characters.");
            return trimmed;
        }

        var name = Text(business.Name, "Business name", 2, 150);
        var owner = Text(business.OwnerName, "Your name", 2, 150);
        var digits = new string((business.Mobile ?? string.Empty).Where(char.IsDigit).ToArray());
        if (digits.Length == 12 && digits.StartsWith("91")) digits = digits[2..];
        if (digits.Length == 11 && digits.StartsWith('0')) digits = digits[1..];
        if (digits.Length != 10 || digits[0] < '6') throw new ValidationException("Enter a 10-digit mobile number.");
        var email = (business.Email ?? string.Empty).Trim().ToLowerInvariant();
        if (email.Length > 150 || !EmailPattern().IsMatch(email)) throw new ValidationException("Enter a valid email address.");
        var city = Text(business.City, "City", 2, 80);
        var state = Text(business.State, "State", 2, 80);
        var gstin = string.IsNullOrWhiteSpace(business.Gstin) ? null : business.Gstin.Trim().ToUpperInvariant();
        if (gstin is not null && !GstinPattern().IsMatch(gstin)) throw new ValidationException("A GSTIN has 15 characters, like 33ABCDE1234F1Z5.");
        return new SignupBusiness(name, owner, digits, email, city, state, gstin);
    }

    private static string NewToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
}
