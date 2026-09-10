import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/vehicles/data/vehicle_api.dart';
import 'package:e6_car_spa/features/vehicles/data/vehicle_repository.dart';
import 'package:e6_car_spa/features/vehicles/models/vehicle_model.dart';
import 'package:dio/dio.dart';

class FakeVehicleApi extends VehicleApi {
  Vehicle? mockCreatedVehicle;
  Vehicle? mockLookupVehicle;
  String? lastLookupRegistration;
  List<Vehicle> mockCustomerVehicles = [];
  DioException? errorToThrow;

  FakeVehicleApi() : super(Dio());

  @override
  Future<Vehicle> createVehicle(CreateVehicleRequest request) async {
    if (errorToThrow != null) throw errorToThrow!;
    if (mockCreatedVehicle != null) return mockCreatedVehicle!;
    return Vehicle(
      id: 'veh-new',
      registrationNumber: request.registrationNumber,
      make: request.make,
      model: request.model,
      variant: request.variant,
      color: request.color,
      customerId: request.customerId,
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<Vehicle?> getVehicleByRegistration(String registrationNumber) async {
    lastLookupRegistration = registrationNumber;
    if (errorToThrow != null) throw errorToThrow!;
    return mockLookupVehicle;
  }

  @override
  Future<List<Vehicle>> getVehiclesByCustomer(String customerId) async {
    if (errorToThrow != null) throw errorToThrow!;
    return mockCustomerVehicles;
  }

  @override
  Future<Vehicle> transferOwnership(String vehicleId, String newCustomerId) async {
    if (errorToThrow != null) throw errorToThrow!;
    return Vehicle(
      id: vehicleId,
      registrationNumber: 'TN56P3334',
      make: 'Maruti',
      model: 'Baleno',
      customerId: newCustomerId,
      createdAt: DateTime.now(),
    );
  }
}

void main() {
  late FakeVehicleApi fakeApi;
  late VehicleRepository repository;

  setUp(() {
    fakeApi = FakeVehicleApi();
    repository = VehicleRepository(fakeApi);
  });

  group('VehicleRepository - Unit & Conflict Tests', () {
    test('createVehicle successfully creates and returns Vehicle model', () async {
      const request = CreateVehicleRequest(
        registrationNumber: 'TN01AB1234',
        make: 'Hyundai',
        model: 'Creta',
        variant: 'SX',
        customerId: 'cust-1',
      );

      final vehicle = await repository.createVehicle(request);

      expect(vehicle.id, 'veh-new');
      expect(vehicle.registrationNumber, 'TN01AB1234');
      expect(vehicle.make, 'Hyundai');
      expect(vehicle.model, 'Creta');
      expect(vehicle.customerId, 'cust-1');
    });

    test('createVehicle converts HTTP 409 DioException into ConflictException', () async {
      fakeApi.errorToThrow = DioException(
        requestOptions: RequestOptions(path: '/api/vehicles'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/vehicles'),
          statusCode: 409,
          data: {
            'error': 'Vehicle with registration number TN01AB1234 already exists in the system.',
          },
        ),
        type: DioExceptionType.badResponse,
      );

      const request = CreateVehicleRequest(
        registrationNumber: 'TN01AB1234',
        make: 'Hyundai',
        model: 'Creta',
        customerId: 'cust-1',
      );

      expect(
        () => repository.createVehicle(request),
        throwsA(
          isA<ConflictException>()
              .having((e) => e.statusCode, 'statusCode', 409)
              .having(
                (e) => e.message,
                'message',
                'Vehicle with registration number TN01AB1234 already exists in the system.',
              ),
        ),
      );
    });

    test('createVehicle converts HTTP 500 into ServerException', () async {
      fakeApi.errorToThrow = DioException(
        requestOptions: RequestOptions(path: '/api/vehicles'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/vehicles'),
          statusCode: 500,
          data: {'detail': 'Database connection error'},
        ),
        type: DioExceptionType.badResponse,
      );

      const request = CreateVehicleRequest(
        registrationNumber: 'TN01AB1234',
        make: 'Hyundai',
        model: 'Creta',
        customerId: 'cust-1',
      );

      expect(
        () => repository.createVehicle(request),
        throwsA(isA<ServerException>().having((e) => e.statusCode, 'statusCode', 500)),
      );
    });

    test('getVehicleByRegistration returns null when vehicle not found (404)', () async {
      fakeApi.mockLookupVehicle = null;

      final result = await repository.getVehicleByRegistration('TN99ZZ9999');

      expect(result, isNull);
    });

    test('getVehicleByRegistration normalizes registration to uppercase before calling API', () async {
      await repository.getVehicleByRegistration('tn56p3334');
      expect(fakeApi.lastLookupRegistration, 'TN56P3334');

      await repository.getVehicleByRegistration('  tn01ab1234  ');
      expect(fakeApi.lastLookupRegistration, 'TN01AB1234');
    });

    test('getVehiclesByCustomer returns list of vehicles for a given customer', () async {
      fakeApi.mockCustomerVehicles = [
        Vehicle(
          id: 'veh-1',
          registrationNumber: 'TN01AB1234',
          make: 'Hyundai',
          model: 'Creta',
          customerId: 'cust-1',
          createdAt: DateTime.now(),
        ),
        Vehicle(
          id: 'veh-2',
          registrationNumber: 'TN02CD5678',
          make: 'Honda',
          model: 'City',
          customerId: 'cust-1',
          createdAt: DateTime.now(),
        ),
      ];

      final list = await repository.getVehiclesByCustomer('cust-1');

      expect(list.length, 2);
      expect(list[0].registrationNumber, 'TN01AB1234');
      expect(list[1].registrationNumber, 'TN02CD5678');
    });

    test('transferOwnership successfully transfers vehicle to new customer', () async {
      final transferred = await repository.transferOwnership('veh-v', 'cust-2');

      expect(transferred.id, 'veh-v');
      expect(transferred.customerId, 'cust-2');
      expect(transferred.registrationNumber, 'TN56P3334');
      expect(transferred.make, 'Maruti');
      expect(transferred.model, 'Baleno');
    });

    test('transferOwnership converts HTTP 409 into ConflictException', () async {
      fakeApi.errorToThrow = DioException(
        requestOptions: RequestOptions(path: '/api/vehicles/veh-v/transfer-ownership'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/vehicles/veh-v/transfer-ownership'),
          statusCode: 409,
          data: {'error': 'Vehicle is already registered to this customer.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.transferOwnership('veh-v', 'cust-same'),
        throwsA(isA<ConflictException>().having((e) => e.statusCode, 'statusCode', 409)),
      );
    });
  });
}
