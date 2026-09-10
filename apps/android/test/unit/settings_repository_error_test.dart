import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/settings/data/settings_api.dart';
import 'package:e6_car_spa/features/settings/data/settings_repository.dart';
import 'package:e6_car_spa/features/settings/models/business_profile_model.dart';
import 'package:e6_car_spa/features/settings/models/logo_upload_response.dart';
import 'package:e6_car_spa/features/settings/models/update_business_profile_request.dart';
import 'package:flutter_test/flutter_test.dart';

class MockErrorSettingsApi extends SettingsApi {
  MockErrorSettingsApi() : super(Dio());

  DioException? exceptionToThrow;

  @override
  Future<BusinessProfileModel> getBusinessProfile() async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<BusinessProfileModel> updateBusinessProfile(
    UpdateBusinessProfileRequest request,
  ) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<LogoUploadResponseModel> uploadLogo({
    required List<int> bytes,
    required String filename,
  }) async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }

  @override
  Future<BusinessProfileModel> removeLogo() async {
    if (exceptionToThrow != null) throw exceptionToThrow!;
    throw UnimplementedError();
  }
}

void main() {
  late MockErrorSettingsApi mockApi;
  late SettingsRepository repository;

  setUp(() {
    mockApi = MockErrorSettingsApi();
    repository = SettingsRepository(mockApi);
  });

  const sampleUpdateRequest = UpdateBusinessProfileRequest(
    businessName: 'E6 Car Spa',
    addressLine1: '36, Geetha Nagar',
    city: 'Erode',
    state: 'Tamil Nadu',
    postalCode: '638011',
    phone: '+91 9578749449',
    email: 'e6carspaerd@gmail.com',
  );

  group('SettingsRepository Additional Error Boundary Tests', () {
    test('getBusinessProfile maps 401 Unauthorized to UnauthorizedException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/settings/business'),
        response: Response(
          requestOptions: RequestOptions(path: '/settings/business'),
          statusCode: 401,
          data: {'error': 'Session expired. Please log in again.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getBusinessProfile(),
        throwsA(isA<UnauthorizedException>()),
      );
    });

    test('getBusinessProfile maps 404 Not Found to NotFoundException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/settings/business'),
        response: Response(
          requestOptions: RequestOptions(path: '/settings/business'),
          statusCode: 404,
          data: {'error': 'Business profile not found.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getBusinessProfile(),
        throwsA(isA<NotFoundException>()),
      );
    });

    test('updateBusinessProfile maps 409 Conflict to ConflictException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/settings/business'),
        response: Response(
          requestOptions: RequestOptions(path: '/settings/business'),
          statusCode: 409,
          data: {'error': 'Profile was modified concurrently by another user.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.updateBusinessProfile(sampleUpdateRequest),
        throwsA(isA<ConflictException>().having(
          (e) => e.message,
          'message',
          contains('Profile was modified concurrently'),
        )),
      );
    });

    test('uploadLogo maps 500 Server Error to ServerException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/settings/business/logo'),
        response: Response(
          requestOptions: RequestOptions(path: '/settings/business/logo'),
          statusCode: 500,
          data: {'error': 'File storage write error occurred.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.uploadLogo(bytes: [1, 2, 3], filename: 'logo.png'),
        throwsA(isA<ServerException>()),
      );
    });

    test('updateBusinessProfile maps connection timeout to NetworkException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/settings/business'),
        type: DioExceptionType.connectionTimeout,
      );

      expect(
        () => repository.updateBusinessProfile(sampleUpdateRequest),
        throwsA(isA<NetworkException>().having(
          (e) => e.message,
          'message',
          contains('Connection timeout'),
        )),
      );
    });

    test('removeLogo maps connection error to NetworkException', () async {
      mockApi.exceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/settings/business/logo'),
        type: DioExceptionType.connectionError,
      );

      expect(
        () => repository.removeLogo(),
        throwsA(isA<NetworkException>()),
      );
    });
  });
}
