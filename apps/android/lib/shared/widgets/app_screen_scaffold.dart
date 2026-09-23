import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../config/routes.dart';
import '../../core/constants/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import 'e6_brand_badge.dart';

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
  final bool showBrandBadge;

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
    this.showBrandBadge = true,
  });

  void _handleBackNavigation(BuildContext context) {
    if (onBackPressed != null) {
      onBackPressed!();
    } else if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      context.go(AppRoutes.dashboard);
    }
  }

  @override
  Widget build(BuildContext context) {
    final Widget scaffold = Scaffold(
      backgroundColor: backgroundColor,
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (showBrandBadge) ...[
              const E6BrandBadge(),
              const SizedBox(width: 10),
            ],
            Flexible(
              child: Text(
                title,
                style: AppTextStyles.appBarTitle,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        automaticallyImplyLeading: false,
        leading: leading ??
            (showBackButton
                ? IconButton(
                    key: const Key('app_scaffold_back_button'),
                    icon: const Icon(Icons.arrow_back_rounded),
                    tooltip: 'Back to Dashboard',
                    onPressed: () => _handleBackNavigation(context),
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

    if (showBackButton) {
      return PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, result) {
          if (didPop) return;
          _handleBackNavigation(context);
        },
        child: scaffold,
      );
    }

    return scaffold;
  }
}
