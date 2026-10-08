namespace CarSpaManagement.Api.Domain.Enums;

/// <summary>
/// The kind of business a company runs. It decides which set of features (modules) the company gets, and it is the
/// first two digits of the company code (for example car spa = 01, so the first car spa is "01-0001").
/// Add a new value here only when that kind of business actually has its own modules.
/// </summary>
public enum BusinessType
{
    CarSpa = 1,
}
