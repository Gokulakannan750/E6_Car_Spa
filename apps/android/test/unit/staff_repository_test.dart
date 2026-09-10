import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/staff/data/staff_api.dart';
import 'package:e6_car_spa/features/staff/data/staff_repository.dart';
import 'package:e6_car_spa/features/staff/models/staff_model.dart';
import 'package:e6_car_spa/features/staff/models/staff_request_models.dart';

class FakeStaffApi extends StaffApi {
  List<Staff> mockStaffList = [];
  Staff? mockStaff;
  Staff? mockCreatedStaff;
  Staff? mockUpdatedStaff;
  bool deleteCalled = false;
  String? lastDeletedId;
  CreateStaffRequest? lastCreateRequest;
  UpdateStaffRequest? lastUpdateRequest;
  DioException? errorToThrow;

  FakeStaffApi() : super(Dio());

  @override
  Future<List<Staff>> getStaff() async {
    if (errorToThrow != null) throw errorToThrow!;
    return mockStaffList;
  }

  @override
  Future<Staff> getStaffById(String staffId) async {
    if (errorToThrow != null) throw errorToThrow!;
    if (mockStaff != null) return mockStaff!;
    throw DioException(
      requestOptions: RequestOptions(path: '/staff-advances/staff/$staffId'),
      response: Response(
        requestOptions: RequestOptions(path: '/staff-advances/staff/$staffId'),
        statusCode: 404,
        data: {'message': 'Staff member not found'},
      ),
      type: DioExceptionType.badResponse,
    );
  }

  @override
  Future<Staff> createStaff(CreateStaffRequest request) async {
    lastCreateRequest = request;
    if (errorToThrow != null) throw errorToThrow!;
    return mockCreatedStaff ??
        Staff(
          id: 'staff-new',
          name: request.name,
          phoneNumber: request.phoneNumber,
          email: request.email,
          address: request.address,
          role: request.role,
          isActive: request.isActive,
        );
  }

  @override
  Future<Staff> updateStaff(String staffId, UpdateStaffRequest request) async {
    lastUpdateRequest = request;
    if (errorToThrow != null) throw errorToThrow!;
    return mockUpdatedStaff ??
        Staff(
          id: staffId,
          name: request.name ?? 'Updated Staff',
          phoneNumber: request.phoneNumber ?? '9876543210',
          email: request.email,
          address: request.address,
          role: request.role,
          isActive: request.isActive ?? true,
        );
  }

  @override
  Future<void> deleteStaff(String staffId) async {
    if (errorToThrow != null) throw errorToThrow!;
    deleteCalled = true;
    lastDeletedId = staffId;
  }
}

void main() {
  late FakeStaffApi fakeApi;
  late StaffRepository repository;

  setUp(() {
    fakeApi = FakeStaffApi();
    repository = StaffRepository(fakeApi);
  });

  group('StaffRepository Unit & Model Tests', () {
    const sampleStaff = Staff(
      id: 'staff-1',
      name: 'Vignesh Rajan',
      phoneNumber: '9876543210',
      email: 'vignesh@example.com',
      role: 'Detailer',
      isActive: true,
      totalAdvances: 2,
      totalAdvanceAmount: 5000.0,
    );

    test('getStaff returns staff list and parses camelCase + PascalCase JSON correctly', () async {
      fakeApi.mockStaffList = [sampleStaff];
      final staffList = await repository.getStaff();

      expect(staffList.length, 1);
      expect(staffList.first.name, 'Vignesh Rajan');
      expect(staffList.first.initials, 'VR');
      expect(staffList.first.totalAdvances, 2);
      expect(staffList.first.totalAdvanceAmount, 5000.0);

      // Verify PascalCase backend compatibility
      final pascalJson = {
        'Id': 'staff-p',
        'Name': 'Karthik',
        'PhoneNumber': '9123456780',
        'Email': 'karthik@example.com',
        'Role': 'Polisher',
        'IsActive': true,
        'TotalAdvances': 1,
        'TotalAdvanceAmount': 2500,
      };
      final parsed = Staff.fromJson(pascalJson);
      expect(parsed.id, 'staff-p');
      expect(parsed.name, 'Karthik');
      expect(parsed.initials, 'K'); // Single name initials
      expect(parsed.totalAdvanceAmount, 2500.0);
    });

    test('getStaffById returns staff on success and converts 404 to NotFoundException', () async {
      fakeApi.mockStaff = sampleStaff;
      final staff = await repository.getStaffById('staff-1');
      expect(staff.id, 'staff-1');
      expect(staff.name, 'Vignesh Rajan');

      // Test 404 mapping
      fakeApi.mockStaff = null;
      fakeApi.errorToThrow = DioException(
        requestOptions: RequestOptions(path: '/staff-advances/staff/unknown'),
        response: Response(
          requestOptions: RequestOptions(path: '/staff-advances/staff/unknown'),
          statusCode: 404,
          data: {'message': 'Staff member not found'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getStaffById('unknown'),
        throwsA(isA<NotFoundException>().having((e) => e.statusCode, 'statusCode', 404)),
      );
    });

    test('createStaff captures serialized request payload and maps 400 to ValidationException', () async {
      const request = CreateStaffRequest(
        name: '  Anand Kumar  ',
        phoneNumber: '  9876501234  ',
        role: 'Washer',
        isActive: true,
      );

      final json = request.toJson();
      expect(json['name'], 'Anand Kumar');
      expect(json['phoneNumber'], '9876501234');
      expect(json['role'], 'Washer');
      expect(json.containsKey('email'), isFalse); // Omitted when null

      final created = await repository.createStaff(request);
      expect(fakeApi.lastCreateRequest, request);
      expect(created.id, 'staff-new');

      // Validation 400
      fakeApi.errorToThrow = DioException(
        requestOptions: RequestOptions(path: '/staff-advances/staff'),
        response: Response(
          requestOptions: RequestOptions(path: '/staff-advances/staff'),
          statusCode: 400,
          data: {'message': 'Phone number already assigned to another staff member.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.createStaff(request),
        throwsA(
          isA<ValidationException>()
              .having((e) => e.statusCode, 'statusCode', 400)
              .having((e) => e.message, 'message', contains('already assigned')),
        ),
      );
    });

    test('updateStaff forwards update request and maps 403 to ForbiddenException', () async {
      const updateReq = UpdateStaffRequest(
        name: 'Vignesh R',
        isActive: false,
      );

      final json = updateReq.toJson();
      expect(json['name'], 'Vignesh R');
      expect(json['isActive'], false);
      expect(json.containsKey('email'), isFalse);

      final updated = await repository.updateStaff('staff-1', updateReq);
      expect(fakeApi.lastUpdateRequest, updateReq);
      expect(updated.id, 'staff-1');

      // 403 Forbidden
      fakeApi.errorToThrow = DioException(
        requestOptions: RequestOptions(path: '/staff-advances/staff/staff-1'),
        response: Response(
          requestOptions: RequestOptions(path: '/staff-advances/staff/staff-1'),
          statusCode: 403,
          data: {'message': 'Only managers and owners can update staff profiles.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.updateStaff('staff-1', updateReq),
        throwsA(
          isA<ForbiddenException>()
              .having((e) => e.statusCode, 'statusCode', 403)
              .having((e) => e.message, 'message', contains('Only managers')),
        ),
      );
    });

    test('deleteStaff invokes delete endpoint and maps 500 to ServerException', () async {
      await repository.deleteStaff('staff-to-remove');
      expect(fakeApi.deleteCalled, isTrue);
      expect(fakeApi.lastDeletedId, 'staff-to-remove');

      // 500 Server error
      fakeApi.errorToThrow = DioException(
        requestOptions: RequestOptions(path: '/staff-advances/staff/staff-to-remove'),
        response: Response(
          requestOptions: RequestOptions(path: '/staff-advances/staff/staff-to-remove'),
          statusCode: 500,
          data: {'message': 'Database constraint failure on staff deletion.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.deleteStaff('staff-to-remove'),
        throwsA(
          isA<ServerException>()
              .having((e) => e.statusCode, 'statusCode', 500)
              .having((e) => e.message, 'message', contains('constraint failure')),
        ),
      );
    });

    test('StaffRepository maps network timeouts to NetworkException', () async {
      fakeApi.errorToThrow = DioException(
        requestOptions: RequestOptions(path: '/staff-advances/staff'),
        type: DioExceptionType.connectionTimeout,
        message: 'Connection timed out',
      );

      expect(
        () => repository.getStaff(),
        throwsA(isA<NetworkException>()),
      );
    });
  });
}
