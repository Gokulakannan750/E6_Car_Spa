import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/catalogue/models/service_model.dart';

void main() {
  group('Service Models Unit Tests', () {
    test('Service parses from backend JSON correctly', () {
      final json = {
        'id': 'svc-1',
        'name': 'Premium Foam Wash',
        'description': 'Full foam wash and interior vacuuming',
        'price': 650.0,
        'category': 'Washing',
        'isActive': true,
        'taxPercentage': 18.0,
      };

      final service = Service.fromJson(json);

      expect(service.id, 'svc-1');
      expect(service.name, 'Premium Foam Wash');
      expect(service.price, 650.0);
      expect(service.category, 'Washing');
      expect(service.isActive, true);
      expect(service.taxPercentage, 18.0);
    });

    test('ServiceListResponse parses paged catalogue correctly', () {
      final json = {
        'items': [
          {
            'id': 'svc-1',
            'name': 'Service 1',
            'price': 100.0,
            'isActive': true,
          },
          {
            'id': 'svc-2',
            'name': 'Service 2',
            'price': 200.0,
            'isActive': true,
          },
        ],
        'totalCount': 2,
        'pageNumber': 1,
        'pageSize': 50,
      };

      final response = ServiceListResponse.fromJson(json);

      expect(response.items.length, 2);
      expect(response.totalCount, 2);
      expect(response.items[1].name, 'Service 2');
    });
  });
}
