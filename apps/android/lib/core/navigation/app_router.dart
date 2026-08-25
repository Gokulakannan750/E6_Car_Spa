import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../config/routes.dart';
import '../../features/auth/presentation/pages/login_screen.dart';
import '../../features/auth/providers/auth_provider.dart';
import '../../features/auth/providers/auth_state.dart';
import '../../features/catalogue/presentation/pages/catalogue_screen.dart';
import '../../features/customers/presentation/pages/customers_screen.dart';
import '../../features/customers/presentation/pages/customer_details_screen.dart';
import '../../features/dashboard/presentation/pages/dashboard_screen.dart';
import '../../features/invoices/presentation/pages/invoice_details_screen.dart';
import '../../features/invoices/presentation/pages/invoices_screen.dart';
import '../../features/jobcards/presentation/pages/job_cards_screen.dart';
import '../../features/jobcards/presentation/pages/job_card_details_screen.dart';
import '../../features/jobcards/presentation/pages/new_job_card_screen.dart';
import '../../shared/widgets/app_shell.dart';

class RouterNotifier extends ChangeNotifier {
  final Ref _ref;

  RouterNotifier(this._ref) {
    _ref.listen(authNotifierProvider, (previous, next) {
      notifyListeners();
    });
  }

  String? redirect(BuildContext context, GoRouterState state) {
    final authState = _ref.read(authNotifierProvider);
    final location = state.matchedLocation;
    final isAuthRoute =
        location == AppRoutes.login || location == AppRoutes.forgotPassword;

    // During initial session check, keep on login or don't redirect yet
    if (authState is AuthInitial) {
      return null;
    }

    final isAuthenticated = authState is Authenticated;

    if (!isAuthenticated) {
      // Unauthenticated users cannot access protected routes
      return isAuthRoute ? null : AppRoutes.login;
    }

    // Authenticated users should not see login/forgot password pages
    if (isAuthRoute) {
      return AppRoutes.dashboard;
    }

    return null;
  }
}

final routerNotifierProvider = Provider<RouterNotifier>((ref) {
  return RouterNotifier(ref);
});

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = ref.watch(routerNotifierProvider);

  return GoRouter(
    initialLocation: AppRoutes.login,
    refreshListenable: notifier,
    redirect: notifier.redirect,
    debugLogDiagnostics: false,
    routes: [
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('Forgot Password Page')),
        ),
      ),

      ShellRoute(
        builder: (context, state, child) =>
            AppShell(currentLocation: state.matchedLocation, child: child),
        routes: [
          GoRoute(
            path: AppRoutes.dashboard,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: DashboardScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.customers,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: CustomersScreen(),
            ),
            routes: [
              GoRoute(
                path: ':id',
                pageBuilder: (context, state) {
                  final id = state.pathParameters['id'] ?? '';
                  return NoTransitionPage(
                    child: CustomerDetailsScreen(customerId: id),
                  );
                },
              ),
            ],
          ),
          GoRoute(
            path: AppRoutes.jobCards,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: JobCardsScreen(),
            ),
            routes: [
              GoRoute(
                path: 'new',
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: NewJobCardScreen(),
                ),
              ),
              GoRoute(
                path: ':id',
                pageBuilder: (context, state) {
                  final id = state.pathParameters['id'] ?? '';
                  return NoTransitionPage(
                    child: JobCardDetailsScreen(jobCardId: id),
                  );
                },
              ),
            ],
          ),
          GoRoute(
            path: AppRoutes.quotationsInvoices,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: InvoicesScreen(),
            ),
            routes: [
              GoRoute(
                path: ':id',
                pageBuilder: (context, state) {
                  final id = state.pathParameters['id'] ?? '';
                  return NoTransitionPage(
                    child: InvoiceDetailsScreen(invoiceId: id),
                  );
                },
              ),
            ],
          ),
          GoRoute(
            path: AppRoutes.catalogue,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: CatalogueScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.staffAdvances,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: Scaffold(
                body: Center(child: Text('Staff Advances')),
              ),
            ),
          ),
          GoRoute(
            path: AppRoutes.reports,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: Scaffold(
                body: Center(child: Text('Reports')),
              ),
            ),
          ),
          GoRoute(
            path: AppRoutes.showroom,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: Scaffold(
                body: Center(child: Text('Showroom')),
              ),
            ),
          ),
          GoRoute(
            path: AppRoutes.settings,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: Scaffold(
                body: Center(child: Text('Settings')),
              ),
            ),
          ),
        ],
      ),
    ],
  );
});
