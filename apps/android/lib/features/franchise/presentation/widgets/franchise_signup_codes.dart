import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/format_utils.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../data/franchise_repository.dart';
import '../../models/franchise_models.dart';
import '../../providers/franchise_providers.dart';
import 'franchise_widgets.dart';

String _lifetimeText(int minutes) {
  if (minutes % 1440 == 0) {
    return '${minutes ~/ 1440} day${minutes == 1440 ? '' : 's'}';
  }
  if (minutes % 60 == 0) {
    return '${minutes ~/ 60} hour${minutes == 60 ? '' : 's'}';
  }
  return '$minutes minutes';
}

/// Franchise sign-up codes, for a new franchisee that has no Trovo company yet: the franchisor makes a code and sends
/// it; the franchisee enters it on Trovo's sign-up website, agrees to share the listed items, and is linked as soon as
/// its company is created. Hidden on a single-company server.
class FranchiseSignupCodesCard extends ConsumerStatefulWidget {
  final bool canManage;

  const FranchiseSignupCodesCard({super.key, required this.canManage});

  @override
  ConsumerState<FranchiseSignupCodesCard> createState() =>
      _FranchiseSignupCodesCardState();
}

class _FranchiseSignupCodesCardState
    extends ConsumerState<FranchiseSignupCodesCard> {
  final _labelController = TextEditingController();
  final Set<String> _scopes = {'financial_totals'};
  bool _busy = false;
  String? _error;
  CreatedFranchiseSignupCode? _made;
  bool _copied = false;

  @override
  void dispose() {
    _labelController.dispose();
    super.dispose();
  }

  Future<void> _make() async {
    setState(() {
      _busy = true;
      _error = null;
      _copied = false;
    });
    try {
      final label = _labelController.text.trim();
      final made = await ref
          .read(franchiseRepositoryProvider)
          .createSignupCode(_scopes.toList(), label.isEmpty ? null : label);
      ref.invalidate(franchiseSignupCodesProvider);
      if (!mounted) return;
      setState(() {
        _made = made;
        _labelController.clear();
      });
    } catch (e) {
      if (mounted) setState(() => _error = franchiseErrorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _withdraw(String id) async {
    setState(() => _error = null);
    try {
      await ref.read(franchiseRepositoryProvider).cancelSignupCode(id);
      ref.invalidate(franchiseSignupCodesProvider);
    } catch (e) {
      if (mounted) setState(() => _error = franchiseErrorText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(franchiseSignupCodesProvider).asData?.value;
    if (data == null || !data.available) return const SizedBox.shrink();

    return Column(
      key: const Key('franchise_signup_codes'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        Text(
          'NEW FRANCHISEE WITHOUT TROVO YET',
          style: AppTextStyles.labelMedium.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 8),
        FranchiseCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Make a franchise code and send it to the new franchisee. They enter it on Trovo\'s sign-up website '
                'when they buy their own subscription, agree to share the items you ask for, and appear in your '
                'network as soon as their company is created. A code works once, for '
                '${_lifetimeText(data.lifetimeMinutes)}.',
                style: AppTextStyles.bodySmall,
              ),
              if (widget.canManage) ...[
                const SizedBox(height: 10),
                TextField(
                  key: const Key('franchise_code_label'),
                  controller: _labelController,
                  maxLength: 80,
                  decoration: const InputDecoration(
                    labelText: 'Note, e.g. Salem — Ramesh (optional)',
                    border: OutlineInputBorder(),
                    isDense: true,
                    counterText: '',
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'What do you want to see?',
                  style: AppTextStyles.labelMedium.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                FranchiseScopePicker(
                  keyPrefix: 'franchise_code_scope',
                  options: franchiseScopeOptions,
                  selected: _scopes,
                  onToggle: (scope) => setState(() {
                    if (!_scopes.remove(scope)) _scopes.add(scope);
                  }),
                ),
                const SizedBox(height: 6),
                AppButton(
                  key: const Key('franchise_make_code'),
                  label: 'Make franchise code',
                  icon: Icons.key_rounded,
                  fullWidth: true,
                  isLoading: _busy,
                  onPressed: _scopes.isEmpty ? null : _make,
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 10),
                FranchiseNotice(text: _error!, isError: true),
              ],
              if (_made case final made?) ...[
                const SizedBox(height: 10),
                _CodeBox(
                  code: made.code,
                  expiresAt: made.item.expiresAt,
                  copied: _copied,
                  onCopy: () async {
                    await Clipboard.setData(ClipboardData(text: made.code));
                    if (mounted) setState(() => _copied = true);
                  },
                ),
              ],
              for (final code in data.codes) ...[
                const Divider(height: 20),
                Row(
                  key: Key('franchise_code_${code.id}'),
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            code.label ?? 'Franchise code',
                            style: AppTextStyles.bodyMedium.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            [
                              code.statusLabel,
                              if (code.usedByCompanyName != null)
                                code.usedByCompanyName!,
                              if (code.createdAt != null)
                                FormatUtils.formatDateTime(code.createdAt!),
                            ].join(' · '),
                            style: AppTextStyles.caption.copyWith(
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (widget.canManage && code.canWithdraw)
                      TextButton(
                        key: Key('franchise_withdraw_${code.id}'),
                        onPressed: () => _withdraw(code.id),
                        child: const Text('Withdraw'),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _CodeBox extends StatelessWidget {
  final String code;
  final DateTime? expiresAt;
  final bool copied;
  final VoidCallback onCopy;

  const _CodeBox({
    required this.code,
    required this.expiresAt,
    required this.copied,
    required this.onCopy,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('franchise_code_box'),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDFA),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF99F6E4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Send this code to the new franchisee, for example on WhatsApp. It is not shown again.',
            style: AppTextStyles.bodySmall.copyWith(
              color: const Color(0xFF134E4A),
            ),
          ),
          const SizedBox(height: 8),
          SelectableText(
            code,
            key: const Key('franchise_code_value'),
            style: const TextStyle(
              fontFamily: 'monospace',
              fontSize: 20,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: Text(
                  expiresAt == null
                      ? ''
                      : 'Valid until ${FormatUtils.formatDateTime(expiresAt!)}, for one sign-up.',
                  style: AppTextStyles.caption.copyWith(
                    color: const Color(0xFF0F766E),
                  ),
                ),
              ),
              OutlinedButton.icon(
                key: const Key('franchise_copy_code'),
                onPressed: onCopy,
                icon: Icon(
                  copied ? Icons.check_rounded : Icons.copy_rounded,
                  size: 18,
                ),
                label: Text(copied ? 'Copied' : 'Copy code'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
