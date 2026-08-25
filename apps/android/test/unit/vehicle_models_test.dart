import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/vehicles/models/vehicle_model.dart';

void main() {
  group('Vehicle Models Unit Tests', () {
    test('Vehicle parses from backend JSON correctly', () {
      final json = {
        'id': 'veh-123',
        'registrationNumber': 'TN01AB1234',
        'make': 'Hyundai',
        'model': 'Creta',
        'variant': 'SX(O)',
        'color': 'Polar White',
        'customerId': 'cust-123',
        'customerName': 'Ramesh Kumar',
        'customerPhone': '9876543210',
        'jobCardCount': 3,
        'createdAt': '2026-08-25T10:00:00Z',
      };

      final vehicle = Vehicle.fromJson(json);

      expect(vehicle.id, 'veh-123');
      expect(vehicle.registrationNumber, 'TN01AB1234');
      expect(vehicle.make, 'Hyundai');
      expect(vehicle.model, 'Creta');
      expect(vehicle.variant, 'SX(O)');
      expect(vehicle.color, 'Polar White');
      expect(vehicle.customerId, 'cust-123');
      expect(vehicle.displayName, 'Hyundai Creta (SX(O))');
    });

    test('Vehicle displayName handles missing variant', () {
      const v = Vehicle(
        id: '1',
        registrationNumber: 'KA01CD5678',
        make: 'Honda',
        model: 'City',
        customerId: 'c-1',
      );

      expect(v.displayName, 'Honda City');
    });

    test('CreateVehicleRequest serializes to backend JSON', () {
      const req = CreateVehicleRequest(
        registrationNumber: 'TN01AB1234',
        make: 'Hyundai',
        model: 'Creta',
        variant: 'SX(O)',
        color: 'White',
        customerId: 'cust-123',
      );

      final json = req.toJson();
      expect(json['registrationNumber'], 'TN01AB1234');
      expect(json['make'], 'Hyundai');
      expect(json['model'], 'Creta');
      expect(json['customerId'], 'cust-123');
    });
  });
}
