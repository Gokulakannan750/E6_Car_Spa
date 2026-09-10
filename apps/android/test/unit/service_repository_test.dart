import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/catalogue/data/service_api.dart';
import 'package:e6_car_spa/features/catalogue/data/service_repository.dart';
import 'package:e6_car_spa/features/catalogue/models/service_model.dart';
import 'package:flutter_test/flutter_test.dart';

class MockServiceApi extends ServiceApi {
  MockServiceApi() : super(Dio());

  ServiceListResponse? servicesToReturn;
  Service? serviceToReturn;
  List<String>? categoriesToReturn;
  DioException? dioExceptionToThrow;

  @override
  Future<ServiceListResponse> getServices({
    bool? isActive,
    int page = 1,
    int pageSize = 100,
    String? search,
    String? category,
  }) async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return servicesToReturn!;
  }

  @override
  Future<Service> getServiceById(String id) async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return serviceToReturn!;
  }

  @override
  Future<Service> createService(CreateServiceRequest request) async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return serviceToReturn!;
  }

  @override
  Future<Service> updateService(String id, UpdateServiceRequest request) async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return serviceToReturn!;
  }

  @override
  Future<List<String>> getCategories() async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    return categoriesToReturn!;
  }
}

void main() {
  late MockServiceApi mockApi;
  late ServiceRepository repository;

  const sampleService = Service(
    id: 'srv-1',
    name: 'Full Body Foam Wash',
    description: 'Complete foam wash and interior vacuuming',
    category: 'Washing',
    price: 650.0,
    taxPercentage: 18.0,
    durationMinutes: 45,
    isActive: true,
  );

  setUp(() {
    mockApi = MockServiceApi();
    repository = ServiceRepository(mockApi);
  });

  group('ServiceRepository Tests', () {
    test('getServices returns ServiceListResponse on success', () async {
      mockApi.servicesToReturn = const ServiceListResponse(
        items: [sampleService],
        totalCount: 1,
        page: 1,
        pageSize: 100,
      );

      final result = await repository.getServices();
      expect(result.items.length, 1);
      expect(result.items.first.name, 'Full Body Foam Wash');
      expect(result.items.first.price, 650.0);
    });

    test('getServiceById returns Service on success', () async {
      mockApi.serviceToReturn = sampleService;

      final result = await repository.getServiceById('srv-1');
      expect(result.id, 'srv-1');
      expect(result.name, 'Full Body Foam Wash');
    });

    test('createService returns created Service on success', () async {
      mockApi.serviceToReturn = sampleService;

      final result = await repository.createService(
        const CreateServiceRequest(
          name: 'Full Body Foam Wash',
          price: 650.0,
          category: 'Washing',
        ),
      );
      expect(result.id, 'srv-1');
      expect(result.price, 650.0);
    });

    test('updateService returns updated Service on success', () async {
      const updated = Service(
        id: 'srv-1',
        name: 'Full Body Foam Wash Deluxe',
        price: 750.0,
        category: 'Washing',
      );
      mockApi.serviceToReturn = updated;

      final result = await repository.updateService(
        'srv-1',
        const UpdateServiceRequest(
          name: 'Full Body Foam Wash Deluxe',
          price: 750.0,
        ),
      );
      expect(result.name, 'Full Body Foam Wash Deluxe');
      expect(result.price, 750.0);
    });

    test('getCategories returns string categories list on success', () async {
      mockApi.categoriesToReturn = ['Washing', 'Detailing', 'Polishing'];

      final result = await repository.getCategories();
      expect(result.length, 3);
      expect(result, contains('Detailing'));
    });

    test('getServices maps 400 Bad Request to ValidationException', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/services'),
        response: Response(
          requestOptions: RequestOptions(path: '/services'),
          statusCode: 400,
          data: {'error': 'Invalid service query parameters.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getServices(),
        throwsA(isA<ValidationException>().having(
          (e) => e.message,
          'message',
          contains('Invalid service query parameters.'),
        )),
      );
    });

    test('getServices maps 401 to UnauthorizedException', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/services'),
        response: Response(
          requestOptions: RequestOptions(path: '/services'),
          statusCode: 401,
          data: {'message': 'Unauthorized'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getServices(),
        throwsA(isA<UnauthorizedException>()),
      );
    });

    test('getServices maps 403 to ForbiddenException', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/services'),
        response: Response(
          requestOptions: RequestOptions(path: '/services'),
          statusCode: 403,
          data: {'error': 'Forbidden access to service catalogue.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getServices(),
        throwsA(isA<ForbiddenException>()),
      );
    });

    test('getServiceById maps 404 to NotFoundException', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/services/srv-999'),
        response: Response(
          requestOptions: RequestOptions(path: '/services/srv-999'),
          statusCode: 404,
          data: {'error': 'Service srv-999 not found.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getServiceById('srv-999'),
        throwsA(isA<NotFoundException>()),
      );
    });

    test('createService maps 409 Conflict to ConflictException', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/services'),
        response: Response(
          requestOptions: RequestOptions(path: '/services'),
          statusCode: 409,
          data: {'error': "Service with name 'Full Body Foam Wash' already exists."},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.createService(
          const CreateServiceRequest(name: 'Full Body Foam Wash', price: 650.0),
        ),
        throwsA(isA<ConflictException>().having(
          (e) => e.message,
          'message',
          contains("Service with name 'Full Body Foam Wash' already exists."),
        )),
      );
    });

    test('createService maps 500 to ServerException', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/services'),
        response: Response(
          requestOptions: RequestOptions(path: '/services'),
          statusCode: 500,
          data: {'error': 'Internal server error while saving service.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.createService(
          const CreateServiceRequest(name: 'New Service', price: 100.0),
        ),
        throwsA(isA<ServerException>()),
      );
    });

    test('getServices maps connection timeout to NetworkException', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/services'),
        type: DioExceptionType.connectionTimeout,
      );

      expect(
        () => repository.getServices(),
        throwsA(isA<NetworkException>().having(
          (e) => e.message,
          'message',
          contains('Connection timeout'),
        )),
      );
    });
  });
}
