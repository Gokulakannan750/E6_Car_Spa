import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/app_screen_scaffold.dart';
import '../../data/franchise_repository.dart';
import '../../models/franchise_models.dart';
import '../../providers/franchise_providers.dart';
import '../widgets/franchise_widgets.dart';

/// Where the Owner of the invited company answers an invitation, or a request to see more, from the link a franchisor
/// sent. The server checks that the link belongs to the signed-in company; any other company gets the same
/// "not valid" answer as for a link that does not exist.
class FranchiseInviteScreen extends ConsumerStatefulWidget {
  final String token;

  const FranchiseInviteScreen({super.key, required this.token});

  @override
  ConsumerState<FranchiseInviteScreen> createState() =>
      _FranchiseInviteScreenState();
}

class _FranchiseInviteScreenState extends ConsumerState<FranchiseInviteScreen> {
  Set<String>? _allowed;
  String? _error;
  bool _saving = false;
  ({bool accepted, String partner, bool isRequest})? _done;

  Future<void> _answer(
    FranchiseLink link,
    bool accept,
    Set<String> ticked,
  ) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref
          .read(franchiseRepositoryProvider)
          .respondToInvite(
            widget.token,
            accept,
            accept ? ticked.toList() : const [],
          );
      ref.invalidate(franchiseAccessProvider);
      ref.invalidate(franchiseNetworkProvider);
      if (!mounted) return;
      setState(() {
        _done = (
          accepted: accept,
          partner: link.partnerName,
          isRequest: link.isActive,
        );
      });
    } catch (e) {
      if (mounted) setState(() => _error = franchiseErrorText(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final invite = ref.watch(franchiseInviteProvider(widget.token));

    return AppScreenScaffold(
      title: 'Franchise invitation',
      onBackPressed: () => context.go(AppRoutes.dashboard),
      actions: const [AppLogoutAction()],
      body: invite.when(
        loading: () => const AppLoadingState(),
        error: (e, _) => Padding(
          padding: const EdgeInsets.all(16),
          child: FranchiseCard(
            cardKey: const Key('franchise_invite_error'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'This link cannot be opened',
                  style: AppTextStyles.headingSmall,
                ),
                const SizedBox(height: 8),
                Text(franchiseErrorText(e), style: AppTextStyles.bodyMedium),
                const SizedBox(height: 8),
                Text(
                  'The link works only for the Owner of the company that was invited, once, before it expires. If '
                  'you are signed in as someone else, sign out and sign in as that Owner, or ask the sender for a '
                  'new link.',
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
        data: (link) {
          if (_done case final done?) {
            return Padding(
              padding: const EdgeInsets.all(16),
              child: FranchiseCard(
                cardKey: const Key('franchise_invite_done'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      done.accepted
                          ? 'Thank you, your answer was saved'
                          : 'You declined',
                      style: AppTextStyles.headingSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      done.accepted
                          ? '${done.partner} can now see only what you allowed.'
                          : done.isRequest
                          ? '${done.partner} was not given anything new.'
                          : '${done.partner} was not given access to anything.',
                      style: AppTextStyles.bodyMedium,
                    ),
                    if (done.accepted) ...[
                      const SizedBox(height: 8),
                      const Text(
                        'You can review or stop sharing at any time under Settings → Franchise Sharing.',
                      ),
                    ],
                    const SizedBox(height: 12),
                    AppButton(
                      key: const Key('franchise_invite_home'),
                      label: 'Go to the app',
                      onPressed: () => context.go(AppRoutes.dashboard),
                    ),
                  ],
                ),
              ),
            );
          }

          final isRequest = link.isActive;
          // What is being asked now: everything on a new invitation, only the new requests on an active link.
          final asked = franchiseScopeOptions
              .where(
                (o) => link.scopes.any(
                  (s) => s.scope == o.scope && (!isRequest || s.isRequested),
                ),
              )
              .toList();
          final ticked = _allowed ?? asked.map((o) => o.scope).toSet();

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              FranchiseCard(
                cardKey: const Key('franchise_invite_card'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isRequest
                          ? 'A request to see more'
                          : 'Franchise invitation',
                      style: AppTextStyles.headingSmall,
                    ),
                    Text(
                      'From ${link.partnerName} (company code ${link.partnerCodeHint})',
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      isRequest
                          ? '${link.partnerName}, which already franchises your company, is asking to see more. Tick '
                                'only what you are happy to share.'
                          : '${link.partnerName} invites you to join their franchise network. If you accept, they '
                                'can see only what you allow below. You can switch any of it off later. The '
                                'invitation expires on ${franchiseDate(link.expiresAt)}.',
                      style: AppTextStyles.bodyMedium,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'They are asking to see:',
                      style: AppTextStyles.labelMedium.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    FranchiseScopePicker(
                      keyPrefix: 'franchise_invite_scope',
                      options: asked,
                      selected: ticked,
                      onToggle: (scope) => setState(() {
                        final next = {...ticked};
                        if (!next.remove(scope)) next.add(scope);
                        _allowed = next;
                      }),
                    ),
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          _error!,
                          key: const Key('franchise_invite_error_text'),
                          style: AppTextStyles.bodySmall.copyWith(
                            color: AppColors.error,
                          ),
                        ),
                      ),
                    const SizedBox(height: 10),
                    AppButton(
                      key: const Key('franchise_invite_accept'),
                      label: isRequest ? 'Allow the ticked items' : 'Accept',
                      icon: Icons.check_rounded,
                      fullWidth: true,
                      isLoading: _saving,
                      onPressed: !isRequest && ticked.isEmpty
                          ? null
                          : () => _answer(link, true, ticked),
                    ),
                    const SizedBox(height: 8),
                    AppButton(
                      key: const Key('franchise_invite_decline'),
                      label: isRequest ? "Don't allow" : 'Decline',
                      variant: AppButtonVariant.secondary,
                      icon: Icons.close_rounded,
                      fullWidth: true,
                      onPressed: _saving
                          ? null
                          : () => _answer(link, false, ticked),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
