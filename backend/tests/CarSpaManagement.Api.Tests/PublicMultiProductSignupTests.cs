using System.Net;
using System.Text.Json;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class PublicMultiProductSignupTests
{
    private static async Task<JsonElement> Read(HttpResponseMessage response, HttpStatusCode status)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == status, $"Expected {status}, got {response.StatusCode}: {text}");
        return JsonDocument.Parse(text).RootElement;
    }
    private static object Choice(string plan, bool demo) => new { planCode = plan, interval = "Month",
        seats = demo ? new Dictionary<string,int>() : new Dictionary<string,int> { ["both"] = 1 }, addOns = new { } };
    private static object Signup(object choice, bool trial = false) => new { business = new {
        name = "Public isolation", ownerName = "Owner", mobile = "9876543210", email = "isolation@public.test", city = "Erode", state = "Tamil Nadu" },
        startTrial = trial, plan = choice, acceptTerms = true };

    [ExternalProductFact(true)]
    public async Task PublicCatalogAndOrders_AreIsolatedInBothDirections_AndKeepLegacyFields()
    {
        await using var host = new PlatformApiHost(ExternalProductTestScript.Configure);
        await host.InitializeAsync();
        var products = await Read(await host.SendAsync(HttpMethod.Get, "/api/public/products", null), HttpStatusCode.OK);
        Assert.Equal(2, products.GetArrayLength());
        foreach (var product in products.EnumerateArray())
            Assert.Equal(new[] { "capabilities", "key", "learnMoreUrl", "name", "publicDescription", "publicTagline", "seatModel", "startingPrice" }, product.EnumerateObject().Select(p => p.Name).Order().ToArray());

        var demoProduct = products.EnumerateArray().Single(p => p.GetProperty("key").GetString() == "demo");
        var carspaProduct = products.EnumerateArray().Single(p => p.GetProperty("key").GetString() == host.ProductKey);

        var demoStarting = demoProduct.GetProperty("startingPrice");
        Assert.Equal(1234, demoStarting.GetProperty("amountMinor").GetInt64());
        Assert.Equal("Month", demoStarting.GetProperty("interval").GetString());
        Assert.Equal("INR", demoStarting.GetProperty("currency").GetString());
        Assert.False(demoStarting.GetProperty("perSeat").GetBoolean());

        var carspaStarting = carspaProduct.GetProperty("startingPrice");
        Assert.Equal(49900, carspaStarting.GetProperty("amountMinor").GetInt64());
        Assert.Equal("Month", carspaStarting.GetProperty("interval").GetString());
        Assert.Equal("INR", carspaStarting.GetProperty("currency").GetString());
        Assert.True(carspaStarting.GetProperty("perSeat").GetBoolean());

        foreach (var demo in new[] { false, true })
        {
            var key = demo ? "demo" : host.ProductKey;
            var other = demo ? host.ProductKey : "demo";
            var plan = demo ? "demo_trial" : "starter";
            var choice = Choice(plan, demo);
            var catalog = await Read(await host.SendAsync(HttpMethod.Get, $"/api/public/catalog?product={key}", null), HttpStatusCode.OK);
            Assert.Equal(key, catalog.GetProperty("productKey").GetString());
            Assert.Equal(demo ? "None" : "PerType", catalog.GetProperty("seatModel").GetString());
            Assert.Equal(demo ? 0 : 3, catalog.GetProperty("seatTypes").GetArrayLength());
            Assert.Equal(demo ? 0 : 1, catalog.GetProperty("seatTypes").EnumerateArray().Count(s => s.GetProperty("defaultSeat").GetBoolean()));
            Assert.Equal(!demo, catalog.GetProperty("capabilities").EnumerateArray().Any(c => c.GetString() == "franchise"));
            Assert.Contains(catalog.GetProperty("features").EnumerateArray(), f => !string.IsNullOrEmpty(f.GetProperty("label").GetString()));
            Assert.DoesNotContain(catalog.GetProperty("plans").EnumerateArray(), p => p.GetProperty("code").GetString() == (demo ? "starter" : "demo_trial"));
            Assert.True(catalog.GetProperty("plans")[0].GetProperty("monthly").TryGetProperty("bothUserPriceMinor", out _));
            var quote = await Read(await host.SendAsync(HttpMethod.Post, $"/api/public/signup/quote?product={key}", null, choice), HttpStatusCode.OK);
            Assert.Equal(demo ? 1234 : 99900, quote.GetProperty("totalMinor").GetInt64());
            Assert.True(quote.TryGetProperty("licences", out _));
            Assert.Equal(HttpStatusCode.BadRequest, (await host.SendAsync(HttpMethod.Post, $"/api/public/signup/quote?product={other}", null, choice)).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await host.SendAsync(HttpMethod.Post, $"/api/public/signup?product={other}", null, Signup(choice))).StatusCode);
            var order = await Read(await host.SendAsync(HttpMethod.Post, $"/api/public/signup?product={key}", null, Signup(choice)), HttpStatusCode.Created);
            var id = order.GetProperty("orderId").GetGuid();
            var token = new { token = order.GetProperty("orderToken").GetString() };
            foreach (var action in new[] { "status", "test-payment" })
                Assert.Equal(HttpStatusCode.NotFound, (await host.SendAsync(HttpMethod.Post, $"/api/public/signup/{id}/{action}?product={other}", null, token)).StatusCode);
            var state = await Read(await host.SendAsync(HttpMethod.Post, $"/api/public/signup/{id}/status?product={key}", null, token), HttpStatusCode.OK);
            Assert.Equal("AwaitingPayment", state.GetProperty("status").GetString());
            var paid = await Read(await host.SendAsync(HttpMethod.Post, $"/api/public/signup/{id}/test-payment?product={key}", null, token), HttpStatusCode.OK);
            Assert.Equal("Completed", paid.GetProperty("status").GetString());
            await host.InScopeAsync(async sp => {
                var db = sp.GetRequiredService<PlatformDbContext>();
                var saved = await db.SignupOrders.SingleAsync(o => o.Id == id);
                Assert.Equal(key, await db.Products.Where(p => p.Id == saved.ProductId).Select(p => p.Key).SingleAsync());
                var company = await db.Companies.SingleAsync(c => c.Id == saved.CompanyId);
                Assert.Equal(saved.ProductId, company.ProductId);
                return true;
            });
        }
    }

    [ExternalProductFact(true)]
    public async Task UnknownAndInactiveProducts_RejectEveryPublicOperation_WithoutCreatingOrders()
    {
        await using var host = new PlatformApiHost(ExternalProductTestScript.Configure);
        await host.InitializeAsync();
        var choice = Choice("demo_trial", true);
        var placed = await Read(await host.SendAsync(HttpMethod.Post, "/api/public/signup?product=demo", null, Signup(choice)), HttpStatusCode.Created);
        var id = placed.GetProperty("orderId").GetGuid();
        var token = new { token = placed.GetProperty("orderToken").GetString() };
        await host.InScopeAsync(async sp => {
            var db = sp.GetRequiredService<PlatformDbContext>();
            (await db.Products.SingleAsync(p => p.Key == "demo")).IsActive = false;
            return await db.SaveChangesAsync();
        });
        foreach (var key in new[] { "unknown", "demo" })
        {
            var operations = new (HttpMethod Method, string Path, object? Body)[] {
                (HttpMethod.Get, "catalog", null), (HttpMethod.Post, "signup/quote", choice),
                (HttpMethod.Post, "signup", Signup(choice)), (HttpMethod.Post, "signup", Signup(choice, true)),
                (HttpMethod.Post, "signup/franchise-code", new { code = "AAAA-BBBB-CCCC" }),
                (HttpMethod.Post, $"signup/{id}/status", token), (HttpMethod.Post, $"signup/{id}/test-payment", token) };
            foreach (var op in operations)
            {
                var response = await host.SendAsync(op.Method, $"/api/public/{op.Path}?product={key}", null, op.Body);
                Assert.InRange((int)response.StatusCode, 400, 499);
            }
        }
        var listing = await Read(await host.SendAsync(HttpMethod.Get, "/api/public/products", null), HttpStatusCode.OK);
        Assert.Equal(host.ProductKey, Assert.Single(listing.EnumerateArray()).GetProperty("key").GetString());
        await host.InScopeAsync(async sp => {
            var db = sp.GetRequiredService<PlatformDbContext>();
            Assert.Equal(1, await db.SignupOrders.CountAsync());
            Assert.Equal(SignupStatus.AwaitingPayment, (await db.SignupOrders.SingleAsync()).Status);
            Assert.Equal(0, await db.Companies.CountAsync()); return true;
        });
    }
}
