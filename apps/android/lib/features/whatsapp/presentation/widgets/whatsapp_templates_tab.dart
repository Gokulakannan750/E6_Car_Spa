import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_confirm_dialog.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../data/whatsapp_repository.dart';
import '../../models/whatsapp_models.dart';
import '../../providers/whatsapp_providers.dart';
import 'whatsapp_widgets.dart';

/// The standard message templates: create them on the company's WhatsApp account, follow Meta's approval, then switch
/// the app to use them.
class WhatsAppTemplatesTab extends ConsumerStatefulWidget {
  final bool canManage;

  const WhatsAppTemplatesTab({super.key, required this.canManage});

  @override
  ConsumerState<WhatsAppTemplatesTab> createState() =>
      _WhatsAppTemplatesTabState();
}

class _WhatsAppTemplatesTabState extends ConsumerState<WhatsAppTemplatesTab> {
  String? _busy;
  String? _notice;
  bool _noticeIsError = false;

  Color _colour(ManagedTemplate t) {
    switch (t.status.toUpperCase()) {
      case 'APPROVED':
        return AppColors.success;
      case 'PENDING':
      case 'IN_APPEAL':
        return const Color(0xFFD97706);
      case 'NOT_CREATED':
        return AppColors.textSecondary;
      default:
        return AppColors.error;
    }
  }

  Future<void> _run(
    String busy,
    Future<WhatsAppActionResult> Function() action,
  ) async {
    setState(() {
      _busy = busy;
      _notice = null;
    });
    try {
      final result = await action();
      if (!mounted) return;
      ref.invalidate(managedTemplatesProvider);
      ref.invalidate(whatsAppConfigProvider);
      setState(() {
        _notice = result.message;
        _noticeIsError = !result.isSuccess;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _notice = whatsAppErrorText(e);
          _noticeIsError = true;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _activate() async {
    final ok = await AppConfirmDialog.show(
      context: context,
      title: 'Use the standard templates?',
      message:
          'Invoice and receipt messages will use these templates from now on, replacing the template names in your settings.',
      confirmLabel: 'Switch',
    );
    if (ok != true) return;
    await _run(
      'activate',
      () => ref.read(whatsAppRepositoryProvider).activateManagedTemplates(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(managedTemplatesProvider);

    return data.when(
      loading: () => const AppLoadingState(message: 'Loading templates...'),
      error: (e, _) => AppErrorState(
        title: 'Could not load the templates',
        message: whatsAppErrorText(e),
        retryLabel: 'Retry',
        onRetry: () => ref.invalidate(managedTemplatesProvider),
      ),
      data: (t) => RefreshIndicator(
        onRefresh: () async => ref.refresh(managedTemplatesProvider.future),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Standard templates are the messages this app sends for invoices and receipts. Meta must approve them '
              'before they can be used.',
              style: AppTextStyles.bodySmall.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 12),
            if (!t.isSuccess && t.message.isNotEmpty)
              WhatsAppNotice(
                noticeKey: const Key('whatsapp_templates_unavailable'),
                text: t.message,
                isError: true,
              ),
            for (final template in t.templates)
              WhatsAppCard(
                cardKey: Key('whatsapp_template_${template.messageType}'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            template.purpose,
                            style: AppTextStyles.bodyMedium.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        WhatsAppStatusPill(
                          label: template.statusLabel,
                          colour: _colour(template),
                        ),
                      ],
                    ),
                    Text(
                      '${template.name} · ${template.language}',
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.textSecondary,
                        fontFamily: 'monospace',
                      ),
                    ),
                    if (template.isActive)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'In use',
                          style: AppTextStyles.caption.copyWith(
                            color: AppColors.success,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    if ((template.rejectedReason ?? '').isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          template.rejectedReason!,
                          style: AppTextStyles.bodySmall.copyWith(
                            color: AppColors.error,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            if (widget.canManage) ...[
              AppButton(
                key: const Key('whatsapp_provision'),
                label: 'Create the standard templates',
                icon: Icons.auto_awesome_rounded,
                variant: AppButtonVariant.secondary,
                fullWidth: true,
                isLoading: _busy == 'provision',
                onPressed: _busy != null
                    ? null
                    : () => _run(
                        'provision',
                        () => ref
                            .read(whatsAppRepositoryProvider)
                            .provisionManagedTemplates(),
                      ),
              ),
              const SizedBox(height: 8),
              AppButton(
                key: const Key('whatsapp_activate'),
                label: 'Use the standard templates',
                icon: Icons.check_rounded,
                fullWidth: true,
                isLoading: _busy == 'activate',
                onPressed: !t.canActivate || _busy != null ? null : _activate,
              ),
              if (!t.canActivate)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    'Available once every template is approved.',
                    key: const Key('whatsapp_activate_hint'),
                    style: AppTextStyles.caption.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
            ],
            if (_notice != null)
              WhatsAppNotice(
                noticeKey: const Key('whatsapp_templates_notice'),
                text: _notice!,
                isError: _noticeIsError,
              ),
          ],
        ),
      ),
    );
  }
}
