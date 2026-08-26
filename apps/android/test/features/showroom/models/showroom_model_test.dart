import 'package:e6_car_spa/features/showroom/models/showroom_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Showroom Model Tests', () {
    test('fromJson and toJson round-trip preserves all fields', () {
      final json = {
        'id': 'a1b2c3d4-0000-0000-0000-000000000001',
        'name': 'Anna Nagar Hub',
        'address': 'Plot 10, 2nd Avenue, Anna Nagar, Chennai',
        'phone': '9840154321',
        'isActive': true,
        'activeStaffCountToday': 4,
        'totalVehiclesToday': 12,
        'createdAt': '2026-08-26T10:00:00.000',
        'updatedAt': '2026-08-26T10:30:00.000',
      };

      final showroom = Showroom.fromJson(json);

      expect(showroom.id, 'a1b2c3d4-0000-0000-0000-000000000001');
      expect(showroom.name, 'Anna Nagar Hub');
      expect(showroom.address, 'Plot 10, 2nd Avenue, Anna Nagar, Chennai');
      expect(showroom.phone, '9840154321');
      expect(showroom.isActive, true);
      expect(showroom.activeStaffCountToday, 4);
      expect(showroom.totalVehiclesToday, 12);
      expect(showroom.initials, 'AN');

      final serialized = showroom.toJson();
      expect(serialized['id'], showroom.id);
      expect(serialized['name'], showroom.name);
      expect(serialized['address'], showroom.address);
      expect(serialized['phone'], showroom.phone);
      expect(serialized['isActive'], showroom.isActive);
      expect(serialized['activeStaffCountToday'], 4);
      expect(serialized['totalVehiclesToday'], 12);
    });

    test('initials computation handles single-word and multi-word names', () {
      final s1 = Showroom(
        id: '1',
        name: 'Velachery',
        address: 'Main Rd',
        createdAt: DateTime(2026, 8, 26),
      );
      expect(s1.initials, 'VE');

      final s2 = Showroom(
        id: '2',
        name: 'E6 Car Spa OMR',
        address: 'OMR Rd',
        createdAt: DateTime(2026, 8, 26),
      );
      expect(s2.initials, 'EC');
    });

    test('CreateShowroomRequest serializes accurately', () {
      const req = CreateShowroomRequest(
        name: 'Tambaram Hub',
        address: 'GST Road, Tambaram',
        phone: '9840112233',
        isActive: true,
      );

      final json = req.toJson();
      expect(json['name'], 'Tambaram Hub');
      expect(json['address'], 'GST Road, Tambaram');
      expect(json['phone'], '9840112233');
      expect(json['isActive'], true);
    });

    test('UpdateShowroomRequest excludes null fields', () {
      const req = UpdateShowroomRequest(
        name: 'Tambaram Main Hub',
        isActive: false,
      );

      final json = req.toJson();
      expect(json['name'], 'Tambaram Main Hub');
      expect(json['isActive'], false);
      expect(json.containsKey('address'), false);
      expect(json.containsKey('phone'), false);
    });
  });
}
