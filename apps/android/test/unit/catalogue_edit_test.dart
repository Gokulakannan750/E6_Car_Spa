import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/catalogue/models/service_model.dart';

void main() {
  group('Catalogue Service Edit Tests', () {
    test('UpdateServiceRequest serializes correctly', () {
      const request = UpdateServiceRequest(
        name: 'Express Detailing Pro',
        description: 'Deep exterior cleansing',
        category: 'Exterior Detailing',
        price: 1200.0,
        taxPercentage: 18.0,
        durationMinutes: 90,
        isActive: true,
      );

      final json = request.toJson();

      expect(json['name'], 'Express Detailing Pro');
      expect(json['description'], 'Deep exterior cleansing');
      expect(json['category'], 'Exterior Detailing');
      expect(json['price'], 1200.0);
      expect(json['taxPercentage'], 18.0);
      expect(json['durationMinutes'], 90);
      expect(json['isActive'], true);
    });

    test('UpdateServiceRequest handles optional description and duration', () {
      const request = UpdateServiceRequest(
        name: 'Basic Wash',
        price: 300.0,
        isActive: false,
      );

      final json = request.toJson();

      expect(json['name'], 'Basic Wash');
      expect(json.containsKey('description'), isFalse);
      expect(json.containsKey('durationMinutes'), isFalse);
      expect(json['price'], 300.0);
      expect(json['isActive'], false);
    });
  });
}
