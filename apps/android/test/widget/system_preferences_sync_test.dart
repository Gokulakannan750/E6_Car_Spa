import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:e6_car_spa/features/settings/data/settings_api.dart';
import 'package:e6_car_spa/features/settings/data/settings_repository.dart';
import 'package:e6_car_spa/features/settings/models/system_preferences_model.dart';
import 'package:e6_car_spa/features/settings/presentation/pages/system_preferences_screen.dart';

class MockSettingsRepository extends SettingsRepository {
  SystemPreferencesModel currentPreferences;

  MockSettingsRepository({
    this.currentPreferences = SystemPreferencesModel.defaultPreferences,
  }) : super(SettingsApi(Dio()));

  @override
  Future<SystemPreferencesModel?> getCachedSystemPreferences() async =>
      currentPreferences;

  @override
  Future<void> saveCachedSystemPreferences(SystemPreferencesModel prefs) async {
    currentPreferences = prefs;
  }

  @override
  Future<SystemPreferencesModel> getSystemPreferences() async =>
      currentPreferences;

  @override
  Future<SystemPreferencesModel> updateSystemPreferences(
    SystemPreferencesModel preferences,
  ) async {
    currentPreferences = preferences;
    return preferences;
  }

  @override
  Future<SystemPreferencesModel> resetSystemPreferences() async {
    currentPreferences = SystemPreferencesModel.defaultPreferences;
    return currentPreferences;
  }
}

void main() {
  testWidgets(
    'SystemPreferencesScreen renders all 7 synchronized preference sections and controls',
    (tester) async {
      tester.view.physicalSize = const Size(1200, 3600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final mockRepo = MockSettingsRepository();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [settingsRepositoryProvider.overrideWithValue(mockRepo)],
          child: const MaterialApp(home: SystemPreferencesScreen()),
        ),
      );

      await tester.pumpAndSettle();

      // Verify Title & Subtitle
      expect(find.text('System Preferences'), findsOneWidget);
      expect(find.text('Display & Application Settings'), findsOneWidget);

      // Section Titles
      expect(find.text('Date & Time'), findsOneWidget);
      expect(find.text('Currency & Formatting'), findsOneWidget);
      expect(find.text('Document Printing'), findsOneWidget);
      expect(find.text('Application Behavior'), findsOneWidget);
      expect(find.text('System Diagnostics'), findsOneWidget);

      // Controls
      expect(find.text('DD/MM/YYYY'), findsOneWidget);
      expect(find.text('12 Hours (AM/PM)'), findsOneWidget);
      expect(find.text('₹ (INR) — Indian Rupee'), findsOneWidget);
      expect(find.text('2 Decimals (.00)'), findsOneWidget);
      expect(find.text('1 Copy'), findsOneWidget);
      expect(find.text('Auto-Print Receipts'), findsOneWidget);
      expect(find.text('30 Seconds (Default)'), findsOneWidget);
    },
  );

  testWidgets(
    'SystemPreferencesScreen saves updated preferences to repository',
    (tester) async {
      tester.view.physicalSize = const Size(1200, 3600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final mockRepo = MockSettingsRepository();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [settingsRepositoryProvider.overrideWithValue(mockRepo)],
          child: const MaterialApp(home: SystemPreferencesScreen()),
        ),
      );

      await tester.pumpAndSettle();

      // Select YYYY-MM-DD
      final ymdChip = find.text('YYYY-MM-DD');
      await tester.ensureVisible(ymdChip);
      await tester.tap(ymdChip);
      await tester.pumpAndSettle();

      // Select 15 Seconds
      final intervalChip = find.text('15 Seconds');
      await tester.ensureVisible(intervalChip);
      await tester.tap(intervalChip);
      await tester.pumpAndSettle();

      // Click Save Preferences
      // Scroll to Save button
      final saveButton = find.byKey(const Key('save_preferences_button'));
      await tester.scrollUntilVisible(
        saveButton,
        500,
        scrollable: find.byType(Scrollable),
      );
      await tester.pumpAndSettle();
      await tester.tap(saveButton);
      await tester.pumpAndSettle();

      // Verify feedback and repository state
      expect(find.text('System preferences saved successfully.'), findsWidgets);
      expect(mockRepo.currentPreferences.dateFormat, 'YYYY-MM-DD');
      expect(mockRepo.currentPreferences.currencySymbol, '₹');
      expect(mockRepo.currentPreferences.refreshInterval, 15);
    },
  );

  testWidgets(
    'SystemPreferencesScreen reset to defaults restores canonical values',
    (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final mockRepo = MockSettingsRepository(
        currentPreferences: const SystemPreferencesModel(
          dateFormat: 'YYYY-MM-DD',
          currencySymbol: '\$',
          decimalPrecision: 0,
          refreshInterval: 60,
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [settingsRepositoryProvider.overrideWithValue(mockRepo)],
          child: const MaterialApp(home: SystemPreferencesScreen()),
        ),
      );

      await tester.pumpAndSettle();

      // Click Reset to Defaults
      final resetButton = find.byKey(const Key('reset_preferences_button'));
      await tester.scrollUntilVisible(
        resetButton,
        500,
        scrollable: find.byType(Scrollable),
      );
      await tester.pumpAndSettle();
      await tester.tap(resetButton);
      await tester.pumpAndSettle();

      // Confirm dialog
      expect(find.text('Reset Preferences'), findsOneWidget);
      final confirmButton = find.widgetWithText(FilledButton, 'Reset');
      await tester.tap(confirmButton);
      await tester.pumpAndSettle();

      expect(
        find.text('Preferences reset to standard defaults.'),
        findsWidgets,
      );
      expect(
        mockRepo.currentPreferences,
        equals(SystemPreferencesModel.defaultPreferences),
      );
    },
  );
}
