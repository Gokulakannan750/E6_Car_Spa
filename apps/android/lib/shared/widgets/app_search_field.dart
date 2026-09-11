import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

class AppSearchField extends StatelessWidget {
  final String? placeholder;
  final String? hint;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onClear;
  final TextEditingController? controller;
  final FocusNode? focusNode;
  final IconData clearIcon;

  const AppSearchField({
    super.key,
    this.placeholder,
    this.hint,
    this.onChanged,
    this.onClear,
    this.controller,
    this.focusNode,
    this.clearIcon = Icons.clear_rounded,
  });

  @override
  Widget build(BuildContext context) {
    Widget? buildSuffix() {
      if (onClear == null) return null;
      if (controller != null) {
        return ValueListenableBuilder<TextEditingValue>(
          valueListenable: controller!,
          builder: (context, value, _) {
            if (value.text.isEmpty) return const SizedBox.shrink();
            return IconButton(
              icon: Icon(clearIcon, size: 18, color: AppColors.textSecondary),
              onPressed: () {
                controller!.clear();
                onClear!();
              },
            );
          },
        );
      }
      return IconButton(
        icon: Icon(clearIcon, size: 18, color: AppColors.textSecondary),
        onPressed: onClear,
      );
    }

    return TextField(
      controller: controller,
      focusNode: focusNode,
      onChanged: onChanged,
      style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
      decoration: InputDecoration(
        hintText: hint ?? placeholder ?? 'Search...',
        hintStyle: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
        prefixIcon: const Icon(Icons.search, size: 20, color: AppColors.textSecondary),
        suffixIcon: buildSuffix(),
        filled: true,
        fillColor: AppColors.surfaceAlt,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
      ),
    );
  }
}

