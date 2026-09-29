import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/customers/models/customer_model.dart';

void main() {
  group('Customer Models Unit Tests', () {
    test('Customer parses from backend JSON correctly with payment aggregations', () {
      final json = {
        'id': 'cust-123',
        'name': 'Ramesh Kumar',
        'phoneNumber': '9876543210',
        'email': 'ramesh@example.com',
        'address': '123 Main St, Chennai',
        'vehicleCount': 2,
        'invoiceCount': 5,
        'totalInvoicedAmount': 10000.0,
        'totalPaidAmount': 8500.0,
        'totalOutstandingAmount': 1500.0,
        'paymentStatus': 'Payment Pending',
        'createdAt': '2026-08-25T10:00:00Z',
        'updatedAt': '2026-08-25T10:00:00Z',
      };

      final customer = Customer.fromJson(json);

      expect(customer.id, 'cust-123');
      expect(customer.name, 'Ramesh Kumar');
      expect(customer.phoneNumber, '9876543210');
      expect(customer.email, 'ramesh@example.com');
      expect(customer.address, '123 Main St, Chennai');
      expect(customer.vehicleCount, 2);
      expect(customer.invoiceCount, 5);
      expect(customer.totalInvoicedAmount, 10000.0);
      expect(customer.totalPaidAmount, 8500.0);
      expect(customer.totalOutstandingAmount, 1500.0);
      expect(customer.paymentStatus, 'Payment Pending');
      expect(customer.initials, 'RK');
    });

    test('Customer initials handles single and multi-word names', () {
      const c1 = Customer(id: '1', name: 'Ramesh', phoneNumber: '123');
      expect(c1.initials, 'R');

      const c2 = Customer(id: '2', name: 'Ramesh Kumar Sharma', phoneNumber: '123');
      expect(c2.initials, 'RK');

      const c3 = Customer(id: '3', name: '', phoneNumber: '123');
      expect(c3.initials, '?');
    });

    test('CustomerListResponse parses paged backend structure', () {
      final json = {
        'items': [
          {'id': '1', 'name': 'Alice', 'phoneNumber': '111', 'vehicleCount': 1},
          {'id': '2', 'name': 'Bob', 'phoneNumber': '222', 'vehicleCount': 0},
        ],
        'totalCount': 2,
        'pageNumber': 1,
        'pageSize': 20,
      };

      final response = CustomerListResponse.fromJson(json);

      expect(response.items.length, 2);
      expect(response.totalCount, 2);
      expect(response.items.first.name, 'Alice');
    });

    test('CreateCustomerRequest serializes to exact backend JSON', () {
      const req = CreateCustomerRequest(
        name: 'Suresh',
        phoneNumber: '9876543211',
        email: 'suresh@example.com',
        address: 'Bangalore',
      );

      final json = req.toJson();
      expect(json['name'], 'Suresh');
      expect(json['phoneNumber'], '9876543211');
      expect(json['email'], 'suresh@example.com');
      expect(json['address'], 'Bangalore');
    });

    test('CustomerHistoryResponse parses correctly with payment details', () {
      final json = {
        'customerId': 'cust-1',
        'customerName': 'Ramesh',
        'phoneNumber': '9876543210',
        'totalJobCards': 1,
        'totalSpent': 1500.0,
        'invoiceCount': 4,
        'totalInvoicedAmount': 6000.0,
        'totalPaidAmount': 6000.0,
        'totalOutstandingAmount': 0.0,
        'paymentStatus': 'Paid',
        'jobCards': [
          {
            'jobCardId': 'jc-1',
            'jobCardNumber': 'JC-2026-0001',
            'createdAt': '2026-08-25T10:00:00Z',
            'status': 'InProgress',
            'totalAmount': 1500.0,
            'vehicleNumber': 'TN01AB1234',
          }
        ],
      };

      final history = CustomerHistoryResponse.fromJson(json);
      expect(history.customerId, 'cust-1');
      expect(history.totalJobCards, 1);
      expect(history.invoiceCount, 4);
      expect(history.totalInvoicedAmount, 6000.0);
      expect(history.totalPaidAmount, 6000.0);
      expect(history.totalOutstandingAmount, 0.0);
      expect(history.paymentStatus, 'Paid');
      expect(history.jobCards.first.jobCardNumber, 'JC-2026-0001');
      expect(history.jobCards.first.vehicleNumber, 'TN01AB1234');
    });
  });
}
