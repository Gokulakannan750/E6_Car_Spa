import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../config/routes.dart';
import '../../core/constants/app_colors.dart';

class AppShell extends ConsumerWidget {
  final Widget child;
  final String? currentLocation;

  const AppShell({
    super.key,
    required this.child,
    this.currentLocation,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = currentLocation ?? GoRouterState.of(context).uri.toString();
    final selectedIndex = _calculateSelectedIndex(location);

    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.bottomNavBg,
          border: Border(
            top: BorderSide(color: AppColors.bottomNavBorder, width: 1),
          ),
        ),
        child: BottomNavigationBar(
          currentIndex: selectedIndex,
          type: BottomNavigationBarType.fixed,
          backgroundColor: AppColors.bottomNavBg,
          selectedItemColor: AppColors.primary, // E6 Blue active state
          unselectedItemColor: AppColors.bottomNavInactive,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 11),
          iconSize: 22,
          elevation: 0,
          items: AppRoutes.bottomNavItems,
          onTap: (index) => _onItemTapped(context, index, selectedIndex),
        ),
      ),
    );
  }

  int _calculateSelectedIndex(String location) {
    return AppRoutes.getNavIndex(location);
  }

  void _onItemTapped(BuildContext context, int index, int currentIndex) {
    if (index == currentIndex && index != 5) return;
    switch (index) {
      case 0:
        context.go(AppRoutes.dashboard);
        break;
      case 1:
        context.go(AppRoutes.customers);
        break;
      case 2:
        context.go(AppRoutes.jobCards);
        break;
      case 3:
        context.go(AppRoutes.quotationsInvoices);
        break;
      case 4:
        context.go(AppRoutes.catalogue);
        break;
      case 5:
        _showMoreMenu(context);
        break;
    }
  }

  void _showMoreMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Center(
                        child: Text(
                          'E6',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'More Modules',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 16, color: AppColors.border),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.accentPill,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.payments_outlined, color: AppColors.primary, size: 20),
                ),
                title: const Text('Staff Advances', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                subtitle: const Text('Staff advances & petty cash', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                trailing: const Icon(Icons.chevron_right, size: 20, color: AppColors.textTertiary),
                onTap: () {
                  Navigator.pop(context);
                  context.go(AppRoutes.staffAdvances);
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.accentPill,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.bar_chart_outlined, color: AppColors.primary, size: 20),
                ),
                title: const Text('Reports', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                subtitle: const Text('Business analytics & financial reports', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                trailing: const Icon(Icons.chevron_right, size: 20, color: AppColors.textTertiary),
                onTap: () {
                  Navigator.pop(context);
                  context.go(AppRoutes.reports);
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.accentPill,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.storefront_outlined, color: AppColors.primary, size: 20),
                ),
                title: const Text('Showroom', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                subtitle: const Text('Showroom products & accessories', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                trailing: const Icon(Icons.chevron_right, size: 20, color: AppColors.textTertiary),
                onTap: () {
                  Navigator.pop(context);
                  context.go(AppRoutes.showroom);
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.accentPill,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.settings_outlined, color: AppColors.primary, size: 20),
                ),
                title: const Text('Settings', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                subtitle: const Text('App preferences & account info', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                trailing: const Icon(Icons.chevron_right, size: 20, color: AppColors.textTertiary),
                onTap: () {
                  Navigator.pop(context);
                  context.go(AppRoutes.settings);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
