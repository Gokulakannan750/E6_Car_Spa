import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/constants/app_colors.dart';

class AppTextField extends StatelessWidget {
  final String? label;
  final String? hintText;
  final String? hint;
  final String? errorText;
  final String? helperText;
  final bool isRequired;
  final bool isPassword;
  final bool isEnabled;
  final int maxLines;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final String? initialValue;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onTap;
  final TextEditingController? controller;
  final Widget? prefixIcon;
  final Widget? suffixIcon;
  final FormFieldValidator<String>? validator;
  final List<TextInputFormatter>? inputFormatters;
  final int? maxLength;
  final InputCounterWidgetBuilder? buildCounter;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onFieldSubmitted;
  final Color? textColor;
  final Color? labelColor;
  final Color? hintColor;
  final Color? fillColor;
  final Color? borderColor;
  final Color? focusedBorderColor;

  const AppTextField({
    super.key,
    this.label,
    this.hintText,
    this.hint,
    this.errorText,
    this.helperText,
    this.isRequired = false,
    this.isPassword = false,
    this.isEnabled = true,
    this.maxLines = 1,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
    this.initialValue,
    this.onChanged,
    this.onTap,
    this.controller,
    this.prefixIcon,
    this.suffixIcon,
    this.validator,
    this.inputFormatters,
    this.maxLength,
    this.buildCounter,
    this.textInputAction,
    this.onFieldSubmitted,
    this.textColor,
    this.labelColor,
    this.hintColor,
    this.fillColor,
    this.borderColor,
    this.focusedBorderColor,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveLabel = isRequired && label != null ? '$label *' : label;
    final effectiveHint = hint ?? hintText;
    final effectiveBorderColor = borderColor ?? AppColors.border;
    final effectiveFocusedBorderColor = focusedBorderColor ?? AppColors.accent;
    final effectiveFillColor = fillColor ?? (isEnabled ? AppColors.card : AppColors.surfaceAlt);

    return TextFormField(
      controller: controller,
      initialValue: controller == null ? initialValue : null,
      enabled: isEnabled,
      style: textColor != null ? TextStyle(color: textColor, fontSize: 14) : null,
      keyboardType: keyboardType,
      textCapitalization: textCapitalization,
      obscureText: isPassword,
      maxLines: isPassword ? 1 : maxLines,
      maxLength: maxLength,
      inputFormatters: inputFormatters,
      buildCounter: buildCounter ?? (maxLength != null ? (_, {required currentLength, required isFocused, required maxLength}) => null : null),
      textInputAction: textInputAction,
      onFieldSubmitted: onFieldSubmitted,
      onChanged: onChanged,
      onTap: onTap,
      validator: validator,
      decoration: InputDecoration(
        labelText: effectiveLabel,
        labelStyle: labelColor != null ? TextStyle(color: labelColor, fontSize: 14) : null,
        hintText: effectiveHint,
        hintStyle: hintColor != null ? TextStyle(color: hintColor, fontSize: 14) : null,
        helperText: helperText,
        errorText: errorText,
        prefixIcon: prefixIcon,
        suffixIcon: suffixIcon,
        border: const OutlineInputBorder(),
        enabledBorder: OutlineInputBorder(
          borderSide: BorderSide(color: effectiveBorderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderSide: BorderSide(color: effectiveFocusedBorderColor, width: 2),
        ),
        errorBorder: const OutlineInputBorder(
          borderSide: BorderSide(color: AppColors.error),
        ),
        filled: true,
        fillColor: effectiveFillColor,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      ),
    );
  }
}
