using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class AesEncryptionServiceTests
{
    [Fact]
    public void ValidateOptions_WithValidProductionKey_Succeeds()
    {
        var options = new WhatsAppOptions
        {
            EncryptionKey = "a_very_secure_whatsapp_encryption_key_32_bytes_len!"
        };

        WhatsAppOptions.Validate(options, isProduction: true);
        WhatsAppOptions.Validate(options, isProduction: false);
    }

    [Fact]
    public void ValidateOptions_WithMissingKeyInProduction_ThrowsInvalidOperationException()
    {
        var options = new WhatsAppOptions { EncryptionKey = "" };

        var ex = Assert.Throws<InvalidOperationException>(() => WhatsAppOptions.Validate(options, isProduction: true));
        Assert.Contains("WhatsApp Encryption Key is not configured", ex.Message);
    }

    [Theory]
    [InlineData("short")]
    [InlineData("1234567890123456")] // 16 chars
    [InlineData("1234567890123456789012345678901")] // 31 chars
    public void ValidateOptions_WithShortKey_ThrowsInvalidOperationException(string shortKey)
    {
        var options = new WhatsAppOptions { EncryptionKey = shortKey };

        var ex = Assert.Throws<InvalidOperationException>(() => WhatsAppOptions.Validate(options, isProduction: false));
        Assert.Contains("at least 32 characters", ex.Message);
    }

    [Theory]
    [InlineData("CHANGE_ME_IN_PRODUCTION_SUPPLIED_EXTERNALLY")]
    [InlineData("YOUR_WHATSAPP_KEY_SHOULD_BE_PUT_HERE_NOW!")]
    [InlineData("[REDACTED_WHATSAPP_ENCRYPTION_KEY_STRING]")]
    public void ValidateOptions_WithPlaceholderInProduction_ThrowsInvalidOperationException(string placeholderKey)
    {
        var options = new WhatsAppOptions { EncryptionKey = placeholderKey };

        var ex = Assert.Throws<InvalidOperationException>(() => WhatsAppOptions.Validate(options, isProduction: true));
        Assert.Contains("placeholder", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void EncryptAndDecrypt_WithValidKey_ReturnsOriginalPlainText()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["WhatsApp:EncryptionKey"] = "whatsapp_secure_enc_key_32_bytes_len!"
            })
            .Build();

        var service = new AesEncryptionService(config);
        var plainText = "EAAB1234567890SecretMetaAccessToken";

        var encrypted = service.Encrypt(plainText);
        Assert.NotNull(encrypted);
        Assert.NotEqual(plainText, encrypted);

        var decrypted = service.Decrypt(encrypted);
        Assert.Equal(plainText, decrypted);
    }

    [Fact]
    public void Service_WithExactly32CharacterKey_Succeeds()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["WhatsApp:EncryptionKey"] = "12345678901234567890123456789012" // exactly 32 chars
            })
            .Build();

        var service = new AesEncryptionService(config);
        var encrypted = service.Encrypt("TestPayload");
        var decrypted = service.Decrypt(encrypted);

        Assert.Equal("TestPayload", decrypted);
    }

    [Fact]
    public void Service_WithMissingKey_ThrowsInvalidOperationException()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var ex = Assert.Throws<InvalidOperationException>(() => new AesEncryptionService(config));
        Assert.Contains("WhatsApp encryption key is not configured", ex.Message);
    }

    [Theory]
    [InlineData("short")]
    [InlineData("1234567890123456")] // 16 chars
    [InlineData("1234567890123456789012345678901")] // 31 chars
    public void Service_WithUnder32CharacterKey_ThrowsInvalidOperationException(string shortKey)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["WhatsApp:EncryptionKey"] = shortKey
            })
            .Build();

        var ex = Assert.Throws<InvalidOperationException>(() => new AesEncryptionService(config));
        Assert.Contains("at least 32 characters", ex.Message);
    }

    [Fact]
    public void Service_DoesNotFallBackToJwtKey_WhenWhatsAppKeyMissing()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "jwt_signing_key_that_should_never_be_used_for_whatsapp_32_bytes"
            })
            .Build();

        // Must throw because WhatsApp:EncryptionKey is missing, NOT silently use Jwt:Key
        var ex = Assert.Throws<InvalidOperationException>(() => new AesEncryptionService(config));
        Assert.Contains("WhatsApp encryption key is not configured", ex.Message);
    }

    [Fact]
    public void Decrypt_WithInvalidCipher_ReturnsNull()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["WhatsApp:EncryptionKey"] = "whatsapp_secure_enc_key_32_bytes_len!"
            })
            .Build();

        var service = new AesEncryptionService(config);
        var invalidCipher = "NotAValidBase64CipherDataString";

        var result = service.Decrypt(invalidCipher);
        Assert.Null(result);
    }
}
