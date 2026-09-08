using CarSpaManagement.Api.Domain.Entities;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IInvoicePdfGenerator
{
	byte[] GenerateInvoicePdf(Invoice invoice, BusinessProfile? businessProfile = null);
}
