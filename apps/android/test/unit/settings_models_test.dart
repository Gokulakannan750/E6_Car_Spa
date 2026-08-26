import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/settings/models/business_profile_model.dart';
import 'package:e6_car_spa/features/settings/models/update_business_profile_request.dart';
import 'package:e6_car_spa/features/settings/models/logo_upload_response.dart';

void main() {
  group('BusinessProfileModel Tests', () {
    final sampleJson = {
      'id': '3c7ce68c-0e4f-4514-897b-fa62c3cc99be',
      'businessName': 'E6 Car Spa',
      'addressLine1': '36, Geetha Nagar Main Road',
      'addressLine2': 'Behind Sakthi Mahal, Perundurai Road',
      'city': 'Erode',
      'state': 'Tamil Nadu',
      'postalCode': '638011',
      'phone': '+91 9578749449',
      'email': 'e6carspaerd@gmail.com',
      'gstin': '33AAAAA0000A1Z5',
      'logoPath': '/uploads/logos/e6-logo.png',
      'invoicePrefix': 'INV',
      'termsAndConditions': 'Standard terms apply',
      'createdAt': '2026-08-24T07:37:54.522876Z',
      'updatedAt': '2026-08-26T08:34:38.4076445Z',
    };

    test('fromJson deserializes all fields accurately', () {
      final model = BusinessProfileModel.fromJson(sampleJson);

      expect(model.id, '3c7ce68c-0e4f-4514-897b-fa62c3cc99be');
      expect(model.businessName, 'E6 Car Spa');
      expect(model.addressLine1, '36, Geetha Nagar Main Road');
      expect(model.addressLine2, 'Behind Sakthi Mahal, Perundurai Road');
      expect(model.city, 'Erode');
      expect(model.state, 'Tamil Nadu');
      expect(model.postalCode, '638011');
      expect(model.phone, '+91 9578749449');
      expect(model.email, 'e6carspaerd@gmail.com');
      expect(model.gstin, '33AAAAA0000A1Z5');
      expect(model.logoPath, '/uploads/logos/e6-logo.png');
      expect(model.invoicePrefix, 'INV');
      expect(model.termsAndConditions, 'Standard terms apply');
      expect(model.createdAt, isNotNull);
      expect(model.updatedAt, isNotNull);
    });

    test('fullAddress formats correctly with and without addressLine2', () {
      final modelWith2 = BusinessProfileModel.fromJson(sampleJson);
      expect(
        modelWith2.fullAddress,
        '36, Geetha Nagar Main Road, Behind Sakthi Mahal, Perundurai Road, Erode, Tamil Nadu - 638011',
      );

      final modelWithout2 = modelWith2.copyWith(addressLine2: '');
      expect(
        modelWithout2.fullAddress,
        '36, Geetha Nagar Main Road, Erode, Tamil Nadu - 638011',
      );
    });

    test('toJson produces valid serializable map', () {
      final model = BusinessProfileModel.fromJson(sampleJson);
      final json = model.toJson();

      expect(json['businessName'], 'E6 Car Spa');
      expect(json['city'], 'Erode');
      expect(json['gstin'], '33AAAAA0000A1Z5');
    });

    test('copyWith updates specified fields only', () {
      final model = BusinessProfileModel.fromJson(sampleJson);
      final updated = model.copyWith(businessName: 'E6 Detail Hub');

      expect(updated.businessName, 'E6 Detail Hub');
      expect(updated.city, 'Erode');
      expect(updated.id, model.id);
    });
  });

  group('UpdateBusinessProfileRequest Tests', () {
    test('toJson trims and normalizes values', () {
      const request = UpdateBusinessProfileRequest(
        businessName: '  E6 Car Spa  ',
        addressLine1: '  36, Geetha Nagar  ',
        addressLine2: '   ',
        city: '  Erode  ',
        state: '  Tamil Nadu  ',
        postalCode: '  638011  ',
        phone: '  9578749449  ',
        email: '  E6@GMAIL.COM  ',
        gstin: '  33aaaaa0000a1z5  ',
        invoicePrefix: '  inv  ',
        termsAndConditions: '  Net 7 days  ',
      );

      final json = request.toJson();

      expect(json['businessName'], 'E6 Car Spa');
      expect(json['addressLine1'], '36, Geetha Nagar');
      expect(json['addressLine2'], isNull);
      expect(json['city'], 'Erode');
      expect(json['state'], 'Tamil Nadu');
      expect(json['postalCode'], '638011');
      expect(json['phone'], '9578749449');
      expect(json['email'], 'e6@gmail.com');
      expect(json['gstin'], '33AAAAA0000A1Z5');
      expect(json['invoicePrefix'], 'INV');
      expect(json['termsAndConditions'], 'Net 7 days');
    });

    test('toJson defaults empty invoice prefix to INV', () {
      const request = UpdateBusinessProfileRequest(
        businessName: 'E6',
        addressLine1: 'Road',
        city: 'Erode',
        state: 'TN',
        postalCode: '638011',
        phone: '1234567890',
        email: 'a@b.com',
        invoicePrefix: '',
      );

      final json = request.toJson();
      expect(json['invoicePrefix'], 'INV');
    });
  });

  group('LogoUploadResponseModel Tests', () {
    test('fromJson deserializes properly', () {
      final json = {
        'logoUrl': '/uploads/logos/logo_123.png',
        'profile': {
          'id': '3c7ce68c-0e4f-4514-897b-fa62c3cc99be',
          'businessName': 'E6 Car Spa',
          'addressLine1': '36, Geetha Nagar',
          'city': 'Erode',
          'state': 'Tamil Nadu',
          'postalCode': '638011',
          'phone': '9578749449',
          'email': 'e6@gmail.com',
          'logoPath': '/uploads/logos/logo_123.png',
        },
      };

      final response = LogoUploadResponseModel.fromJson(json);
      expect(response.logoUrl, '/uploads/logos/logo_123.png');
      expect(response.profile.businessName, 'E6 Car Spa');
      expect(response.profile.logoPath, '/uploads/logos/logo_123.png');
    });
  });
}
