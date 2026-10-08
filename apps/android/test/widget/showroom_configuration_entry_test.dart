import 'package:dio/dio.dart';
import 'package:e6_car_spa/config/routes.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/settings/models/system_preferences_model.dart';
import 'package:e6_car_spa/features/settings/providers/system_preferences_provider.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_api.dart';
import 'package:e6_car_spa/features/showroom/data/showroom_repository.dart';
import 'package:e6_car_spa/features/showroom/models/showroom_model.dart';
import 'package:e6_car_spa/features/showroom/presentation/pages/showroom_list_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// Showroom Configuration (vehicle types & work types) is reached from the Showroom app, not Settings.
class _EmptyShowroomRepository extends ShowroomRepository {
  _EmptyShowroomRepository() : super(ShowroomApi(Dio()));

  @override
  Future<List<Showroom>> getShowrooms({String? search, bool? isActive}) async =>
      [];
}

class _TestAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  _TestAuthNotifier(super.initialState);

  @override
  Future<bool> login(String username, String password) async => true;
  @override
  Future<void> logout() async => state = const Unauthenticated();
  @override
  Future<void> restoreSession() async {}
  @override
  void clearError() {}
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

const _viewer = AuthUser(
  id: 'u-1',
  username: 'viewer',
  fullName: 'Showroom Viewer',
  role: 'Manager',
  isOwner: false,
  permissions: ['showroom.view'],
);

Future<void> _pump(WidgetTester tester, String initialLocation) async {
  final router = GoRouter(
    initialLocation: initialLocation,
    routes: [
      GoRoute(
        path: AppRoutes.showroom,
        builder: (context, state) => const ShowroomListScreen(),
        routes: [
          GoRoute(
            path: 'configuration',
            builder: (context, state) =>
                const Scaffold(body: Text('configuration page')),
          ),
        ],
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        showroomRepositoryProvider.overrideWithValue(
          _EmptyShowroomRepository(),
        ),
        authNotifierProvider.overrideWith(
          (ref) => _TestAuthNotifier(const Authenticated(_viewer)),
        ),
        systemPreferencesProvider.overrideWithValue(
          const SystemPreferencesModel(refreshInterval: 0),
        ),
      ],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  test('configuration route lives under the Showroom app', () {
    expect(AppRoutes.showroomConfiguration, '/showroom/configuration');
  });

  testWidgets('Showroom app bar opens Showroom Configuration', (tester) async {
    await _pump(tester, AppRoutes.showroom);

    final button = find.byKey(const Key('showroom_configuration_button'));
    expect(button, findsOneWidget);
    expect(find.byTooltip('Showroom Configuration'), findsOneWidget);

    await tester.tap(button);
    await tester.pumpAndSettle();

    expect(find.text('configuration page'), findsOneWidget);
  });
}
