import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/theme/app_text_styles.dart';

class AppScreenScaffold extends StatelessWidget {
  final String title;
  final Widget body;
  final List<Widget>? actions;
  final Widget? floatingActionButton;
  final Widget? bottomNavigationBar;
  final bool showBackButton;
  final VoidCallback? onBackPressed;
  final Widget? leading;
  final Color backgroundColor;

  const AppScreenScaffold({
    super.key,
    required this.title,
    required this.body,
    this.actions,
    this.floatingActionButton,
    this.bottomNavigationBar,
    this.showBackButton = true,
    this.onBackPressed,
    this.leading,
    this.backgroundColor = AppColors.background,
  });

  @override
  Widget build(BuildContext context) {
    final canPop = Navigator.of(context).canPop();

    return Scaffold(
      backgroundColor: backgroundColor,
      appBar: AppBar(
        title: Text(
          title,
          style: AppTextStyles.headingLarge.copyWith(
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        automaticallyImplyLeading: false,
        leading: leading ??
            (showBackButton && canPop
                ? IconButton(
                    icon: const Icon(Icons.arrow_back_rounded),
                    onPressed: onBackPressed ?? () => Navigator.of(context).pop(),
                  )
                : null),
        actions: actions,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: backgroundColor,
      ),
      body: SafeArea(child: body),
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: bottomNavigationBar,
    );
  }
}
