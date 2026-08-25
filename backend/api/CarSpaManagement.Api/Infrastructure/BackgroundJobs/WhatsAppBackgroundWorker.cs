using CarSpaManagement.Api.Application.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CarSpaManagement.Api.Infrastructure.BackgroundJobs;

public class WhatsAppBackgroundWorker : BackgroundService
{
	private readonly IServiceProvider _serviceProvider;
	private readonly ILogger<WhatsAppBackgroundWorker> _logger;
	private readonly TimeSpan _period = TimeSpan.FromSeconds(5);

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
				using var scope = _serviceProvider.CreateScope();
				var whatsAppService = scope.ServiceProvider.GetRequiredService<IWhatsAppService>();
				await whatsAppService.ProcessPendingMessagesAsync(stoppingToken);
			}
			catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
			{
				_logger.LogError(ex, "Error processing WhatsApp background queue.");
			}
		}

		_logger.LogInformation("WhatsAppBackgroundWorker stopped.");
	}
}
