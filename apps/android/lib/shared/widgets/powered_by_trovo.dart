import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/theme/app_text_styles.dart';

/// Reusable subtle attribution widget displaying "Powered by Trovo Tech Solutions".
class PoweredByTrovo extends StatelessWidget {
  final EdgeInsetsGeometry padding;
  final TextStyle? style;
  final bool isCenter;

  const PoweredByTrovo({
    super.key,
    this.padding = const EdgeInsets.symmetric(vertical: 8.0),
    this.style,
    this.isCenter = true,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveStyle = style ??
        AppTextStyles.labelSmall.copyWith(
          color: AppColors.textTertiary,
          fontWeight: FontWeight.w500,
          letterSpacing: 0.2,
        );

    final textWidget = Text(
      'Powered by Trovo Tech Solutions',
      style: effectiveStyle,
      textAlign: isCenter ? TextAlign.center : TextAlign.start,
    );

    if (padding == EdgeInsets.zero) {
      return textWidget;
    }

    return Padding(
      padding: padding,
      child: isCenter ? Center(child: textWidget) : textWidget,
    );
  }
}
