import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/format_utils.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../data/whatsapp_repository.dart';
import '../../models/whatsapp_models.dart';
import '../../providers/whatsapp_providers.dart';
import 'whatsapp_widgets.dart';

/// The Meta connection details, the notification switches, a connection check and a test message.
class WhatsAppConnectionTab extends ConsumerStatefulWidget {
  final bool canManage;

  const WhatsAppConnectionTab({super.key, required this.canManage});

  @override
  ConsumerState<WhatsAppConnectionTab> createState() =>
      _WhatsAppConnectionTabState();
}

class _WhatsAppConnectionTabState extends ConsumerState<WhatsAppConnectionTab> {
  final _phoneId = TextEditingController();
  final _wabaId = TextEditingController();
  final _version = TextEditingController();
  final _appId = TextEditingController();
  final _token = TextEditingController();
  final _invoiceTemplate = TextEditingController();
  final _invoiceLanguage = TextEditingController();
  final _paymentTemplate = TextEditingController();
  final _paymentLanguage = TextEditingController();
  final _testTemplate = TextEditingController();
  final _testLanguage = TextEditingController(text: 'en');
  final _testPhone = TextEditingController();
  final _testParameters = TextEditingController();

  bool _filled = false;
  bool _enabled = false;
  bool _invoiceOn = true;
  bool _paymentOn = true;
  bool _saving = false;
  bool _checking = false;
  bool _sending = false;
  String? _saveNotice;
  bool _saveIsError = false;
  String? _checkNotice;
  bool _checkIsError = false;
  String? _testNotice;
  bool _testIsError = false;

  List<TextEditingController> get _all => [
    _phoneId,
    _wabaId,
    _version,
    _appId,
    _token,
    _invoiceTemplate,
    _invoiceLanguage,
    _paymentTemplate,
    _paymentLanguage,
    _testTemplate,
    _testLanguage,
    _testPhone,
    _testParameters,
  ];

  @override
  void dispose() {
    for (final c in _all) {
      c.dispose();
    }
    super.dispose();
  }

  /// Fills the form once from the saved settings, so a refresh never overwrites what is being typed.
  void _fill(WhatsAppConfig c) {
    if (_filled) return;
    _filled = true;
    _enabled = c.isEnabled;
    _invoiceOn = c.invoiceNotificationsEnabled;
    _paymentOn = c.paymentCompletedNotificationsEnabled;
    _phoneId.text = c.phoneNumberId;
    _wabaId.text = c.businessAccountId;
    _version.text = c.graphApiVersion;
    _appId.text = c.metaAppId ?? '';
    _invoiceTemplate.text = c.invoiceTemplateName;
    _invoiceLanguage.text = c.invoiceTemplateLanguage;
    _paymentTemplate.text = c.paymentCompletedTemplateName;
    _paymentLanguage.text = c.paymentCompletedTemplateLanguage;
    _testTemplate.text = c.invoiceTemplateName;
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _saveNotice = null;
    });
    try {
      final saved = await ref
          .read(whatsAppRepositoryProvider)
          .saveConfig(
            WhatsAppConfigInput(
              isEnabled: _enabled,
              phoneNumberId: _phoneId.text,
              businessAccountId: _wabaId.text,
              graphApiVersion: _version.text,
              accessToken: _token.text,
              metaAppId: _appId.text,
              invoiceNotificationsEnabled: _invoiceOn,
              paymentCompletedNotificationsEnabled: _paymentOn,
              invoiceTemplateName: _invoiceTemplate.text,
              invoiceTemplateLanguage: _invoiceLanguage.text,
              paymentCompletedTemplateName: _paymentTemplate.text,
              paymentCompletedTemplateLanguage: _paymentLanguage.text,
            ),
          );
      if (!mounted) return;
      _token.clear();
      ref.invalidate(whatsAppConfigProvider);
      setState(() {
        _saveNotice = saved.hasAccessToken
            ? 'WhatsApp settings saved.'
            : 'Settings saved. Add the access token to start sending.';
        _saveIsError = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _saveNotice = whatsAppErrorText(e);
          _saveIsError = true;
        });
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _check() async {
    setState(() {
      _checking = true;
      _checkNotice = null;
    });
    try {
      final result = await ref
          .read(whatsAppRepositoryProvider)
          .testConnection(
            phoneNumberId: _phoneId.text,
            businessAccountId: _wabaId.text,
            graphApiVersion: _version.text,
            accessToken: _token.text,
          );
      if (!mounted) return;
      ref.invalidate(whatsAppConfigProvider);
      setState(() {
        _checkNotice = result.details == null || result.details!.isEmpty
            ? result.message
            : '${result.message}\n${result.details}';
        _checkIsError = !result.isSuccess;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _checkNotice = whatsAppErrorText(e);
          _checkIsError = true;
        });
      }
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  Future<void> _sendTest() async {
    setState(() {
      _sending = true;
      _testNotice = null;
    });
    try {
      final result = await ref
          .read(whatsAppRepositoryProvider)
          .sendTestMessage(
            templateName: _testTemplate.text,
            languageCode: _testLanguage.text,
            recipientPhoneNumber: _testPhone.text,
            parameters: _testParameters.text
                .split('\n')
                .map((l) => l.trim())
                .where((l) => l.isNotEmpty)
                .toList(),
          );
      if (!mounted) return;
      setState(() {
        _testNotice = result.message;
        _testIsError = !result.isSuccess;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _testNotice = whatsAppErrorText(e);
          _testIsError = true;
        });
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Widget _field(
    String key,
    String label,
    TextEditingController controller, {
    bool obscure = false,
    String? helper,
    int maxLines = 1,
    TextInputType? keyboard,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        key: Key(key),
        controller: controller,
        enabled: widget.canManage,
        obscureText: obscure,
        maxLines: obscure ? 1 : maxLines,
        keyboardType: keyboard,
        autocorrect: false,
        enableSuggestions: !obscure,
        decoration: InputDecoration(
          labelText: label,
          helperText: helper,
          isDense: true,
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }

  Color _healthColour(WhatsAppConfig c) {
    if (c.isHealthy) return AppColors.success;
    final s = c.healthStatus.toLowerCase();
    return s == 'notconfigured' ? AppColors.textSecondary : AppColors.error;
  }

  @override
  Widget build(BuildContext context) {
    final config = ref.watch(whatsAppConfigProvider);

    return config.when(
      loading: () => const AppLoadingState(message: 'Loading WhatsApp...'),
      error: (e, _) => AppErrorState(
        title: 'Could not load WhatsApp settings',
        message: whatsAppErrorText(e),
        retryLabel: 'Retry',
        onRetry: () => ref.invalidate(whatsAppConfigProvider),
      ),
      data: (c) {
        _fill(c);
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            WhatsAppCard(
              cardKey: const Key('whatsapp_health_card'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text('Connection', style: AppTextStyles.headingSmall),
                      const SizedBox(width: 8),
                      WhatsAppStatusPill(
                        label: c.healthStatus,
                        colour: _healthColour(c),
                      ),
                    ],
                  ),
                  if (c.lastCheckedAt != null)
                    Text(
                      'Last checked ${FormatUtils.formatDateTime(c.lastCheckedAt!)}',
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  if ((c.lastErrorMessage ?? '').isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        c.lastErrorMessage!,
                        key: const Key('whatsapp_last_error'),
                        style: AppTextStyles.bodySmall.copyWith(
                          color: AppColors.error,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            WhatsAppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Meta connection', style: AppTextStyles.headingSmall),
                  SwitchListTile(
                    key: const Key('whatsapp_enabled'),
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Send WhatsApp messages'),
                    value: _enabled,
                    onChanged: widget.canManage
                        ? (v) => setState(() => _enabled = v)
                        : null,
                  ),
                  _field('whatsapp_phone_id', 'Phone number ID', _phoneId),
                  _field(
                    'whatsapp_waba_id',
                    'WhatsApp Business Account ID',
                    _wabaId,
                  ),
                  _field(
                    'whatsapp_graph_version',
                    'Graph API version',
                    _version,
                  ),
                  _field('whatsapp_app_id', 'Meta App ID', _appId),
                  _field(
                    'whatsapp_token',
                    'Access token',
                    _token,
                    obscure: true,
                    helper: c.hasAccessToken
                        ? 'A token is saved. Leave blank to keep it.'
                        : 'No token saved yet.',
                  ),
                  if (widget.canManage) ...[
                    AppButton(
                      key: const Key('whatsapp_check'),
                      label: 'Check connection',
                      icon: Icons.wifi_tethering_rounded,
                      variant: AppButtonVariant.secondary,
                      fullWidth: true,
                      isLoading: _checking,
                      onPressed: _check,
                    ),
                    if (_checkNotice != null)
                      WhatsAppNotice(
                        noticeKey: const Key('whatsapp_check_notice'),
                        text: _checkNotice!,
                        isError: _checkIsError,
                      ),
                  ],
                ],
              ),
            ),
            WhatsAppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Automatic messages', style: AppTextStyles.headingSmall),
                  SwitchListTile(
                    key: const Key('whatsapp_invoice_on'),
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Send the invoice to the customer'),
                    value: _invoiceOn,
                    onChanged: widget.canManage
                        ? (v) => setState(() => _invoiceOn = v)
                        : null,
                  ),
                  _field(
                    'whatsapp_invoice_template',
                    'Invoice template name',
                    _invoiceTemplate,
                  ),
                  _field(
                    'whatsapp_invoice_language',
                    'Invoice template language',
                    _invoiceLanguage,
                  ),
                  SwitchListTile(
                    key: const Key('whatsapp_payment_on'),
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Send a receipt when payment is done'),
                    value: _paymentOn,
                    onChanged: widget.canManage
                        ? (v) => setState(() => _paymentOn = v)
                        : null,
                  ),
                  _field(
                    'whatsapp_payment_template',
                    'Receipt template name',
                    _paymentTemplate,
                  ),
                  _field(
                    'whatsapp_payment_language',
                    'Receipt template language',
                    _paymentLanguage,
                  ),
                  if (widget.canManage) ...[
                    AppButton(
                      key: const Key('whatsapp_save'),
                      label: 'Save settings',
                      icon: Icons.save_rounded,
                      fullWidth: true,
                      isLoading: _saving,
                      onPressed: _save,
                    ),
                    if (_saveNotice != null)
                      WhatsAppNotice(
                        noticeKey: const Key('whatsapp_save_notice'),
                        text: _saveNotice!,
                        isError: _saveIsError,
                      ),
                  ] else
                    Text(
                      'You can view these settings but not change them.',
                      key: const Key('whatsapp_read_only'),
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                ],
              ),
            ),
            if (widget.canManage)
              WhatsAppCard(
                cardKey: const Key('whatsapp_test_card'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Send a test message',
                      style: AppTextStyles.headingSmall,
                    ),
                    const SizedBox(height: 8),
                    _field(
                      'whatsapp_test_template',
                      'Template name',
                      _testTemplate,
                    ),
                    _field(
                      'whatsapp_test_language',
                      'Language code',
                      _testLanguage,
                    ),
                    _field(
                      'whatsapp_test_phone',
                      'Recipient WhatsApp number',
                      _testPhone,
                      keyboard: TextInputType.phone,
                    ),
                    _field(
                      'whatsapp_test_parameters',
                      'Template values (one per line)',
                      _testParameters,
                      maxLines: 3,
                    ),
                    AppButton(
                      key: const Key('whatsapp_send_test'),
                      label: 'Send test message',
                      icon: Icons.send_rounded,
                      variant: AppButtonVariant.secondary,
                      fullWidth: true,
                      isLoading: _sending,
                      onPressed: _sendTest,
                    ),
                    if (_testNotice != null)
                      WhatsAppNotice(
                        noticeKey: const Key('whatsapp_test_notice'),
                        text: _testNotice!,
                        isError: _testIsError,
                      ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}
