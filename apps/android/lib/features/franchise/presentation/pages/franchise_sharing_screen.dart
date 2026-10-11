import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_confirm_dialog.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/app_screen_scaffold.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../data/franchise_repository.dart';
import '../../models/franchise_models.dart';
import '../../providers/franchise_providers.dart';
import '../widgets/franchise_widgets.dart';

/// For a company that is a franchisee: who can see what about it, with a switch for each item and a way to end the
/// link. It is a small page in Settings, not a section of its own: a franchisee answers invitations through the link
/// it is sent.
class FranchiseSharingScreen extends ConsumerStatefulWidget {
  const FranchiseSharingScreen({super.key});

  @override
  ConsumerState<FranchiseSharingScreen> createState() =>
      _FranchiseSharingScreenState();
}

class _FranchiseSharingScreenState
    extends ConsumerState<FranchiseSharingScreen> {
  String? _notice;
  bool _noticeIsError = false;

  void _setNotice(String text, {bool error = false}) {
    if (!mounted) return;
    setState(() {
      _notice = text;
      _noticeIsError = error;
    });
  }

  Future<void> _run(Future<void> Function() action, {String? success}) async {
    setState(() => _notice = null);
    try {
      await action();
      ref.invalidate(franchiseNetworkProvider);
      ref.invalidate(franchiseAccessProvider);
      if (success != null) _setNotice(success);
    } catch (e) {
      _setNotice(franchiseErrorText(e), error: true);
    }
  }

  Future<void> _answerInvitation() async {
    final controller = TextEditingController();
    String? error;
    final token = await showDialog<String>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Answer an invitation'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Paste the link you were sent. Only the Owner of the invited company can answer it.',
              ),
              const SizedBox(height: 10),
              TextField(
                key: const Key('franchise_paste_field'),
                controller: controller,
                maxLines: 3,
                decoration: InputDecoration(
                  border: const OutlineInputBorder(),
                  hintText: 'Invitation link',
                  errorText: error,
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              key: const Key('franchise_paste_open'),
              onPressed: () {
                final parsed = FranchiseRepository.tokenFromPastedText(
                  controller.text,
                );
                if (parsed == null) {
                  setDialogState(
                    () => error = 'That is not an invitation link.',
                  );
                  return;
                }
                Navigator.of(dialogContext).pop(parsed);
              },
              child: const Text('Open'),
            ),
          ],
        ),
      ),
    );
    controller.dispose();
    if (token != null && mounted) {
      context.push('/franchise-invite/$token');
    }
  }

  @override
  Widget build(BuildContext context) {
    final network = ref.watch(franchiseNetworkProvider);
    final user = ref.watch(currentUserProvider);
    final canManage = user?.hasPermission('franchise.manage') ?? false;

    return AppScreenScaffold(
      title: 'Franchise Sharing',
      onBackPressed: () => context.go(AppRoutes.settings),
      actions: const [AppLogoutAction()],
      body: network.when(
        loading: () => const AppLoadingState(),
        error: (e, _) => AppErrorState(
          title: 'Could not load franchise sharing',
          message: franchiseErrorText(e),
          retryLabel: 'Retry',
          onRetry: () => ref.invalidate(franchiseNetworkProvider),
        ),
        data: (data) {
          final links = data.franchisors.where((l) => l.isActive).toList();
          final waiting = data.franchisors.where((l) => l.isPending).length;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                'The companies that franchise you, and exactly what each can see about your company. Switch anything '
                'off at any time.',
                style: AppTextStyles.bodySmall.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 12),
              if (_notice != null)
                FranchiseNotice(text: _notice!, isError: _noticeIsError),
              if (canManage)
                Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton.icon(
                    key: const Key('franchise_answer_invitation'),
                    onPressed: _answerInvitation,
                    icon: const Icon(Icons.mark_email_read_outlined, size: 18),
                    label: const Text('Answer an invitation'),
                  ),
                ),
              const SizedBox(height: 12),
              if (waiting > 0)
                Container(
                  key: const Key('franchise_waiting_invitation'),
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.warningLight,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    'You have an invitation waiting. Open the link you were sent to answer it.',
                    style: AppTextStyles.bodySmall.copyWith(
                      color: AppColors.warningDark,
                    ),
                  ),
                ),
              if (links.isEmpty)
                Text(
                  'No company franchises you at the moment, so nothing is being shared.',
                  key: const Key('franchise_nobody'),
                  style: AppTextStyles.bodySmall.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              for (final link in links)
                _SharingCard(
                  link: link,
                  canManage: canManage,
                  onToggle: (scope, grant) => _run(
                    () => ref
                        .read(franchiseRepositoryProvider)
                        .decideScope(link.id, scope, grant),
                  ),
                  onEnd: () async {
                    final ok = await AppConfirmDialog.show(
                      context: context,
                      title: 'End franchise link',
                      message:
                          'End the franchise link with ${link.partnerName}? They will stop seeing your figures at once.',
                      confirmLabel: 'End link',
                      isDestructive: true,
                    );
                    if (ok == true) {
                      await _run(
                        () => ref
                            .read(franchiseRepositoryProvider)
                            .endLink(link.id),
                        success: 'Franchise link ended.',
                      );
                    }
                  },
                ),
            ],
          );
        },
      ),
    );
  }
}

class _SharingCard extends StatelessWidget {
  final FranchiseLink link;
  final bool canManage;
  final void Function(String scope, bool grant) onToggle;
  final Future<void> Function() onEnd;

  const _SharingCard({
    required this.link,
    required this.canManage,
    required this.onToggle,
    required this.onEnd,
  });

  @override
  Widget build(BuildContext context) {
    return FranchiseCard(
      cardKey: Key('franchise_sharing_${link.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FranchisePartnerHeader(link: link),
          const SizedBox(height: 10),
          Text(
            'What ${link.partnerName} can see about your company:',
            style: AppTextStyles.bodySmall.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          for (final scope in link.scopes)
            SwitchListTile(
              key: Key('franchise_share_switch_${scope.scope}'),
              dense: true,
              contentPadding: EdgeInsets.zero,
              value: scope.isGranted,
              onChanged: canManage && !scope.isRequested
                  ? (value) => onToggle(scope.scope, value)
                  : null,
              title: Text(scope.label, style: AppTextStyles.bodySmall),
              subtitle: scope.isRequested
                  ? Text(
                      'Asked for. Open the link you were sent to answer.',
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.warning,
                        fontWeight: FontWeight.w700,
                      ),
                    )
                  : null,
            ),
          if (canManage)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                key: const Key('franchise_share_end'),
                onPressed: onEnd,
                icon: const Icon(Icons.link_off_rounded, size: 18),
                label: const Text('End link'),
              ),
            ),
        ],
      ),
    );
  }
}
