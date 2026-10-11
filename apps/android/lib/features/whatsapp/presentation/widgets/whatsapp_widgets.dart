import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/theme/app_text_styles.dart';

String whatsAppErrorText(Object e) =>
    e is ApiException ? e.message : 'Something went wrong. Please try again.';

/// A white card with the border used across the settings screens.
class WhatsAppCard extends StatelessWidget {
  final Key? cardKey;
  final Widget child;

  const WhatsAppCard({super.key, this.cardKey, required this.child});

  @override
  Widget build(BuildContext context) {
    return Card(
      key: cardKey,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      color: AppColors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border),
      ),
      child: Padding(padding: const EdgeInsets.all(14), child: child),
    );
  }
}

/// A short result message under an action, green when it worked and red when it did not.
class WhatsAppNotice extends StatelessWidget {
  final String text;
  final bool isError;
  final Key? noticeKey;

  const WhatsAppNotice({
    super.key,
    required this.text,
    this.isError = false,
    this.noticeKey,
  });

  @override
  Widget build(BuildContext context) {
    final colour = isError ? AppColors.error : AppColors.success;
    return Container(
      key: noticeKey,
      width: double.infinity,
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: colour.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colour.withValues(alpha: 0.3)),
      ),
      child: Text(text, style: AppTextStyles.bodySmall.copyWith(color: colour)),
    );
  }
}

class WhatsAppStatusPill extends StatelessWidget {
  final String label;
  final Color colour;

  const WhatsAppStatusPill({
    super.key,
    required this.label,
    required this.colour,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: colour.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: AppTextStyles.caption.copyWith(
          color: colour,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
