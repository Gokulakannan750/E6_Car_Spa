using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CarSpaManagement.Api.Infrastructure.BackgroundJobs;

/// <summary>
/// Sends queued WhatsApp messages. It works company by company: each company's messages are sent with that
/// company's own WhatsApp account, and one company's failure never stops the others.
/// </summary>
public class WhatsAppBackgroundWorker : BackgroundService
{
	private readonly IServiceProvider _serviceProvider;
	private readonly ILogger<WhatsAppBackgroundWorker> _logger;
	private readonly TimeSpan _period = TimeSpan.FromSeconds(5);
	private readonly TimeSpan _healthProbeInterval = TimeSpan.FromHours(1);
	private readonly Dictionary<Guid, DateTime> _lastHealthProbeUtc = new();

	public WhatsAppBackgroundWorker(
		IServiceProvider serviceProvider,
		ILogger<WhatsAppBackgroundWorker> logger)
	{
		_serviceProvider = serviceProvider;
		_logger = logger;
	}

	protected override async Task ExecuteAsync(CancellationToken stoppingToken)
	{
		_logger.LogInformation("WhatsAppBackgroundWorker started.");

		using var timer = new PeriodicTimer(_period);
		while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
		{
			try
			{
				await ProcessAllCompaniesAsync(stoppingToken);
			}
			catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
			{
				_logger.LogError(ex, "Error processing WhatsApp background queue.");
			}
		}

		_logger.LogInformation("WhatsAppBackgroundWorker stopped.");
	}

	private async Task ProcessAllCompaniesAsync(CancellationToken stoppingToken)
	{
		var scopeFactory = _serviceProvider.GetRequiredService<IServiceScopeFactory>();

		List<Guid> organizationIds;
		using (var listScope = scopeFactory.CreateScope())
		{
			var db = listScope.ServiceProvider.GetRequiredService<AppDbContext>();
			organizationIds = await db.Organizations.Where(o => o.IsActive).Select(o => o.Id).ToListAsync(stoppingToken);
		}

		foreach (var organizationId in organizationIds)
		{
			if (stoppingToken.IsCancellationRequested) break;

			try
			{
				using var scope = scopeFactory.CreateTenantScope(organizationId);
				var whatsAppService = scope.ServiceProvider.GetRequiredService<IWhatsAppService>();

				// 1. Process this company's queued messages
				await whatsAppService.ProcessPendingMessagesAsync(stoppingToken);

				// 2. Throttled periodic health probe (every hour, per company)
				var lastProbe = _lastHealthProbeUtc.GetValueOrDefault(organizationId, DateTime.MinValue);
				if (DateTime.UtcNow - lastProbe >= _healthProbeInterval)
				{
					_lastHealthProbeUtc[organizationId] = DateTime.UtcNow;
					try
					{
						await whatsAppService.ProbeHealthAsync(stoppingToken);
					}
					catch (Exception probeEx) when (!stoppingToken.IsCancellationRequested)
					{
						_logger.LogWarning(probeEx, "WhatsApp background health probe failed for company {OrganizationId}.", organizationId);
					}
				}
			}
			catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
			{
				_logger.LogError(ex, "Error processing the WhatsApp queue for company {OrganizationId}.", organizationId);
			}
		}
	}
}
