import 'package:flutter/material.dart';

class AppRoutes {
  static const String login = '/login';
  static const String forgotPassword = '/forgot-password';
  static const String home = '/';
  static const String dashboard = '/dashboard';
  static const String customers = '/customers';
  static const String customerDetail = '/customers/:id';
  static const String jobCards = '/job-cards';
  static const String newJobCard = '/job-cards/new';
  static const String jobCardDetail = '/job-cards/:id';
  static const String quotationsInvoices = '/quotations-invoices';
  static const String invoiceDetail = '/quotations-invoices/:id';
  static const String catalogue = '/catalogue';
  static const String staffAdvances = '/staff-advances';
  static const String reports = '/reports';
  static const String salesReport = '/reports/sales';
  static const String paymentsReport = '/reports/payments';
  static const String outstandingInvoices = '/reports/outstanding';
  static const String gstReport = '/reports/gst';
  static const String jobCardsReport = '/reports/job-cards';
  static const String showroomReport = '/reports/showrooms';
  static const String staffProductivityReport = '/reports/staff-productivity';
  static const String staffAdvancesReport = '/reports/staff-advances';
  static const String showroom = '/showroom';
  static const String settings = '/settings';
  static const String users = '/settings/users';
  static const String audit = '/audit';

  static const List<BottomNavigationBarItem> bottomNavItems = [
    BottomNavigationBarItem(
      icon: Icon(Icons.dashboard_outlined),
      activeIcon: Icon(Icons.dashboard_rounded),
      label: 'Dashboard',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.people_outline_rounded),
      activeIcon: Icon(Icons.people_rounded),
      label: 'Customers',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.assignment_outlined),
      activeIcon: Icon(Icons.assignment_rounded),
      label: 'Job Cards',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.receipt_long_outlined),
      activeIcon: Icon(Icons.receipt_long_rounded),
      label: 'Invoices',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.inventory_2_outlined),
      activeIcon: Icon(Icons.inventory_2_rounded),
      label: 'Catalogue',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.more_horiz_rounded),
      activeIcon: Icon(Icons.more_horiz_rounded),
      label: 'More',
    ),
  ];

  static int getNavIndex(String location) {
    if (location.startsWith('/dashboard')) return 0;
    if (location.startsWith('/customers')) return 1;
    if (location.startsWith('/job-cards')) return 2;
    if (location.startsWith('/quotations-invoices') || location.startsWith('/invoices')) return 3;
    if (location.startsWith('/catalogue')) return 4;
    if (location.startsWith('/staff-advances') ||
        location.startsWith('/reports') ||
        location.startsWith('/showroom') ||
        location.startsWith('/settings') ||
        location.startsWith('/audit')) {
      return 5;
    }
    return 0;
  }
}
