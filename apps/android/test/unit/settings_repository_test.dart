import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/settings/data/settings_api.dart';
import 'package:e6_car_spa/features/settings/data/settings_repository.dart';
import 'package:e6_car_spa/features/settings/models/business_profile_model.dart';
import 'package:e6_car_spa/features/settings/models/update_business_profile_request.dart';
import 'package:e6_car_spa/features/settings/models/logo_upload_response.dart';

class MockSettingsApi extends SettingsApi {
  MockSettingsApi() : super(Dio());

  BusinessProfileModel? profileToReturn;
  LogoUploadResponseModel? logoUploadToReturn;
  DioException? dioExceptionToThrow;
  Exception? exceptionToThrow;

  @override
  Future<BusinessProfileModel> getBusinessProfile() async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    if (exceptionToThrow != null) throw exceptionToThrow!;
    return profileToReturn!;
  }

  @override
  Future<BusinessProfileModel> updateBusinessProfile(
    UpdateBusinessProfileRequest request,
  ) async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    if (exceptionToThrow != null) throw exceptionToThrow!;
    return profileToReturn!;
  }

  @override
  Future<LogoUploadResponseModel> uploadLogo({
    required List<int> bytes,
    required String filename,
  }) async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    if (exceptionToThrow != null) throw exceptionToThrow!;
    return logoUploadToReturn!;
  }

  @override
  Future<BusinessProfileModel> removeLogo() async {
    if (dioExceptionToThrow != null) throw dioExceptionToThrow!;
    if (exceptionToThrow != null) throw exceptionToThrow!;
    return profileToReturn!;
  }
}

void main() {
  late MockSettingsApi mockApi;
  late SettingsRepository repository;

  final sampleProfile = BusinessProfileModel(
    id: '3c7ce68c-0e4f-4514-897b-fa62c3cc99be',
    businessName: 'E6 Car Spa',
    addressLine1: '36, Geetha Nagar',
    city: 'Erode',
    state: 'Tamil Nadu',
    postalCode: '638011',
    phone: '+91 9578749449',
    email: 'e6carspaerd@gmail.com',
    gstin: '33AAAAA0000A1Z5',
    invoicePrefix: 'INV',
  );

  setUp(() {
    mockApi = MockSettingsApi();
    repository = SettingsRepository(mockApi);
  });

  group('SettingsRepository Tests', () {
    test('getBusinessProfile returns profile on success', () async {
      mockApi.profileToReturn = sampleProfile;

      final result = await repository.getBusinessProfile();

      expect(result.businessName, 'E6 Car Spa');
      expect(result.city, 'Erode');
      expect(result.phone, '+91 9578749449');
    });

    test('updateBusinessProfile returns updated profile on success', () async {
      final updatedProfile = sampleProfile.copyWith(businessName: 'E6 Auto Spa');
      mockApi.profileToReturn = updatedProfile;

      final request = UpdateBusinessProfileRequest(
        businessName: 'E6 Auto Spa',
        addressLine1: '36, Geetha Nagar',
        city: 'Erode',
        state: 'Tamil Nadu',
        postalCode: '638011',
        phone: '+91 9578749449',
        email: 'e6carspaerd@gmail.com',
      );

      final result = await repository.updateBusinessProfile(request);

      expect(result.businessName, 'E6 Auto Spa');
    });

    test('uploadLogo returns upload response on success', () async {
      mockApi.logoUploadToReturn = LogoUploadResponseModel(
        logoUrl: '/uploads/logos/e6-logo.png',
        profile: sampleProfile.copyWith(logoPath: '/uploads/logos/e6-logo.png'),
      );

      final result = await repository.uploadLogo(
        bytes: [1, 2, 3],
        filename: 'logo.png',
      );

      expect(result.logoUrl, '/uploads/logos/e6-logo.png');
      expect(result.profile.logoPath, '/uploads/logos/e6-logo.png');
    });

    test('removeLogo returns profile without logo', () async {
      mockApi.profileToReturn = sampleProfile.copyWith(logoPath: null);

      final result = await repository.removeLogo();

      expect(result.logoPath, isNull);
    });

    test('rethrows ApiException on DioException 400 Bad Request', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/settings/business'),
        response: Response(
          requestOptions: RequestOptions(path: '/settings/business'),
          statusCode: 400,
          data: {'message': 'Invalid Indian GSTIN structure.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getBusinessProfile(),
        throwsA(isA<ApiException>().having(
          (e) => e.message,
          'message',
          contains('Invalid Indian GSTIN structure.'),
        )),
      );
    });

    test('rethrows ApiException on DioException 403 Forbidden', () async {
      mockApi.dioExceptionToThrow = DioException(
        requestOptions: RequestOptions(path: '/settings/business'),
        response: Response(
          requestOptions: RequestOptions(path: '/settings/business'),
          statusCode: 403,
          data: {'message': 'User does not have required permissions.'},
        ),
        type: DioExceptionType.badResponse,
      );

      expect(
        () => repository.getBusinessProfile(),
        throwsA(isA<ApiException>()),
      );
    });
  });
}
