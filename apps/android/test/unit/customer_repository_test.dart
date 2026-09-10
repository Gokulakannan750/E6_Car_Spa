import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/customers/data/customer_api.dart';
import 'package:e6_car_spa/features/customers/data/customer_repository.dart';
import 'package:e6_car_spa/features/customers/models/customer_model.dart';

class FakeCustomerApi extends CustomerApi {
  CustomerListResponse? mockListResponse;
  Customer? mockCustomer;
  Customer? mockCustomerByPhone;
  Customer? mockCustomerByReg;
  CustomerHistoryResponse? mockHistory;
  Customer? mockCreatedCustomer;
  Customer? mockUpdatedCustomer;
  bool deleteCalled = false;
  String? lastDeletedId;
  int? lastPage;
  int? lastPageSize;
  String? lastSearch;
  DioException? errorToThrow;

  FakeCustomerApi() : super(Dio());

  @override
  Future<CustomerListResponse> getCustomers({
    int page = 1,
    int pageSize = 20,
    String? search,
  }) async {
    lastPage = page;
    lastPageSize = pageSize;
    lastSearch = search;
    if (errorToThrow != null) throw errorToThrow!;
    return mockListResponse ??
        const CustomerListResponse(
          items: [],
          totalCount: 0,
          page: 1,
          pageSize: 20,
        );
  }

  @override
  Future<Customer> getCustomerById(String id) async {
    if (errorToThrow != null) throw errorToThrow!;
    if (mockCustomer != null) return mockCustomer!;
    throw DioException(
      requestOptions: RequestOptions(path: '/customers/$id'),
      response: Response(
        requestOptions: RequestOptions(path: '/customers/$id'),
        statusCode: 404,
        data: {'message': 'Customer not found'},
      ),
      type: DioExceptionType.badResponse,
    );
  }

  @override
  Future<Customer?> getCustomerByPhone(String phoneNumber) async {
    if (errorToThrow != null) throw errorToThrow!;
    return mockCustomerByPhone;
  }

  @override
  Future<Customer?> getCustomerByRegistration(String registrationNumber) async {
    if (errorToThrow != null) throw errorToThrow!;
    return mockCustomerByReg;
  }

  @override
  Future<CustomerHistoryResponse> getCustomerHistory(String id) async {
    if (errorToThrow != null) throw errorToThrow!;
    return mockHistory ??
        CustomerHistoryResponse(
          customerId: id,
          customerName: 'History Customer',
          phoneNumber: '9988776655',
          totalJobCards: 1,
          totalVehicles: 1,
          jobCards: const [],
        );
  }

  @override
  Future<Customer> createCustomer(CreateCustomerRequest request) async {
    if (errorToThrow != null) throw errorToThrow!;
    return mockCreatedCustomer ??
        Customer(
          id: 'new-c-1',
          name: request.name,
          phoneNumber: request.phoneNumber,
          email: request.email,
          address: request.address,
        );
  }

  @override
  Future<Customer> updateCustomer(String id, UpdateCustomerRequest request) async {
    if (errorToThrow != null) throw errorToThrow!;
    return mockUpdatedCustomer ??
        Customer(
          id: id,
          name: request.name,
          phoneNumber: request.phoneNumber,
          email: request.email,
          address: request.address,
        );
  }

  @override
  Future<void> deleteCustomer(String id) async {
    if (errorToThrow != null) throw errorToThrow!;
    deleteCalled = true;
    lastDeletedId = id;
  }
}

void main() {
  late FakeCustomerApi fakeApi;
  late CustomerRepository repository;

  setUp(() {
    fakeApi = FakeCustomerApi();
    repository = CustomerRepository(fakeApi);
  });

  group('CustomerRepository Unit Tests', () {
    const sampleCustomer = Customer(
      id: 'cust-100',
      name: 'Priya Sharma',
      phoneNumber: '9876543210',
      email: 'priya@example.com',
      vehicleCount: 2,
    );

    test('getCustomers forwards pagination and query parameters correctly', () async {
      fakeApi.mockListResponse = const CustomerListResponse(
        items: [sampleCustomer],
        totalCount: 1,
        page: 2,
        pageSize: 15,
      );

      final result = await repository.getCustomers(page: 2, pageSize: 15, search: 'Priya');

      expect(fakeApi.lastPage, 2);
      expect(fakeApi.lastPageSize, 15);
      expect(fakeApi.lastSearch, 'Priya');
      expect(result.items.length, 1);
      expect(result.items.first.name, 'Priya Sharma');
      expect(result.totalCount, 1);
    });

    test('getCustomerById returns customer on success and maps 404 to NotFoundException', () async {
      fakeApi.mockCustomer = sampleCustomer;
      final customer = await repository.getCustomerById('cust-100');
      expect(customer.id, 'cust-100');
      expect(customer.name, 'Priya Sharma');

      // Now test 404 error mapping
      fakeApi.mockCustomer = null;
      fakeApi.errorToThrow = DioException(
        requestOptions: RequestOptions(path: '/customers/cust-missing'),
        response: Response(
          requestOptions: RequestOptions(path: '/customers/cust-missing'),
          statusCode: 404,
          data: {'message': 'Customer not found'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getCustomerById('cust-missing'),
        throwsA(isA<NotFoundException>().having((e) => e.statusCode, 'statusCode', 404)),
      );
    });

    test('getCustomerByPhone and getCustomerByRegistration return entity or null', () async {
      fakeApi.mockCustomerByPhone = sampleCustomer;
      final byPhone = await repository.getCustomerByPhone('9876543210');
      expect(byPhone?.name, 'Priya Sharma');

      fakeApi.mockCustomerByReg = sampleCustomer;
      final byReg = await repository.getCustomerByRegistration('KA01MJ5678');
      expect(byReg?.id, 'cust-100');

      // Null return check
      fakeApi.mockCustomerByPhone = null;
      final emptyPhone = await repository.getCustomerByPhone('0000000000');
      expect(emptyPhone, isNull);
    });

    test('getCustomerHistory maps 500 error to ServerException', () async {
      fakeApi.errorToThrow = DioException(
        requestOptions: RequestOptions(path: '/customers/cust-100/history'),
        response: Response(
          requestOptions: RequestOptions(path: '/customers/cust-100/history'),
          statusCode: 500,
          data: {'message': 'Internal database error in history aggregation'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getCustomerHistory('cust-100'),
        throwsA(
          isA<ServerException>()
              .having((e) => e.statusCode, 'statusCode', 500)
              .having((e) => e.message, 'message', contains('database error')),
        ),
      );
    });

    test('createCustomer maps HTTP 409 to ConflictException and 400 to ValidationException', () async {
      fakeApi.errorToThrow = DioException(
        requestOptions: RequestOptions(path: '/customers'),
        response: Response(
          requestOptions: RequestOptions(path: '/customers'),
          statusCode: 409,
          data: {'message': 'Customer with phone 9876543210 already exists.'},
        ),
        type: DioExceptionType.badResponse,
      );

      const request = CreateCustomerRequest(
        name: 'Duplicate User',
        phoneNumber: '9876543210',
      );

      expect(
        () => repository.createCustomer(request),
        throwsA(
          isA<ConflictException>()
              .having((e) => e.statusCode, 'statusCode', 409)
              .having((e) => e.message, 'message', contains('already exists')),
        ),
      );

      // Validation 400
      fakeApi.errorToThrow = DioException(
        requestOptions: RequestOptions(path: '/customers'),
        response: Response(
          requestOptions: RequestOptions(path: '/customers'),
          statusCode: 400,
          data: {'message': 'Phone number must be 10 digits.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.createCustomer(request),
        throwsA(
          isA<ValidationException>()
              .having((e) => e.statusCode, 'statusCode', 400)
              .having((e) => e.message, 'message', contains('10 digits')),
        ),
      );
    });

    test('deleteCustomer handles clean deletion and network timeout to NetworkException', () async {
      await repository.deleteCustomer('cust-to-del');
      expect(fakeApi.deleteCalled, isTrue);
      expect(fakeApi.lastDeletedId, 'cust-to-del');

      // Network timeout
      fakeApi.errorToThrow = DioException(
        requestOptions: RequestOptions(path: '/customers/cust-to-del'),
        type: DioExceptionType.connectionTimeout,
        message: 'Connection timed out',
      );

      expect(
        () => repository.deleteCustomer('cust-to-del'),
        throwsA(isA<NetworkException>()),
      );
    });
  });
}
