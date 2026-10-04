import 'package:e6_car_spa/features/showroom/models/showroom_operations_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ShowroomVehicleType Model', () {
    test('fromJson and toJson parse correctly', () {
      final json = {
        'id': 'vt-1',
        'code': 'SEDAN',
        'name': 'Sedan',
        'displayOrder': 1,
        'isActive': true,
        'createdAt': '2026-09-27T10:00:00.000Z',
      };

      final item = ShowroomVehicleType.fromJson(json);
      expect(item.id, 'vt-1');
      expect(item.code, 'SEDAN');
      expect(item.name, 'Sedan');
      expect(item.displayOrder, 1);
      expect(item.isActive, true);

      final outJson = item.toJson();
      expect(outJson['id'], 'vt-1');
      expect(outJson['name'], 'Sedan');
    });

    test('handles PascalCase keys', () {
      final json = {
        'Id': 'vt-2',
        'Code': 'SUV',
        'Name': 'Sports Utility Vehicle',
        'DisplayOrder': 2,
        'IsActive': false,
      };

      final item = ShowroomVehicleType.fromJson(json);
      expect(item.id, 'vt-2');
      expect(item.code, 'SUV');
      expect(item.name, 'Sports Utility Vehicle');
      expect(item.isActive, false);
    });
  });

  group('ShowroomWorkType Model', () {
    test('fromJson and toJson parse correctly', () {
      final json = {
        'id': 'wt-1',
        'code': 'WASH',
        'name': 'Full Body Wash',
        'description': 'Exterior and interior wash',
        'displayOrder': 1,
        'isActive': true,
        'createdAt': '2026-09-27T10:00:00.000Z',
      };

      final item = ShowroomWorkType.fromJson(json);
      expect(item.id, 'wt-1');
      expect(item.code, 'WASH');
      expect(item.name, 'Full Body Wash');
      expect(item.description, 'Exterior and interior wash');
      expect(item.isActive, true);

      final outJson = item.toJson();
      expect(outJson['id'], 'wt-1');
      expect(outJson['code'], 'WASH');
    });

    test('isOtherType follows the server isOther flag, not the name', () {
      ShowroomWorkType parse(Map<String, dynamic> extra) => ShowroomWorkType.fromJson({
        'id': 'wt-x',
        'code': 'X',
        'name': 'X',
        'createdAt': '2026-09-27T10:00:00.000Z',
        ...extra,
      });

      // Renamed "Other" keeps its flag.
      expect(parse({'name': 'Miscellaneous', 'code': 'MISC', 'isOther': true}).isOtherType, isTrue);
      // A work type merely named like "Other" is ordinary.
      expect(parse({'name': 'Other Polish', 'code': 'OTHER_POLISH', 'isOther': false}).isOtherType, isFalse);
      expect(parse({'name': 'Other', 'code': 'OTHER', 'isOther': false}).isOtherType, isFalse);
      // Older API without the flag: fall back to the seeded code only.
      expect(parse({'name': 'Other', 'code': 'OTHER'}).isOtherType, isTrue);
      expect(parse({'name': 'Other things', 'code': 'OTHERS'}).isOtherType, isFalse);
      expect(parse({'isOther': true}).toJson()['isOther'], isTrue);
    });
  });

  group('ShowroomVehicleWork & WorkItem Models', () {
    test(
      'fromJson parses nested service items and calculates display values',
      () {
        final json = {
          'id': 'work-100',
          'showroomId': 'sr-1',
          'showroomName': 'Anna Nagar',
          'staffId': 'staff-1',
          'staffName': 'Ramesh Kumar',
          'vehicleTypeId': 'vt-1',
          'vehicleTypeName': 'Sedan',
          'vehicleQuantity': 2,
          'date': '2026-09-27T00:00:00.000Z',
          'timeRecorded': '10:30 AM',
          'notes': 'Careful on door scratches',
          'serviceItems': [
            {
              'id': 'item-1',
              'showroomVehicleWorkId': 'work-100',
              'workTypeId': 'wt-1',
              'workTypeCode': 'WASH',
              'workTypeName': 'Full Wash',
              'quantity': 1,
            },
            {
              'id': 'item-2',
              'showroomVehicleWorkId': 'work-100',
              'workTypeId': 'wt-2',
              'workTypeCode': 'VACUUM',
              'workTypeName': 'Deep Vacuum',
              'quantity': 1,
            },
          ],
          'createdAt': '2026-09-27T10:30:00.000Z',
        };

        final work = ShowroomVehicleWork.fromJson(json);
        expect(work.id, 'work-100');
        expect(work.displayStaffName, 'Ramesh Kumar');
        expect(work.displayVehicleType, 'Sedan');
        expect(work.displayTime, '10:30 AM');
        expect(work.vehicleQuantity, 2);
        expect(work.notes, 'Careful on door scratches');
        expect(work.serviceItems.length, 2);
        expect(work.serviceItems[0].workTypeName, 'Full Wash');
        expect(work.serviceTypesSummary, 'Full Wash, Deep Vacuum');

        final outJson = work.toJson();
        expect(outJson['id'], 'work-100');
        expect((outJson['serviceItems'] as List).length, 2);
      },
    );
  });

  group('Request DTOs Serialization', () {
    test('CreateShowroomVehicleWorkRequest serializes correctly', () {
      final req = CreateShowroomVehicleWorkRequest(
        staffId: 'staff-1',
        vehicleTypeId: 'vt-1',
        date: DateTime(2026, 9, 27),
        vehicleQuantity: 1,
        notes: 'Priority customer',
        serviceItems: [
          const CreateShowroomVehicleWorkItemRequest(workTypeId: 'wt-1'),
          const CreateShowroomVehicleWorkItemRequest(
            workTypeId: 'wt-2',
            quantity: 2,
          ),
        ],
      );

      final json = req.toJson();
      expect(json['staffId'], 'staff-1');
      expect(json['vehicleTypeId'], 'vt-1');
      expect(json['date'], '2026-09-27');
      expect(json['vehicleQuantity'], 1);
      expect(json['notes'], 'Priority customer');
      expect((json['serviceItems'] as List).length, 2);
    });

    test('CreateBatchShowroomVehicleWorkRequest serializes correctly', () {
      final batchReq = CreateBatchShowroomVehicleWorkRequest(
        staffId: 'staff-2',
        date: DateTime(2026, 9, 27),
        vehicles: [
          const IndividualVehicleWorkEntry(
            vehicleTypeId: 'vt-1',
            workTypeIds: ['wt-1', 'wt-2'],
            notes: 'First vehicle',
          ),
          const IndividualVehicleWorkEntry(
            vehicleTypeId: 'vt-2',
            workTypeIds: ['wt-1'],
          ),
        ],
      );

      final json = batchReq.toJson();
      expect(json['staffId'], 'staff-2');
      expect(json['date'], '2026-09-27');
      final vehicles = json['vehicles'] as List;
      expect(vehicles.length, 2);
      expect(vehicles[0]['vehicleTypeId'], 'vt-1');
      expect(vehicles[0]['workTypeIds'], ['wt-1', 'wt-2']);
      expect(vehicles[0]['notes'], 'First vehicle');
    });

    test('UpdateShowroomVehicleWorkRequest serializes correctly', () {
      const updateReq = UpdateShowroomVehicleWorkRequest(
        staffId: 'staff-3',
        vehicleTypeId: 'vt-3',
        notes: 'Updated note',
      );

      final json = updateReq.toJson();
      expect(json['staffId'], 'staff-3');
      expect(json['vehicleTypeId'], 'vt-3');
      expect(json['notes'], 'Updated note');
    });

    test('CloseShowroomStaffWorkSessionRequest serializes correctly', () {
      const closeReq = CloseShowroomStaffWorkSessionRequest(
        endTime: '17:45',
        notes: 'Clocked out with approval',
      );

      final json = closeReq.toJson();
      expect(json['endTime'], '17:45');
      expect(json['notes'], 'Clocked out with approval');
    });
  });

  group('ShowroomOperationsSummary Model', () {
    test('fromJson and getters parse aggregates correctly', () {
      final json = {
        'showroomId': 'sr-1',
        'showroomName': 'Anna Nagar',
        'fromDate': '2026-09-27T00:00:00.000Z',
        'toDate': '2026-09-27T23:59:59.000Z',
        'totalVehiclesHandled': 12,
        'totalServicesPerformed': 24,
        'totalActiveStaffSessions': 4,
        'vehicleTypeBreakdown': [
          {
            'vehicleTypeId': 'vt-1',
            'vehicleTypeCode': 'SEDAN',
            'vehicleTypeName': 'Sedan',
            'totalVehicles': 7,
          },
          {
            'vehicleTypeId': 'vt-2',
            'vehicleTypeCode': 'SUV',
            'vehicleTypeName': 'SUV',
            'totalVehicles': 5,
          },
        ],
        'workTypeBreakdown': [
          {
            'workTypeId': 'wt-1',
            'workTypeCode': 'WASH',
            'workTypeName': 'Full Wash',
            'totalQuantity': 12,
          },
        ],
        'staffProductivityBreakdown': [
          {
            'staffId': 'staff-1',
            'staffMasterId': 'STF001',
            'staffName': 'Ramesh',
            'totalSessions': 1,
            'totalVehiclesHandled': 6,
            'totalServicesPerformed': 12,
          },
        ],
      };

      final summary = ShowroomOperationsSummary.fromJson(json);
      expect(summary.showroomId, 'sr-1');
      expect(summary.totalVehiclesHandled, 12);
      expect(summary.totalServicesPerformed, 24);
      expect(summary.totalActiveStaffSessions, 4);
      expect(summary.vehicleTypeBreakdown.length, 2);
      expect(summary.vehicleTypeBreakdown[0].totalVehicles, 7);
      expect(summary.workTypeBreakdown.length, 1);
      expect(summary.workTypeBreakdown[0].totalPerformed, 12);
      expect(summary.staffProductivityBreakdown.length, 1);
      expect(summary.staffProductivityBreakdown[0].totalVehiclesHandled, 6);
    });
  });
}
