class AppRoutes {
  static const String login = '/login';
  static const String firstTimeSetup = '/setup';
  static const String forgotPassword = '/forgot-password';
  static const String home = '/';
  static const String dashboard = '/dashboard';
  static const String billing = '/billing';
  static const String billingCustomers = '/billing/customers';
  static const String billingJobCards = '/billing/job-cards';
  static const String billingInvoices = '/billing/invoices';
  static const String billingCatalogue = '/billing/catalogue';
  static const String billingServices = '/billing/services';
  static const String customers = '/customers';

  static const List<String> billingRoutes = [
    customers,
    jobCards,
    quotationsInvoices,
    catalogue,
  ];

  static String? billingRouteFor(String location) {
    if (location.startsWith(customers) ||
        location.startsWith(billingCustomers)) {
      return customers;
    }
    if (location.startsWith(jobCards) || location.startsWith(billingJobCards)) {
      return jobCards;
    }
    if (location.startsWith(quotationsInvoices) ||
        location.startsWith(billingInvoices) ||
        location.startsWith('/invoices')) {
      return quotationsInvoices;
    }
    if (location.startsWith(catalogue) ||
        location.startsWith(billingCatalogue) ||
        location.startsWith(billingServices)) {
      return catalogue;
    }
    return null;
  }

  static const String customerDetail = '/customers/:id';
  static const String jobCards = '/job-cards';
  static const String newJobCard = '/job-cards/new';
  static const String jobCardDetail = '/job-cards/:id';
  static const String quotationsInvoices = '/quotations-invoices';
  static const String invoiceDetail = '/quotations-invoices/:id';
  static const String catalogue = '/catalogue';
  static const String staff = '/staff';
  static const String staffAttendance = '/staff/attendance';
  static const String staffAdvancesTab = '/staff/advances';
  static const String staffMonthlyReport = '/staff/monthly-report';
  static const String staffSalary = '/staff/salary';
  static const String staffAdvances = '/staff-advances';
  static const String reports = '/reports';
  static const String billingReport = '/reports/billing';
  static const String outsideJobsReport = '/reports/outside-jobs';
  static const String staffReport = '/reports/staff';
  static const String salesReport = '/reports/sales';
  static const String paymentsReport = '/reports/payments';
  static const String outstandingInvoices = '/reports/outstanding';
  static const String gstReport = '/reports/gst';
  static const String jobCardsReport = '/reports/job-cards';
  static const String showroomReport = '/reports/showrooms';
  static const String showroomReportCanonical = '/reports/showroom';
  static const String staffProductivityReport = '/reports/staff-productivity';
  static const String staffAdvancesReport = '/reports/staff-advances';
  static const String showroom = '/showroom';
  static const String settings = '/settings';
  static const String companySettings = '/settings/company';
  static const String users = '/settings/users';
  static const String systemPreferences = '/settings/preferences';
}
