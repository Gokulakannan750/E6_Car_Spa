// E6 Car Spa - Foundation Stabilization Tests

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';

import 'package:e6_car_spa/main.dart';
import 'package:e6_car_spa/core/constants/app_colors.dart';
import 'package:e6_car_spa/core/constants/app_constants.dart';
import 'package:e6_car_spa/core/theme/app_theme.dart';
import 'package:e6_car_spa/core/theme/app_text_styles.dart';
import 'package:e6_car_spa/core/utils/app_environment.dart';
import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/config/routes.dart';
import 'package:e6_car_spa/shared/widgets/app_button.dart';
import 'package:e6_car_spa/shared/widgets/app_text_field.dart';
import 'package:e6_car_spa/shared/widgets/app_search_field.dart';
import 'package:e6_car_spa/shared/widgets/app_kpi_card.dart';
import 'package:e6_car_spa/shared/widgets/status_badge.dart';
import 'package:e6_car_spa/shared/widgets/app_loading_state.dart';
import 'package:e6_car_spa/shared/widgets/app_empty_state.dart';
import 'package:e6_car_spa/shared/widgets/app_error_state.dart';
import 'package:e6_car_spa/shared/widgets/app_confirm_dialog.dart';
import 'package:e6_car_spa/shared/widgets/app_section_header.dart';
import 'package:e6_car_spa/shared/widgets/app_screen_scaffold.dart';

import 'package:google_fonts/google_fonts.dart';

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('1. Design System & Theme Tokens', () {
    test('AppColors match Desktop globals.css tokens', () {
      expect(AppColors.primary, const Color(0xFF0453CD));
      expect(AppColors.primaryContainer, const Color(0xFF0B1228));
      expect(AppColors.accent, const Color(0xFF0453CD));
      expect(AppColors.accentLight, const Color(0xFF356EE7));
      expect(AppColors.background, const Color(0xFFF8FAFC));
      expect(AppColors.surface, const Color(0xFFF8FAFC));
      expect(AppColors.card, const Color(0xFFFFFFFF));
      expect(AppColors.textPrimary, const Color(0xFF0F172A));
      expect(AppColors.textSecondary, const Color(0xFF475569));
      expect(AppColors.outline, const Color(0xFFCBD5E1));
      expect(AppColors.success, const Color(0xFF047857));
      expect(AppColors.warning, const Color(0xFFB45309));
      expect(AppColors.error, const Color(0xFFB91C1C));
      expect(AppColors.info, const Color(0xFF1D4ED8));
    });

    test('AppTheme defines consistent Light Theme', () {
      final theme = AppTheme.light;
      expect(theme.useMaterial3, true);
      expect(theme.colorScheme.primary, AppColors.primary);
      expect(theme.colorScheme.primaryContainer, AppColors.primaryContainer);
      expect(theme.colorScheme.secondary, AppColors.accent);
      expect(theme.colorScheme.error, AppColors.error);
      expect(theme.cardTheme.color, AppColors.card);
      expect(theme.scaffoldBackgroundColor, AppColors.background);
    });

    test('AppTextStyles provides Inter typography styles', () {
      expect(AppTextStyles.displayLarge.fontSize, 30);
      expect(AppTextStyles.headingLarge.fontSize, 18);
      expect(AppTextStyles.bodyMedium.fontSize, 14);
      expect(AppTextStyles.labelSmall.fontSize, 11);
    });
  });

  group('2. Environment & Configuration', () {
    test('AppConstants and AppEnvironment defaults are consistent', () {
      expect(AppConstants.defaultDevApiUrl, 'http://10.0.2.2:5298/api');
      expect(AppConstants.defaultProdApiUrl, 'https://api.e6carspa.com/api');
      expect(AppConstants.appName, 'E6 Car Spa');
      expect(AppConstants.connectTimeoutMs, 30000);
      expect(AppConstants.receiveTimeoutMs, 30000);
      expect(AppEnvironment.apiBaseUrl, contains('5298'));
    });
  });

  group('3. Navigation & AppShell', () {
    test('AppRoutes.getNavIndex correctly calculates active tab indices', () {
      expect(AppRoutes.getNavIndex('/dashboard'), 0);
      expect(AppRoutes.getNavIndex('/customers'), 1);
      expect(AppRoutes.getNavIndex('/customers/123'), 1);
      expect(AppRoutes.getNavIndex('/job-cards'), 2);
      expect(AppRoutes.getNavIndex('/job-cards/new'), 2);
      expect(AppRoutes.getNavIndex('/job-cards/456'), 2);

      // Invoices is active tab index 3
      expect(AppRoutes.getNavIndex('/quotations-invoices'), 3);
      expect(AppRoutes.getNavIndex('/quotations-invoices/12'), 3);
      expect(AppRoutes.getNavIndex('/invoices/12'), 3);

      // Catalogue is active tab index 4
      expect(AppRoutes.getNavIndex('/catalogue'), 4);

      // Routes in More menu map to index 5 (More tab)
      expect(AppRoutes.getNavIndex('/staff-advances'), 5);
      expect(AppRoutes.getNavIndex('/reports'), 5);
      expect(AppRoutes.getNavIndex('/showroom'), 5);
      expect(AppRoutes.getNavIndex('/settings'), 5);
    });
  });

  group('4. ApiException & Network Foundation', () {
    test('ApiException subclasses and status codes', () {
      const unauthorized = UnauthorizedException(endpoint: '/api/auth/profile');
      expect(unauthorized.statusCode, 401);
      expect(unauthorized.message, contains('Session expired'));

      const forbidden = ForbiddenException(endpoint: '/api/users');
      expect(forbidden.statusCode, 403);
      expect(forbidden.message, contains('permission'));

      const serverError = ServerException(endpoint: '/api/jobcards');
      expect(serverError.statusCode, 500);
      expect(serverError.message, contains('Server error'));

      const networkError = NetworkException(endpoint: '/api/customers');
      expect(networkError.statusCode, isNull);
      expect(networkError.message, contains('No internet'));
    });

    test('ApiException.fromDio parses DioException correctly', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/api/customers'),
        type: DioExceptionType.connectionTimeout,
      );
      final apiException = ApiException.fromDio(dioException);
      expect(apiException.message, contains('Connection timeout'));
      expect(apiException.endpoint, '/api/customers');
    });
  });

  group('5. Shared Foundation Widgets', () {
    testWidgets('AppButton renders label and handles tap', (WidgetTester tester) async {
      bool tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: AppButton(
              label: 'Create Job Card',
              onPressed: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Create Job Card'), findsOneWidget);
      await tester.tap(find.text('Create Job Card'));
      expect(tapped, true);
    });

    testWidgets('AppButton renders loading state', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(
            body: AppButton(
              label: 'Saving',
              isLoading: true,
            ),
          ),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Saving'), findsOneWidget);
    });

    testWidgets('AppTextField renders and receives text', (WidgetTester tester) async {
      String changedText = '';
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: AppTextField(
              label: 'Customer Name',
              hintText: 'Enter name',
              onChanged: (val) => changedText = val,
            ),
          ),
        ),
      );

      expect(find.text('Customer Name'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'John Doe');
      expect(changedText, 'John Doe');
    });

    testWidgets('AppSearchField renders and receives search query', (WidgetTester tester) async {
      String query = '';
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: AppSearchField(
              placeholder: 'Search vehicles...',
              onChanged: (val) => query = val,
            ),
          ),
        ),
      );

      expect(find.text('Search vehicles...'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'TN01AB1234');
      expect(query, 'TN01AB1234');
    });

    testWidgets('StatusBadge renders correct label and icons for statuses', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(
            body: Column(
              children: [
                StatusBadge(label: 'Pending', type: StatusType.pending),
                StatusBadge(label: 'In Progress', type: StatusType.inProgress),
                StatusBadge(label: 'Completed', type: StatusType.completed),
              ],
            ),
          ),
        ),
      );

      expect(find.text('Pending'), findsOneWidget);
      expect(find.text('In Progress'), findsOneWidget);
      expect(find.text('Completed'), findsOneWidget);
    });

    testWidgets('AppKpiCard renders title, value and handles tap', (WidgetTester tester) async {
      bool tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: AppKpiCard(
              title: 'Total Revenue',
              value: '₹1,24,500',
              icon: Icons.currency_rupee_rounded,
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Total Revenue'), findsOneWidget);
      expect(find.text('₹1,24,500'), findsOneWidget);
      await tester.tap(find.text('Total Revenue'));
      expect(tapped, true);
    });

    testWidgets('AppLoadingState, AppEmptyState, AppErrorState render cleanly', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(
            body: Column(
              children: [
                AppLoadingState(message: 'Loading records...'),
                AppEmptyState(title: 'No Customers Found', message: 'Add a customer to get started'),
                AppErrorState(message: 'Network error occurred'),
              ],
            ),
          ),
        ),
      );

      expect(find.text('Loading records...'), findsOneWidget);
      expect(find.text('No Customers Found'), findsOneWidget);
      expect(find.text('Network error occurred'), findsOneWidget);
    });

    testWidgets('AppSectionHeader and AppScreenScaffold render correctly', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: AppScreenScaffold(
            title: 'Job Cards Overview',
            body: AppSectionHeader(
              title: 'Recent Activity',
              actionLabel: 'View All',
              onAction: () {},
            ),
          ),
        ),
      );

      expect(find.text('Job Cards Overview'), findsOneWidget);
      expect(find.text('Recent Activity'), findsOneWidget);
      expect(find.text('View All'), findsOneWidget);
    });

    testWidgets('AppConfirmDialog renders with confirm and cancel buttons', (WidgetTester tester) async {
      bool confirmed = false;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: AppConfirmDialog(
              title: 'Delete Item',
              message: 'Are you sure you want to delete this?',
              confirmLabel: 'Delete',
              isDestructive: true,
              onConfirm: () => confirmed = true,
            ),
          ),
        ),
      );

      expect(find.text('Delete Item'), findsOneWidget);
      expect(find.text('Are you sure you want to delete this?'), findsOneWidget);
      expect(find.text('Delete'), findsOneWidget);
      await tester.tap(find.text('Delete'));
      expect(confirmed, true);
    });
  });

  group('6. App Startup & Routing', () {
    testWidgets('E6CarSpaApp starts up and mounts with ProviderScope', (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: E6CarSpaApp(),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.byType(MaterialApp), findsOneWidget);
    });
  });
}
