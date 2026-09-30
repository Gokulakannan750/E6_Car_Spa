import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../config/routes.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/app_shell.dart';
import '../../../auth/models/auth_user.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../auth/providers/auth_state.dart';
import '../../../catalogue/presentation/pages/catalogue_screen.dart';
import '../../../customers/presentation/pages/customers_screen.dart';
import '../../../invoices/presentation/pages/invoices_screen.dart';
import '../../../jobcards/presentation/pages/job_cards_screen.dart';
import '../../../settings/providers/system_preferences_provider.dart';

class BillingTabDefinition {
  final String label;
  final IconData icon;
  final String permission;
  final Widget widget;

  const BillingTabDefinition({
    required this.label,
    required this.icon,
    required this.permission,
    required this.widget,
  });
}

class BillingScreen extends ConsumerStatefulWidget {
  final int initialTabIndex;
  final List<BillingTabDefinition>? tabs;

  const BillingScreen({super.key, this.initialTabIndex = 0, this.tabs});

  @override
  ConsumerState<BillingScreen> createState() => _BillingScreenState();
}

typedef BillingSuiteScreen = BillingScreen;

class _BillingScreenState extends ConsumerState<BillingScreen>
    with TickerProviderStateMixin {
  late TabController _tabController;
  late List<BillingTabDefinition> _visibleTabs;

  List<BillingTabDefinition> get _allTabs => widget.tabs ?? _defaultTabs;

  static const List<BillingTabDefinition> _defaultTabs = [
    BillingTabDefinition(
      label: 'Customers',
      icon: Icons.people_outline_rounded,
      permission: 'customers.view',
      widget: CustomersScreen(),
    ),
    BillingTabDefinition(
      label: 'Job Cards',
      icon: Icons.assignment_outlined,
      permission: 'jobcards.view',
      widget: JobCardsScreen(),
    ),
    BillingTabDefinition(
      label: 'Invoices',
      icon: Icons.receipt_long_outlined,
      permission: 'invoices.view',
      widget: InvoicesScreen(),
    ),
    BillingTabDefinition(
      label: 'Catalogue / Services',
      icon: Icons.inventory_2_outlined,
      permission: 'catalogue.view',
      widget: CatalogueScreen(),
    ),
  ];

  static bool _canAccess(AuthUser? user, String permission) {
    if (user == null) return false;
    if (user.isOwner || user.role.toLowerCase() == 'owner') return true;
    if (user.permissions.contains('*')) return true;
    return user.hasPermission(permission);
  }

  List<BillingTabDefinition> _getVisibleTabs(AuthUser? user) {
    return _allTabs.where((t) => _canAccess(user, t.permission)).toList();
  }

  int _resolveTargetIndex(
    List<BillingTabDefinition> visibleTabs,
    int requestedIndex,
  ) {
    if (visibleTabs.isEmpty) return 0;
    if (requestedIndex >= 0 && requestedIndex < _allTabs.length) {
      final requestedDef = _allTabs[requestedIndex];
      final idx = visibleTabs.indexOf(requestedDef);
      if (idx != -1) return idx;
    }
    final custIdx = visibleTabs.indexWhere(
      (t) => t.permission == 'customers.view',
    );
    if (custIdx != -1) return custIdx;
    final jcIdx = visibleTabs.indexWhere(
      (t) => t.permission == 'jobcards.view',
    );
    if (jcIdx != -1) return jcIdx;
    return 0;
  }

  bool _hasTabsChanged(
    List<BillingTabDefinition> a,
    List<BillingTabDefinition> b,
  ) {
    if (a.length != b.length) return true;
    for (int i = 0; i < a.length; i++) {
      if (a[i].permission != b[i].permission) return true;
    }
    return false;
  }

  AuthUser? _getCurrentUser() {
    final authState = ref.read(authNotifierProvider);
    if (authState is Authenticated) return authState.user;
    return ref.read(currentUserProvider);
  }

  @override
  void initState() {
    super.initState();
    final user = _getCurrentUser();
    _visibleTabs = _getVisibleTabs(user);
    final targetIndex = _resolveTargetIndex(
      _visibleTabs,
      widget.initialTabIndex,
    );
    _tabController = TabController(
      length: _visibleTabs.isEmpty ? 1 : _visibleTabs.length,
      initialIndex: _visibleTabs.isEmpty ? 0 : targetIndex,
      vsync: this,
    );
  }

  @override
  void didUpdateWidget(covariant BillingScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialTabIndex != widget.initialTabIndex &&
        _visibleTabs.isNotEmpty) {
      final targetIndex = _resolveTargetIndex(
        _visibleTabs,
        widget.initialTabIndex,
      );
      if (_tabController.index != targetIndex) {
        _tabController.animateTo(targetIndex);
      }
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _handleBackNavigation() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      context.go(AppRoutes.dashboard);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(systemPreferencesProvider);
    final authState = ref.watch(authNotifierProvider);
    final user = authState is Authenticated
        ? authState.user
        : ref.watch(currentUserProvider);

    final currentVisible = _getVisibleTabs(user);
    if (_hasTabsChanged(_visibleTabs, currentVisible)) {
      _visibleTabs = currentVisible;
      final targetIndex = _resolveTargetIndex(
        _visibleTabs,
        widget.initialTabIndex,
      );
      _tabController.dispose();
      _tabController = TabController(
        length: _visibleTabs.isEmpty ? 1 : _visibleTabs.length,
        initialIndex: _visibleTabs.isEmpty ? 0 : targetIndex,
        vsync: this,
      );
    }

    if (_visibleTabs.isEmpty) {
      return PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, result) {
          if (didPop) return;
          _handleBackNavigation();
        },
        child: Scaffold(
          appBar: AppBar(
            leading: IconButton(
              key: const Key('billing_unauthorized_back_button'),
              icon: const Icon(Icons.arrow_back_rounded),
              tooltip: 'Back to Dashboard',
              onPressed: _handleBackNavigation,
            ),
            title: const Text('Billing Suite'),
            actions: const [AppLogoutAction()],
          ),
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.lock_outline,
                    size: 56,
                    color: AppColors.error,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Access Restricted',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'You do not have permission to access Billing Suite.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: () => context.go(AppRoutes.dashboard),
                    icon: const Icon(Icons.dashboard_outlined),
                    label: const Text('Return to Suite Launcher'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _handleBackNavigation();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            key: const Key('billing_suite_back_button'),
            icon: const Icon(Icons.arrow_back_rounded),
            tooltip: 'Back to Dashboard',
            onPressed: _handleBackNavigation,
          ),
          title: const Text('Billing Suite'),
          elevation: 0,
          actions: const [AppLogoutAction()],
          bottom: TabBar(
            controller: _tabController,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            indicatorColor: Theme.of(context).colorScheme.primary,
            labelColor: Theme.of(context).colorScheme.primary,
            unselectedLabelColor: Theme.of(
              context,
            ).colorScheme.onSurfaceVariant,
            tabs: _visibleTabs
                .map(
                  (tab) => Tab(icon: Icon(tab.icon, size: 20), text: tab.label),
                )
                .toList(),
          ),
        ),
        body: BillingSuiteScope(
          child: TabBarView(
            controller: _tabController,
            children: _visibleTabs.map((tab) => tab.widget).toList(),
          ),
        ),
      ),
    );
  }
}
