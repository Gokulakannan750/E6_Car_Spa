import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../config/app_config.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/app_environment.dart';
import '../../../../core/utils/server_address.dart';

/// Asks the server at [baseUrl] whether it is up. Returns null when it answers, otherwise a message to show.
typedef ServerHealthCheck = Future<String?> Function(String baseUrl);

Future<String?> _defaultHealthCheck(String baseUrl) async {
  try {
    final dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 8),
        validateStatus: (_) => true,
      ),
    );
    final response = await dio.get('/health');
    final code = response.statusCode ?? 0;
    if (code >= 200 && code < 300) return null;
    return 'The server answered, but not as expected (code $code). Check the address.';
  } on DioException catch (e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'The server did not answer in time.';
    }
    return 'Could not reach the server. Check the address and your internet connection.';
  } catch (_) {
    return 'Could not reach the server.';
  }
}

final serverHealthCheckProvider = Provider<ServerHealthCheck>(
  (ref) => _defaultHealthCheck,
);

/// Lets a company point this device at its own server. Shown from the sign-in screen, because that is where it matters:
/// before anyone has signed in.
class ServerSettingsDialog extends ConsumerStatefulWidget {
  const ServerSettingsDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showDialog<void>(
      context: context,
      builder: (_) => const ServerSettingsDialog(),
    );
  }

  @override
  ConsumerState<ServerSettingsDialog> createState() =>
      _ServerSettingsDialogState();
}

class _ServerSettingsDialogState extends ConsumerState<ServerSettingsDialog> {
  late final TextEditingController _controller = TextEditingController(
    text: AppEnvironment.serverOverride ?? '',
  );
  bool _busy = false;
  String? _error;
  String? _ok;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  ServerAddress _parse() => ServerAddress.parse(
    _controller.text,
    allowHttp: AppEnvironment.isDevelopment,
  );

  Future<void> _test() async {
    final address = _parse();
    if (!address.isValid) {
      setState(() {
        _error = address.error;
        _ok = null;
      });
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _ok = null;
    });
    final problem = await ref.read(serverHealthCheckProvider)(address.url!);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _error = problem;
      _ok = problem == null ? 'Connected to ${address.url}' : null;
    });
  }

  Future<void> _save() async {
    final address = _parse();
    if (!address.isValid) {
      setState(() {
        _error = address.error;
        _ok = null;
      });
      return;
    }
    setState(() => _busy = true);
    final problem = await ref.read(serverHealthCheckProvider)(address.url!);
    if (!mounted) return;
    if (problem != null) {
      setState(() {
        _busy = false;
        _error = '$problem Nothing was changed.';
        _ok = null;
      });
      return;
    }
    await AppConfig.setApiBaseUrl(address.url!);
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _useBuiltIn() async {
    await AppConfig.clearApiBaseUrl();
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Server settings'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Using now: ${AppEnvironment.apiBaseUrl}',
              key: const Key('server_current'),
              style: AppTextStyles.caption.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              key: const Key('server_address_field'),
              controller: _controller,
              enabled: !_busy,
              keyboardType: TextInputType.url,
              autocorrect: false,
              decoration: const InputDecoration(
                labelText: 'Server address',
                hintText: 'https://your-company.example.com',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  _error!,
                  key: const Key('server_error'),
                  style: AppTextStyles.bodySmall.copyWith(
                    color: AppColors.error,
                  ),
                ),
              ),
            if (_ok != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  _ok!,
                  key: const Key('server_ok'),
                  style: AppTextStyles.bodySmall.copyWith(
                    color: AppColors.success,
                  ),
                ),
              ),
          ],
        ),
      ),
      actions: [
        if (AppEnvironment.serverOverride != null)
          TextButton(
            key: const Key('server_reset'),
            onPressed: _busy ? null : _useBuiltIn,
            child: const Text('Use built-in'),
          ),
        TextButton(
          key: const Key('server_test'),
          onPressed: _busy ? null : _test,
          child: const Text('Test'),
        ),
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          key: const Key('server_save'),
          onPressed: _busy ? null : _save,
          child: _busy
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Save'),
        ),
      ],
    );
  }
}
