import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/dio_client.dart';
import '../models/whatsapp_models.dart';

final whatsAppRepositoryProvider = Provider<WhatsAppRepository>((ref) {
  return WhatsAppRepository(ref.watch(dioProvider));
});

/// The company's WhatsApp settings, templates and message history, with server errors turned into readable messages.
class WhatsAppRepository {
  final Dio _dio;

  WhatsAppRepository(this._dio);

  static const _base = '/settings/whatsapp';

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<WhatsAppConfig> getConfig() => _guard(() async {
    final r = await _dio.get(_base);
    return WhatsAppConfig.fromJson(r.data as Map<String, dynamic>);
  });

  Future<WhatsAppConfig> saveConfig(WhatsAppConfigInput input) =>
      _guard(() async {
        final r = await _dio.put(_base, data: input.toJson());
        return WhatsAppConfig.fromJson(r.data as Map<String, dynamic>);
      });

  /// Checks the connection with what was typed, or with the saved details when the fields are left blank.
  Future<WhatsAppActionResult> testConnection({
    String? phoneNumberId,
    String? businessAccountId,
    String? graphApiVersion,
    String? accessToken,
  }) => _guard(() async {
    String? clean(String? v) =>
        (v == null || v.trim().isEmpty) ? null : v.trim();
    final r = await _dio.post(
      '$_base/test',
      data: {
        'phoneNumberId': clean(phoneNumberId),
        'businessAccountId': clean(businessAccountId),
        'graphApiVersion': clean(graphApiVersion),
        'accessToken': clean(accessToken),
      },
    );
    return WhatsAppActionResult.fromJson(r.data as Map<String, dynamic>);
  });

  Future<WhatsAppActionResult> sendTestMessage({
    required String templateName,
    required String languageCode,
    required String recipientPhoneNumber,
    List<String> parameters = const [],
  }) => _guard(() async {
    final r = await _dio.post(
      '$_base/test-message',
      data: {
        'templateName': templateName.trim(),
        'languageCode': languageCode.trim(),
        'recipientPhoneNumber': recipientPhoneNumber.trim(),
        'parameters': parameters,
      },
    );
    return WhatsAppActionResult.fromJson(r.data as Map<String, dynamic>);
  });

  Future<ManagedTemplates> getManagedTemplates() => _guard(() async {
    final r = await _dio.get('$_base/managed-templates');
    return ManagedTemplates.fromJson(r.data as Map<String, dynamic>);
  });

  Future<WhatsAppActionResult> provisionManagedTemplates() => _guard(() async {
    final r = await _dio.post('$_base/managed-templates/provision');
    return WhatsAppActionResult.fromJson(r.data as Map<String, dynamic>);
  });

  Future<WhatsAppActionResult> activateManagedTemplates() => _guard(() async {
    final r = await _dio.post('$_base/managed-templates/activate');
    return WhatsAppActionResult.fromJson(r.data as Map<String, dynamic>);
  });

  Future<List<WhatsAppUsageMonth>> getUsage({int months = 6}) =>
      _guard(() async {
        final r = await _dio.get(
          '$_base/usage',
          queryParameters: {'months': months},
        );
        final list =
            (r.data as Map<String, dynamic>)['months'] as List<dynamic>? ?? [];
        return list
            .map((e) => WhatsAppUsageMonth.fromJson(e as Map<String, dynamic>))
            .toList();
      });

  /// Failed and skipped messages. [status] is "failed", "skipped", or null for both.
  Future<WhatsAppLogPage> getMessages({
    String? status,
    int? year,
    int? month,
    int page = 1,
    int pageSize = 15,
  }) => _guard(() async {
    final r = await _dio.get(
      '$_base/messages',
      queryParameters: {
        'status': ?status,
        'year': ?year,
        'month': ?month,
        'page': page,
        'pageSize': pageSize,
      },
    );
    return WhatsAppLogPage.fromJson(r.data as Map<String, dynamic>);
  });
}
