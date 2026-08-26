import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/jobcards/models/job_card_model.dart';

void main() {
  group('JobCard Models Unit Tests', () {
    test('JobCardStatus enum maps indices and labels correctly', () {
      expect(JobCardStatus.fromInt(0), JobCardStatus.draft);
      expect(JobCardStatus.fromInt(1), JobCardStatus.inProgress);
      expect(JobCardStatus.fromInt(2), JobCardStatus.qualityCheck);
      expect(JobCardStatus.fromInt(3), JobCardStatus.ready);
      expect(JobCardStatus.fromInt(4), JobCardStatus.invoiced);
      expect(JobCardStatus.fromInt(5), JobCardStatus.paid);
      expect(JobCardStatus.fromInt(6), JobCardStatus.delivered);
      expect(JobCardStatus.fromInt(7), JobCardStatus.cancelled);

      expect(JobCardStatus.fromString('InProgress'), JobCardStatus.inProgress);
      expect(JobCardStatus.fromString('QualityCheck'), JobCardStatus.qualityCheck);
      expect(JobCardStatus.fromString('Paid'), JobCardStatus.paid);
      expect(JobCardStatus.fromString('Unknown'), JobCardStatus.draft);
    });

    test('JobCard parses full detail backend contract', () {
      final json = {
        'id': 'jc-100',
        'jobCardNumber': 'JC-2026-0001',
        'status': 1,
        'customer': {
          'id': 'cust-1',
          'name': 'Ramesh Kumar',
          'phoneNumber': '9876543210',
          'email': 'ramesh@test.com',
        },
        'vehicle': {
          'id': 'veh-1',
          'registrationNumber': 'TN01AB1234',
          'make': 'Hyundai',
          'model': 'Creta',
        },
        'services': [
          {
            'id': 'line-1',
            'serviceId': 'svc-1',
            'serviceName': 'Foam Wash',
            'quantity': 1,
            'unitPrice': 500.0,
            'taxPercentage': 18.0,
            'discountAmount': 50.0,
            'lineTotal': 450.0,
          },
        ],
        'subtotal': 500.0,
        'discountAmount': 50.0,
        'taxAmount': 81.0,
        'totalAmount': 531.0,
        'notes': 'Please wipe interior clean',
        'createdAt': '2026-08-25T10:00:00Z',
      };

      final jobCard = JobCard.fromJson(json);

      expect(jobCard.id, 'jc-100');
      expect(jobCard.jobCardNumber, 'JC-2026-0001');
      expect(jobCard.status, JobCardStatus.inProgress);
      expect(jobCard.customer.name, 'Ramesh Kumar');
      expect(jobCard.vehicle.registrationNumber, 'TN01AB1234');
      expect(jobCard.services.length, 1);
      expect(jobCard.services.first.serviceName, 'Foam Wash');
      expect(jobCard.subtotal, 500.0);
      expect(jobCard.discountAmount, 50.0);
      expect(jobCard.taxAmount, 81.0);
      expect(jobCard.totalAmount, 531.0);
      expect(jobCard.notes, 'Please wipe interior clean');
    });

    test('JobCardListItem parses list response item', () {
      final json = {
        'id': 'jc-101',
        'jobCardNumber': 'JC-2026-0002',
        'status': 3,
        'customerName': 'Suresh',
        'customerPhone': '9876543211',
        'registrationNumber': 'KA01CD5678',
        'vehicleDisplayName': 'Honda City',
        'totalAmount': 1200.0,
        'createdAt': '2026-08-25T11:00:00Z',
      };

      final item = JobCardListItem.fromJson(json);

      expect(item.id, 'jc-101');
      expect(item.jobCardNumber, 'JC-2026-0002');
      expect(item.status, JobCardStatus.ready);
      expect(item.customerName, 'Suresh');
      expect(item.registrationNumber, 'KA01CD5678');
      expect(item.totalAmount, 1200.0);
    });

    test('CreateJobCardRequest serializes to exact backend JSON', () {
      const req = CreateJobCardRequest(
        customerId: 'c-1',
        vehicleId: 'v-1',
        notes: 'Handle with care',
        isGstEnabled: true,
        services: [
          JobCardServiceItemRequest(
            serviceId: 's-1',
            quantity: 2,
            discountAmount: 20.0,
          )
        ],
      );

      final json = req.toJson();

      expect(json['customerId'], 'c-1');
      expect(json['vehicleId'], 'v-1');
      expect(json['notes'], 'Handle with care');
      expect(json['isGstEnabled'], true);
      expect(json['services'], isA<List>());
      expect((json['services'] as List).length, 1);
    });
  });
}
