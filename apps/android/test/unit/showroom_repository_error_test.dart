import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_api.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_model.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_staff_assignment_model.dart';
import 'package:flutter_test/flutter_test.dart';

class MockErrorShowroomApi extends ShowroomApi {
  MockErrorShowroomApi() : super(Dio());

  DioException? exceptionToThrow;

  @override
  Future<List<Showroom>> getShowrooms({String? search, bool? isActive}) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    return [];
  }

  @override
  Future<Showroom> getShowroomById(String id) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<Showroom> createShowroom(CreateShowroomRequest request) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<Showroom> updateShowroom(String id, UpdateShowroomRequest request) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<DailyStaffResponse> getDailyStaff(String showroomId, DateTime date) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<DailyStaffAssignment> assignDailyStaff(
    String showroomId,
    CreateDailyStaffAssignmentRequest request,
  ) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<DailyStaffAssignment> updateDailyStaffVehicles(
    String assignmentId,
    UpdateDailyStaffAssignmentRequest request,
  ) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<DailyStaffResponse> confirmDailyStaffAttendance(
    String showroomId,
    DateTime date,
  ) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<DailyStaffResponse> unlockDailyStaffAttendance(
    String showroomId,
    DateTime date,
  ) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }
}

void main() {
  late MockErrorShowroomApi mockApi;
  late ShowroomRepository repository;

  setUp(() {
    mockApi = MockErrorShowroomApi();
    repository = ShowroomRepository(mockApi);
  });

  group('ShowroomRepository Error Boundary Tests', () {
    test('getShowrooms maps 401 Unauthorized to UnauthorizedException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/showrooms'),
        response: Response(
          requestOptions: RequestOptions(path: '/showrooms'),
          statusCode: 401,
          data: {'error': 'Session expired. Please log in again.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getShowrooms(),
        throwsA(isA<UnauthorizedException>()),
      );
    });

    test('createShowroom maps 400 Bad Request to ValidationException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/showrooms'),
        response: Response(
          requestOptions: RequestOptions(path: '/showrooms'),
          statusCode: 400,
          data: {'error': 'Showroom name is required and cannot be empty.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.createShowroom(const CreateShowroomRequest(name: '', address: 'Address')),
        throwsA(isA<ValidationException>().having(
          (e) => e.message,
          'message',
          contains('Showroom name is required and cannot be empty.'),
        )),
      );
    });

    test('getShowroomById maps 404 Not Found to NotFoundException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/showrooms/sr-999'),
        response: Response(
          requestOptions: RequestOptions(path: '/showrooms/sr-999'),
          statusCode: 404,
          data: {'error': 'Showroom sr-999 not found.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getShowroomById('sr-999'),
        throwsA(isA<NotFoundException>()),
      );
    });

    test('confirmDailyStaffAttendance maps 403 Forbidden to ForbiddenException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/showrooms/sr-1/daily-staff/confirm'),
        response: Response(
          requestOptions: RequestOptions(path: '/showrooms/sr-1/daily-staff/confirm'),
          statusCode: 403,
          data: {'error': 'User lacks permission showroom.confirm_attendance.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.confirmDailyStaffAttendance('sr-1', DateTime(2026, 9, 9)),
        throwsA(isA<ForbiddenException>().having(
          (e) => e.message,
          'message',
          contains('User lacks permission showroom.confirm_attendance.'),
        )),
      );
    });

    test('assignDailyStaff maps 409 Conflict to ConflictException when attendance is locked', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/showrooms/sr-1/daily-staff'),
        response: Response(
          requestOptions: RequestOptions(path: '/showrooms/sr-1/daily-staff'),
          statusCode: 409,
          data: {'error': 'Cannot assign staff: Attendance for this date is already confirmed and locked.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.assignDailyStaff(
          'sr-1',
          CreateDailyStaffAssignmentRequest(
            staffId: 'stf-1',
            date: DateTime(2026, 9, 9),
            vehiclesAttended: 5,
          ),
        ),
        throwsA(isA<ConflictException>().having(
          (e) => e.message,
          'message',
          contains('Cannot assign staff: Attendance for this date is already confirmed and locked.'),
        )),
      );
    });

    test('updateDailyStaffVehicles maps 500 Server Error to ServerException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/showroom-staff-assignments/asg-1'),
        response: Response(
          requestOptions: RequestOptions(path: '/showroom-staff-assignments/asg-1'),
          statusCode: 500,
          data: {'error': 'Database transaction failure while updating vehicle count.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.updateDailyStaffVehicles(
          'asg-1',
          const UpdateDailyStaffAssignmentRequest(vehiclesAttended: 8),
        ),
        throwsA(isA<ServerException>()),
      );
    });

    test('getDailyStaff maps connection timeout to NetworkException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/showrooms/sr-1/daily-staff'),
        type: DioExceptionType.connectionTimeout,
      );

      expect(
        () => repository.getDailyStaff('sr-1', DateTime(2026, 9, 9)),
        throwsA(isA<NetworkException>().having(
          (e) => e.message,
          'message',
          contains('Connection timeout'),
        )),
      );
    });

    test('unlockDailyStaffAttendance maps connection error to NetworkException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/showrooms/sr-1/daily-staff/unlock'),
        type: DioExceptionType.connectionError,
      );

      expect(
        () => repository.unlockDailyStaffAttendance('sr-1', DateTime(2026, 9, 9)),
        throwsA(isA<NetworkException>()),
      );
    });
  });
}
