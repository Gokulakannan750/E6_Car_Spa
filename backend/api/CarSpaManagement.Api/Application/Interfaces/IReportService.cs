using CarSpaManagement.Api.Application.DTOs.Reports;
using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IReportService
{
    Task<DashboardSummaryDto> GetDashboardSummaryAsync(DateTime? fromDate = null, DateTime? toDate = null, CancellationToken ct = default);
    Task<SalesReportResponse> GetSalesReportAsync(DateTime? fromDate = null, DateTime? toDate = null, Guid? customerId = null, int page = 1, int pageSize = 20, CancellationToken ct = default);
    Task<PaymentReportResponse> GetPaymentCollectionReportAsync(DateTime? fromDate = null, DateTime? toDate = null, PaymentMethod? paymentMethod = null, Guid? invoiceId = null, bool includeVoided = false, int page = 1, int pageSize = 20, CancellationToken ct = default);
    Task<OutstandingInvoiceReportResponse> GetOutstandingInvoicesReportAsync(DateTime? fromDate = null, DateTime? toDate = null, Guid? customerId = null, int page = 1, int pageSize = 20, CancellationToken ct = default);
    Task<GstReportDto> GetGstReportAsync(DateTime? fromDate = null, DateTime? toDate = null, CancellationToken ct = default);
    Task<JobCardReportResponse> GetJobCardReportAsync(DateTime? fromDate = null, DateTime? toDate = null, JobCardStatus? status = null, Guid? customerId = null, int page = 1, int pageSize = 20, CancellationToken ct = default);
    Task<ShowroomReportResponse> GetShowroomReportAsync(DateTime? fromDate = null, DateTime? toDate = null, Guid? showroomId = null, int page = 1, int pageSize = 20, CancellationToken ct = default);
    Task<StaffProductivityReportResponse> GetStaffProductivityReportAsync(DateTime? fromDate = null, DateTime? toDate = null, Guid? staffId = null, Guid? showroomId = null, CancellationToken ct = default);
    Task<StaffAdvanceReportResponse> GetStaffAdvancesReportAsync(DateTime? fromDate = null, DateTime? toDate = null, Guid? staffId = null, StaffAdvanceStatus? status = null, int page = 1, int pageSize = 20, CancellationToken ct = default);
}
