import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/config/routes.dart';

void main() {
  group('Task 4 — Audit Trail Removal Verification', () {
    test('Billing top-tab routes exclude audit and non-billing modules', () {
      expect(AppRoutes.billingRoutes, [
        AppRoutes.customers,
        AppRoutes.jobCards,
        AppRoutes.quotationsInvoices,
        AppRoutes.catalogue,
      ]);
      expect(AppRoutes.billingRouteFor('/audit'), isNull);
      expect(AppRoutes.billingRouteFor('/showroom'), isNull);
      expect(AppRoutes.billingRouteFor('/settings'), isNull);
    });
  });
}
