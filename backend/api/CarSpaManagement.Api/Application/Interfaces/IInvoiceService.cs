using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IInvoiceService
{
 Task<IReadOnlyList<InvoiceListDto>> GetAllAsync(int page, int pageSize, string? search = null, InvoiceStatus? status = null, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default);
 Task<int> GetTotalCountAsync(string? search = null, InvoiceStatus? status = null, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default);
 Task<InvoiceDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
 Task<InvoiceDto?> GetByNumberAsync(string invoiceNumber, CancellationToken cancellationToken = default);
 Task<InvoiceDto> CreateFromJobCardAsync(CreateInvoiceFromJobCardRequest request, CancellationToken cancellationToken = default);
 Task<InvoiceDto?> UpdateAsync(Guid id, UpdateInvoiceRequest request, CancellationToken cancellationToken = default);
 Task<InvoiceDto> GenerateInvoiceAsync(Guid id, CancellationToken cancellationToken = default);
 Task<PaymentDto> RecordPaymentAsync(Guid invoiceId, RecordPaymentRequest request, CancellationToken cancellationToken = default);
 Task<IReadOnlyList<PaymentDto>> GetPaymentsByInvoiceIdAsync(Guid invoiceId, CancellationToken cancellationToken = default);
}
