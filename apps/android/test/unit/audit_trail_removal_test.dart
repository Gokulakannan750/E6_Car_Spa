import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/config/routes.dart';

void main() {
  group('Task 4 — Audit Trail Removal Verification', () {
    test('AppRoutes does not expose an audit route and getNavIndex does not map audit', () {
      // getNavIndex for undefined / removed audit route should return 0 (default home)
      expect(AppRoutes.getNavIndex('/audit'), 0);
      expect(AppRoutes.getNavIndex('/dashboard'), 0);
      expect(AppRoutes.getNavIndex('/customers'), 1);
      expect(AppRoutes.getNavIndex('/job-cards'), 2);
      expect(AppRoutes.getNavIndex('/quotations-invoices'), 3);
      expect(AppRoutes.getNavIndex('/catalogue'), 4);
      expect(AppRoutes.getNavIndex('/showroom'), 5);
      expect(AppRoutes.getNavIndex('/settings'), 5);
    });
  });
}
