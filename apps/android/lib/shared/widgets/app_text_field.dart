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
  });

  @override
  Widget build(BuildContext context) {
    final effectiveLabel = isRequired && label != null ? '$label *' : label;
    final effectiveHint = hint ?? hintText;

    return TextFormField(
      controller: controller,
      initialValue: controller == null ? initialValue : null,
      enabled: isEnabled,
      keyboardType: keyboardType,
      textCapitalization: textCapitalization,
      obscureText: isPassword,
      maxLines: isPassword ? 1 : maxLines,
      maxLength: maxLength,
      inputFormatters: inputFormatters,
      buildCounter: buildCounter ?? (maxLength != null ? (_, {required currentLength, required isFocused, required maxLength}) => null : null),
      onChanged: onChanged,
      onTap: onTap,
      validator: validator,
      decoration: InputDecoration(
        labelText: effectiveLabel,
        hintText: effectiveHint,
        helperText: helperText,
        errorText: errorText,
        prefixIcon: prefixIcon,
        suffixIcon: suffixIcon,
        border: const OutlineInputBorder(),
        enabledBorder: const OutlineInputBorder(
          borderSide: BorderSide(color: AppColors.border),
        ),
        focusedBorder: const OutlineInputBorder(
          borderSide: BorderSide(color: AppColors.accent, width: 2),
        ),
        errorBorder: const OutlineInputBorder(
          borderSide: BorderSide(color: AppColors.error),
        ),
        filled: true,
        fillColor: isEnabled ? AppColors.card : AppColors.surfaceAlt,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      ),
    );
  }
}
