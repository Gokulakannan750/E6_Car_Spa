using System.Security.Cryptography;
using System.Text;
using CarSpaManagement.Api.Application.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace CarSpaManagement.Api.Infrastructure.Security;

public class AesEncryptionService : IAesEncryptionService
{
	private readonly byte[] _key;

	public AesEncryptionService(IOptions<WhatsAppOptions> options, IConfiguration? configuration = null)
	{
		var keyString = Environment.GetEnvironmentVariable("WHATSAPP_ENCRYPTION_KEY")
			?? options?.Value?.EncryptionKey
			?? configuration?["WhatsApp:EncryptionKey"];

		if (string.IsNullOrWhiteSpace(keyString))
		{
			throw new InvalidOperationException(
				"WhatsApp encryption key is not configured. Supply 'WhatsApp:EncryptionKey' or environment variable 'WHATSAPP_ENCRYPTION_KEY'.");
		}

		if (keyString.Length < 32)
		{
			throw new InvalidOperationException("WhatsApp encryption key must be at least 32 characters long for AES-256-GCM security.");
		}

		// Derive a fixed 256-bit (32-byte) key using SHA-256
		_key = SHA256.HashData(Encoding.UTF8.GetBytes(keyString));
	}

	public AesEncryptionService(IConfiguration configuration)
		: this(Options.Create(new WhatsAppOptions { EncryptionKey = configuration["WhatsApp:EncryptionKey"] ?? string.Empty }), configuration)
	{
	}

	public string? Encrypt(string? plainText)
	{
		if (string.IsNullOrEmpty(plainText)) return null;

		var plainBytes = Encoding.UTF8.GetBytes(plainText);
		var nonce = new byte[AesGcm.NonceByteSizes.MaxSize]; // 12 bytes
		RandomNumberGenerator.Fill(nonce);

		var tag = new byte[AesGcm.TagByteSizes.MaxSize]; // 16 bytes
		var cipherBytes = new byte[plainBytes.Length];

		using var aesGcm = new AesGcm(_key, AesGcm.TagByteSizes.MaxSize);
		aesGcm.Encrypt(nonce, plainBytes, cipherBytes, tag);

		// Output layout: [12-byte Nonce][16-byte Tag][CipherBytes]
		var combined = new byte[nonce.Length + tag.Length + cipherBytes.Length];
		Buffer.BlockCopy(nonce, 0, combined, 0, nonce.Length);
		Buffer.BlockCopy(tag, 0, combined, nonce.Length, tag.Length);
		Buffer.BlockCopy(cipherBytes, 0, combined, nonce.Length + tag.Length, cipherBytes.Length);

		return Convert.ToBase64String(combined);
	}

	public string? Decrypt(string? cipherText)
	{
		if (string.IsNullOrEmpty(cipherText)) return null;

		try
		{
			var combined = Convert.FromBase64String(cipherText);
			var nonceSize = AesGcm.NonceByteSizes.MaxSize;
			var tagSize = AesGcm.TagByteSizes.MaxSize;

			if (combined.Length < nonceSize + tagSize)
			{
				return null;
			}

			var nonce = new byte[nonceSize];
			var tag = new byte[tagSize];
			var cipherLength = combined.Length - nonceSize - tagSize;
			var cipherBytes = new byte[cipherLength];

			Buffer.BlockCopy(combined, 0, nonce, 0, nonceSize);
			Buffer.BlockCopy(combined, nonceSize, tag, 0, tagSize);
			Buffer.BlockCopy(combined, nonceSize + tagSize, cipherBytes, 0, cipherLength);

			var plainBytes = new byte[cipherLength];
			using var aesGcm = new AesGcm(_key, tagSize);
			aesGcm.Decrypt(nonce, cipherBytes, tag, plainBytes);

			return Encoding.UTF8.GetString(plainBytes);
		}
		catch
		{
			return null;
		}
	}
}
