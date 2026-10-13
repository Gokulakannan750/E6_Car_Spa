import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/subscription/plan_features.dart';
import 'package:e6_car_spa/features/subscription/subscription_provider.dart';
import 'package:e6_car_spa/features/users/models/create_user_request.dart';
import 'package:e6_car_spa/features/users/models/update_user_request.dart';
import 'package:e6_car_spa/features/users/models/user_model.dart';
import 'package:e6_car_spa/features/users/presentation/widgets/user_form_sheet.dart';
import 'package:e6_car_spa/features/users/providers/users_provider.dart';
import 'package:e6_car_spa/features/users/providers/users_state.dart';

import 'user_form_test.dart' show TestUsersNotifier;

/// A subscription that is already loaded (no server call in tests).
class _FixedSubscription extends SubscriptionNotifier {
  _FixedSubscription(SubscriptionStatus? status) : super(null) {
    state = status;
  }
}

const _licences = SubscriptionStatus(
  managed: true,
  access: 'Full',
  licences: [
    LicenceUsage(appAccess: 'Both', total: 1, used: 1),
    LicenceUsage(appAccess: 'Windows', total: 0, used: 0),
    LicenceUsage(appAccess: 'Android', total: 2, used: 1),
  ],
);

void main() {
  tearDown(() => PlanFeatures.update(null));

  Widget form({UserModel? user, SubscriptionStatus? status, bool owner = true}) {
    PlanFeatures.update(status);
    return ProviderScope(
      overrides: [
        usersNotifierProvider.overrideWith(
          (ref) => TestUsersNotifier(const UsersLoaded(users: [], permissionGroups: [])),
        ),
        subscriptionStatusProvider.overrideWith((ref) => _FixedSubscription(status)),
        currentUserProvider.overrideWith(
          (ref) => AuthUser(
            id: 'me',
            fullName: 'Me',
            username: 'me',
            role: owner ? 'Owner' : 'Manager',
            isOwner: owner,
            permissions: const [],
          ),
        ),
      ],
      child: MaterialApp(
        home: Scaffold(body: UserFormSheet(user: user, permissionGroups: const [])),
      ),
    );
  }

  Future<void> tall(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 3200);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
  }

  testWidgets('a new user takes the first app type with a free licence', (tester) async {
    await tall(tester);
    await tester.pumpWidget(form(status: _licences));
    await tester.pumpAndSettle();

    expect(find.text('APP ACCESS'), findsOneWidget);
    // Windows + Android is full and Windows has none, so Android is chosen.
    expect(find.text('Android only — 1 of 2 free'), findsOneWidget);
  });

  testWidgets('only the Owner can change an existing user', (tester) async {
    await tall(tester);
    final user = UserModel(
      id: 'u1',
      fullName: 'Field Staff',
      username: 'field',
      role: 'Staff',
      isActive: true,
      createdAt: DateTime(2026),
      appAccess: 'Android',
    );
    await tester.pumpWidget(form(user: user, status: _licences, owner: false));
    await tester.pumpAndSettle();

    expect(find.text('Only the Owner can change it.'), findsOneWidget);
    // Their own Android licence counts as free for them.
    expect(find.text('Android only — 2 of 2 free'), findsOneWidget);
  });

  testWidgets('is hidden on a single-company server', (tester) async {
    await tall(tester);
    await tester.pumpWidget(form(status: null));
    await tester.pumpAndSettle();
    expect(find.text('APP ACCESS'), findsNothing);
  });

  test('requests carry the app access, and users read it', () {
    expect(
      const CreateUserRequest(
        fullName: 'A',
        username: 'a',
        password: 'p',
        confirmPassword: 'p',
        role: 'Staff',
        appAccess: 'Android',
      ).toJson()['appAccess'],
      'Android',
    );
    expect(const UpdateUserRequest(fullName: 'A').toJson().containsKey('appAccess'), isFalse);
    expect(UserModel.fromJson({'id': '1', 'appAccess': 'Windows'}).appAccess, 'Windows');
    expect(UserModel.fromJson({'id': '1'}).appAccess, 'Both');
    expect(_licences.freeLicences('Android'), 1);
    expect(appAccessLabel('Both'), 'Windows + Android');
  });
}
