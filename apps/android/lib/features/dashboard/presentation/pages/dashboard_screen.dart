import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/e6_brand_badge.dart';
import '../../../auth/providers/auth_provider.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final userName = user?.fullName ?? user?.username ?? 'Gokul Kannan';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            const E6BrandBadge(size: 32, borderRadius: 8),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'E6 Car Spa',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    'Good Morning, $userName',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        centerTitle: false,
        actions: const [
          AppLogoutAction(),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: 16),
          children: [
            // Header instruction / subtitle
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'Choose an application to manage your business',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Hero Promotional Vehicle Banner
            _buildHeroBanner(),
            const SizedBox(height: 24),

            // Applications Section Header
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Applications',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                      letterSpacing: -0.3,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Choose a workspace to continue',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w400,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Applications Cards (2-column + full-width row 3)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _buildApplicationGrid(context, ref),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildHeroBanner() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF0F172A),
            Color(0xFF0A0F1D),
            Color(0xFF020617),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E293B), width: 1),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1A000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            // Ambient red accent glow at bottom right
            Positioned(
              right: -20,
              bottom: -20,
              child: Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFFDC2626).withValues(alpha: 0.18),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            // Banner Content
            Padding(
              padding: const EdgeInsets.all(18),
              child: Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: const BoxDecoration(
                                color: Color(0xFFEF4444),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            const Text(
                              'E6 CAR SPA',
                              style: TextStyle(
                                color: Color(0xFF94A3B8),
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1.2,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'CLEAN CARS',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                                color: Colors.white,
                              ),
                            ),
                            Text(
                              'HAPPY PEOPLE',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                                color: Colors.white,
                              ),
                            ),
                            Text(
                              'DRIVE BETTER',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.5,
                                color: Color(0xFFEF4444),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Container(
                          width: 32,
                          height: 2.5,
                          decoration: BoxDecoration(
                            color: const Color(0xFFDC2626),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    flex: 4,
                    child: SizedBox(
                      height: 85,
                      child: CustomPaint(
                        painter: _CarSilhouettePainter(
                          color: const Color(0xFF1E293B),
                          accentColor: const Color(0xFF38BDF8),
                        ),
                        size: const Size(double.infinity, 85),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildApplicationGrid(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final isOwner = user?.isOwner ?? false;
    final permissions = user?.permissions ?? [];

    bool isAuthorized(List<String> requiredPermissions) {
      if (isOwner) return true;
      if (permissions.contains('*')) return true;
      return requiredPermissions.any((p) => permissions.contains(p));
    }

    const allApps = [
      _SuiteAppItem(
        title: 'E6 Billing',
        description: 'Customers, job cards, invoices and payments',
        icon: Icons.directions_car_rounded,
        iconColor: Color(0xFF0453CD),
        bgColor: Color(0xFFEFF6FF),
        route: AppRoutes.jobCards,
        requiredPermissions: ['jobcards.view', 'invoices.view', 'customers.view'],
      ),
      _SuiteAppItem(
        title: 'E6 Staff',
        description: 'Staff, attendance and salary management',
        icon: Icons.people_alt_rounded,
        iconColor: Color(0xFF059669),
        bgColor: Color(0xFFECFDF5),
        route: AppRoutes.staff,
        requiredPermissions: ['staff.view'],
      ),
      _SuiteAppItem(
        title: 'E6 Showroom',
        description: 'Showrooms, staff work and showroom billing',
        icon: Icons.storefront_rounded,
        iconColor: Color(0xFF4F46E5),
        bgColor: Color(0xFFEEF2FF),
        route: AppRoutes.showroom,
        requiredPermissions: ['showrooms.view', 'showroom.view'],
      ),
      _SuiteAppItem(
        title: 'E6 Reports',
        description: 'Business, billing, staff and showroom reports',
        icon: Icons.bar_chart_rounded,
        iconColor: Color(0xFF0284C7),
        bgColor: Color(0xFFF0F9FF),
        route: AppRoutes.reports,
        requiredPermissions: ['reports.view'],
      ),
      _SuiteAppItem(
        title: 'Settings',
        description: 'Business configuration and system settings',
        icon: Icons.settings_rounded,
        iconColor: Color(0xFF475569),
        bgColor: Color(0xFFF1F5F9),
        route: AppRoutes.settings,
        requiredPermissions: ['settings.view', 'users.view'],
      ),
    ];

    final visibleApps = allApps.where((app) => isAuthorized(app.requiredPermissions)).toList();

    if (visibleApps.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: const Center(
          child: Text(
            'No applications are assigned to your profile.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
        ),
      );
    }

    final mainApps = visibleApps.where((app) => app.title != 'Settings').toList();
    final hasSettings = visibleApps.any((app) => app.title == 'Settings');
    final settingsApp = hasSettings ? visibleApps.firstWhere((app) => app.title == 'Settings') : null;

    final rows = <Widget>[];

    // Build 2-column rows for the main applications
    for (int i = 0; i < mainApps.length; i += 2) {
      final app1 = mainApps[i];
      final hasSecond = (i + 1) < mainApps.length;
      final app2 = hasSecond ? mainApps[i + 1] : null;

      rows.add(
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _buildApplicationCard(context, app1),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: app2 != null
                  ? _buildApplicationCard(context, app2)
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      );

      rows.add(const SizedBox(height: 12));
    }

    // Row 3: Settings — full width card
    if (settingsApp != null) {
      rows.add(
        _buildApplicationCard(context, settingsApp, isFullWidth: true),
      );
    } else if (rows.isNotEmpty && rows.last is SizedBox) {
      rows.removeLast();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: rows,
    );
  }

  Widget _buildApplicationCard(
    BuildContext context,
    _SuiteAppItem app, {
    bool isFullWidth = false,
  }) {
    return Material(
      key: Key('launcher_app_${app.title}'),
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        key: Key('launcher_tile_${app.title}'),
        onTap: () => context.go(app.route),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          constraints: BoxConstraints(
            minHeight: isFullWidth ? 110 : 155,
          ),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border, width: 1.2),
            boxShadow: const [
              BoxShadow(
                color: Color(0x06000000),
                blurRadius: 6,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Top Row: Icon + Arrow
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: app.bgColor,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(app.icon, size: 22, color: app.iconColor),
                  ),
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Icon(
                      Icons.arrow_forward_rounded,
                      size: 16,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Title and Description
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    app.title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    app.description,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w400,
                      color: Color(0xFF64748B),
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SuiteAppItem {
  final String title;
  final String description;
  final IconData icon;
  final Color iconColor;
  final Color bgColor;
  final String route;
  final List<String> requiredPermissions;

  const _SuiteAppItem({
    required this.title,
    required this.description,
    required this.icon,
    required this.iconColor,
    required this.bgColor,
    required this.route,
    required this.requiredPermissions,
  });
}

class _CarSilhouettePainter extends CustomPainter {
  final Color color;
  final Color accentColor;

  _CarSilhouettePainter({
    required this.color,
    required this.accentColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final path = Path();
    final w = size.width;
    final h = size.height;

    // Aerodynamic car profile curve
    path.moveTo(w * 0.05, h * 0.72);
    path.cubicTo(w * 0.15, h * 0.72, w * 0.22, h * 0.65, w * 0.30, h * 0.45);
    path.cubicTo(w * 0.40, h * 0.22, w * 0.60, h * 0.20, w * 0.75, h * 0.42);
    path.cubicTo(w * 0.82, h * 0.50, w * 0.90, h * 0.58, w * 0.98, h * 0.68);
    path.cubicTo(w * 1.0, h * 0.72, w * 0.98, h * 0.76, w * 0.92, h * 0.78);
    path.lineTo(w * 0.82, h * 0.78);

    // Rear wheel arch
    path.arcToPoint(
      Offset(w * 0.68, h * 0.78),
      radius: Radius.circular(w * 0.07),
      clockwise: false,
    );
    path.lineTo(w * 0.34, h * 0.78);

    // Front wheel arch
    path.arcToPoint(
      Offset(w * 0.20, h * 0.78),
      radius: Radius.circular(w * 0.07),
      clockwise: false,
    );
    path.lineTo(w * 0.05, h * 0.78);
    path.close();

    canvas.drawPath(path, paint);

    // Wheels
    final wheelPaint = Paint()..color = const Color(0xFF0F172A);
    final rimPaint = Paint()
      ..color = const Color(0xFF475569)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    final centerPaint = Paint()..color = const Color(0xFF94A3B8);

    final rWheelCenter = Offset(w * 0.75, h * 0.78);
    final fWheelCenter = Offset(w * 0.27, h * 0.78);
    final wheelR = h * 0.20;

    canvas.drawCircle(rWheelCenter, wheelR, wheelPaint);
    canvas.drawCircle(rWheelCenter, wheelR * 0.65, rimPaint);
    canvas.drawCircle(rWheelCenter, wheelR * 0.25, centerPaint);

    canvas.drawCircle(fWheelCenter, wheelR, wheelPaint);
    canvas.drawCircle(fWheelCenter, wheelR * 0.65, rimPaint);
    canvas.drawCircle(fWheelCenter, wheelR * 0.25, centerPaint);

    // Cabin Glass
    final glassPaint = Paint()..color = accentColor.withValues(alpha: 0.35);
    final glassPath = Path();
    glassPath.moveTo(w * 0.36, h * 0.46);
    glassPath.cubicTo(w * 0.44, h * 0.28, w * 0.58, h * 0.26, w * 0.72, h * 0.44);
    glassPath.lineTo(w * 0.36, h * 0.46);
    glassPath.close();
    canvas.drawPath(glassPath, glassPaint);

    // Headlight glow
    final lightPaint = Paint()
      ..color = const Color(0xFF60A5FA)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4);
    canvas.drawOval(
      Rect.fromCenter(center: Offset(w * 0.06, h * 0.71), width: 8, height: 4),
      lightPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
