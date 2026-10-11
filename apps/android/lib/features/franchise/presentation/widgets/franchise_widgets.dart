import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/format_utils.dart';
import '../../models/franchise_models.dart';

/// A message person-readable for any error that reaches a franchise screen.
String franchiseErrorText(Object error) {
  if (error is ApiException) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

String franchiseDate(DateTime? value) =>
    value == null ? '' : FormatUtils.formatDate(value);

/// A rounded white card used for every franchise link and figure.
class FranchiseCard extends StatelessWidget {
  final Widget child;
  final Key? cardKey;

  const FranchiseCard({super.key, required this.child, this.cardKey});

  @override
  Widget build(BuildContext context) {
    return Container(
      key: cardKey,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: child,
    );
  }
}

/// Pending, Active and the other states of a link, as a small coloured pill.
class FranchiseStatusPill extends StatelessWidget {
  final String status;

  const FranchiseStatusPill({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg) = switch (status) {
      'Active' => (AppColors.successLight, AppColors.success),
      'Pending' => (AppColors.warningLight, AppColors.warning),
      _ => (AppColors.surfaceAlt, AppColors.textSecondary),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status,
        style: AppTextStyles.labelSmall.copyWith(
          color: fg,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// The other company's name and hidden code, with the state of the link.
class FranchisePartnerHeader extends StatelessWidget {
  final FranchiseLink link;

  const FranchisePartnerHeader({super.key, required this.link});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: const Color(0xFFE6FFFA),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(
            Icons.hub_rounded,
            color: Color(0xFF0D9488),
            size: 22,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                link.partnerName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.bodyMedium.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              Text(
                'Company code ${link.partnerCodeHint}',
                style: AppTextStyles.caption.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
        FranchiseStatusPill(status: link.status),
      ],
    );
  }
}

/// A banner for the result of the last action: green when it worked, red when it did not.
class FranchiseNotice extends StatelessWidget {
  final String text;
  final bool isError;

  const FranchiseNotice({super.key, required this.text, this.isError = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      key: Key(isError ? 'franchise_notice_error' : 'franchise_notice_ok'),
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: isError ? AppColors.errorLight : AppColors.successLight,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isError
              ? AppColors.error.withValues(alpha: 0.3)
              : AppColors.success.withValues(alpha: 0.3),
        ),
      ),
      child: Text(
        text,
        style: AppTextStyles.bodySmall.copyWith(
          color: isError ? AppColors.errorDark : AppColors.successDark,
        ),
      ),
    );
  }
}

/// The link to pass on to the franchisee, with a copy button. Shown once, right after it is made.
class FranchiseLinkBox extends StatefulWidget {
  final String link;
  final DateTime? expiresAt;
  final String intro;

  const FranchiseLinkBox({
    super.key,
    required this.link,
    required this.intro,
    this.expiresAt,
  });

  @override
  State<FranchiseLinkBox> createState() => _FranchiseLinkBoxState();
}

class _FranchiseLinkBoxState extends State<FranchiseLinkBox> {
  bool _copied = false;

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: widget.link));
    if (mounted) {
      setState(() => _copied = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final until = widget.expiresAt == null
        ? ''
        : ', until ${franchiseDate(widget.expiresAt)}';
    return Container(
      key: const Key('franchise_link_box'),
      margin: const EdgeInsets.only(bottom: 12),
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
            widget.intro,
            style: AppTextStyles.bodySmall.copyWith(
              color: const Color(0xFF134E4A),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            key: const Key('franchise_link_field'),
            controller: TextEditingController(text: widget.link),
            readOnly: true,
            style: const TextStyle(fontFamily: 'monospace', fontSize: 11),
            decoration: const InputDecoration(
              isDense: true,
              border: OutlineInputBorder(),
              fillColor: Colors.white,
              filled: true,
            ),
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: OutlinedButton.icon(
              key: const Key('franchise_copy_link'),
              onPressed: _copy,
              icon: Icon(
                _copied ? Icons.check_rounded : Icons.copy_rounded,
                size: 18,
              ),
              label: Text(_copied ? 'Copied' : 'Copy link'),
            ),
          ),
          Text(
            'Send it to the company. Only the Owner of the invited company can use it, after signing in, and it '
            'works once$until. This link is not shown again; you can make a new one if it is lost.',
            style: AppTextStyles.caption.copyWith(
              color: const Color(0xFF0F766E),
            ),
          ),
        ],
      ),
    );
  }
}

/// Tick boxes for the items a franchisor can ask for, or a franchisee can allow.
class FranchiseScopePicker extends StatelessWidget {
  final String keyPrefix;
  final List<FranchiseScopeOption> options;
  final Set<String> selected;
  final ValueChanged<String> onToggle;
  final bool enabled;

  const FranchiseScopePicker({
    super.key,
    required this.keyPrefix,
    required this.options,
    required this.selected,
    required this.onToggle,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final option in options)
          CheckboxListTile(
            key: Key('${keyPrefix}_${option.scope}'),
            dense: true,
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            value: selected.contains(option.scope),
            onChanged: enabled ? (_) => onToggle(option.scope) : null,
            title: Text(option.label, style: AppTextStyles.bodySmall),
          ),
      ],
    );
  }
}
