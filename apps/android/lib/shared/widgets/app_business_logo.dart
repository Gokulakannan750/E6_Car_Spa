import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/app_environment.dart';
import '../../features/settings/models/business_profile_model.dart';
import '../../features/settings/providers/settings_provider.dart';

class AppBusinessLogo extends ConsumerWidget {
  final double? width;
  final double height;
  final double? maxWidth;
  final double? maxHeight;
  final double borderRadius;
  final IconData? fallbackIcon;
  final String fallbackText;
  final Color? backgroundColor;
  final Color? fallbackColor;
  final Color? iconColor;
  final TextStyle? textStyle;
  final BoxFit fit;
  final bool isCircular;
  final String? customLogoPath;
  final DateTime? customUpdatedAt;
  final BoxBorder? border;
  final List<BoxShadow>? boxShadow;
  final EdgeInsetsGeometry? padding;

  const AppBusinessLogo({
    super.key,
    this.width,
    this.height = 40,
    this.maxWidth,
    this.maxHeight,
    this.borderRadius = 8,
    this.fallbackIcon,
    this.fallbackText = 'E6',
    this.backgroundColor,
    this.fallbackColor,
    this.iconColor,
    this.textStyle,
    this.fit = BoxFit.contain,
    this.isCircular = false,
    this.customLogoPath,
    this.customUpdatedAt,
    this.border,
    this.boxShadow,
    this.padding,
  });

  static String? resolveLogoUrl(String? path, [DateTime? updatedAt]) {
    if (path == null || path.trim().isEmpty) return null;
    final trimmed = path.trim();
    final String base;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      base = trimmed;
    } else {
      final baseServerUrl =
          AppEnvironment.apiBaseUrl.replaceAll(RegExp(r'/api/?$'), '');
      base = '$baseServerUrl${trimmed.startsWith('/') ? '' : '/'}$trimmed';
    }

    if (updatedAt != null) {
      final param = 'v=${updatedAt.millisecondsSinceEpoch}';
      return base.contains('?') ? '$base&$param' : '$base?$param';
    }
    return base;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final BusinessProfileModel? profile = ref.watch(businessProfileProvider);

    final path = customLogoPath ?? profile?.logoPath;
    final updatedAt = customUpdatedAt ?? profile?.updatedAt;
    final resolvedUrl = resolveLogoUrl(path, updatedAt);

    final shape = isCircular ? BoxShape.circle : BoxShape.rectangle;
    final br = isCircular ? null : BorderRadius.circular(borderRadius);

    if (resolvedUrl != null && resolvedUrl.isNotEmpty) {
      final effectiveMaxHeight = maxHeight ?? height;
      final effectiveMaxWidth = maxWidth ?? (width ?? (height * 3.5));
      final hasDecoration = backgroundColor != null || border != null || boxShadow != null;

      Widget imageWidget = Image.network(
        resolvedUrl,
        height: height,
        fit: fit,
        errorBuilder: (context, error, stackTrace) => _buildFallback(br, shape),
        loadingBuilder: (context, child, loadingProgress) {
          if (loadingProgress == null) return child;
          return Center(
            child: SizedBox(
              width: height * 0.4,
              height: height * 0.4,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(
                  fallbackColor ?? AppColors.primary,
                ),
              ),
            ),
          );
        },
      );

      if (hasDecoration || padding != null || width != null) {
        return Container(
          width: width,
          height: height,
          constraints: BoxConstraints(
            maxHeight: effectiveMaxHeight,
            maxWidth: effectiveMaxWidth,
          ),
          padding: padding ?? EdgeInsets.zero,
          decoration: hasDecoration
              ? BoxDecoration(
                  color: backgroundColor,
                  shape: shape,
                  borderRadius: br,
                  border: border,
                  boxShadow: boxShadow,
                )
              : null,
          clipBehavior: br != null || isCircular ? Clip.antiAlias : Clip.none,
          child: imageWidget,
        );
      }

      return ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: effectiveMaxHeight,
          maxWidth: effectiveMaxWidth,
        ),
        child: imageWidget,
      );
    }

    return _buildFallback(br, shape);
  }

  Widget _buildFallback(BorderRadius? br, BoxShape shape) {
    final effectiveWidth = width ?? height;
    return Container(
      width: effectiveWidth,
      height: height,
      decoration: BoxDecoration(
        color: backgroundColor ?? fallbackColor ?? AppColors.primary,
        shape: shape,
        borderRadius: br,
        border: border,
        boxShadow: boxShadow,
      ),
      child: Center(
        child: fallbackIcon != null
            ? Icon(
                fallbackIcon,
                size: effectiveWidth * 0.52,
                color: iconColor ?? Colors.white,
              )
            : Text(
                fallbackText,
                style: textStyle ??
                    TextStyle(
                      color: iconColor ?? Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: effectiveWidth * 0.42,
                    ),
              ),
      ),
    );
  }
}
