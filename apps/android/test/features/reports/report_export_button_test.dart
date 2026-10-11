import 'package:e6_car_spa/core/errors/api_exception.dart';
import 'package:e6_car_spa/features/reports/export/report_file_service.dart';
import 'package:e6_car_spa/features/reports/presentation/widgets/report_export_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class RecordingService extends ReportFileService {
  final List<List<ReportFile>> shared = [];

  @override
  Future<void> share(List<ReportFile> files, {String? subject}) async {
    shared.add(files);
  }
}

Future<RecordingService> pump(
  WidgetTester tester,
  Future<List<ReportFile>> Function(WidgetRef, String?) build,
) async {
  final service = RecordingService();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [reportFileServiceProvider.overrideWithValue(service)],
      child: MaterialApp(
        home: Scaffold(
          appBar: AppBar(actions: [ReportExportButton(build: build)]),
        ),
      ),
    ),
  );
  return service;
}

void main() {
  testWidgets('tapping builds the files and hands them to the share sheet', (
    tester,
  ) async {
    String? companyAsked = 'unset';
    final service = await pump(tester, (ref, company) async {
      companyAsked = company;
      return [
        const ReportFile('A.xlsx', [1, 2, 3]),
        const ReportFile('B.xlsx', [4]),
      ];
    });

    await tester.tap(find.byKey(const Key('report_export_button')));
    await tester.pumpAndSettle();

    expect(service.shared.single.map((f) => f.fileName), ['A.xlsx', 'B.xlsx']);
    expect(companyAsked, isNull, reason: 'no company name loaded yet');
    expect(find.byKey(const Key('report_export_button')), findsOneWidget);
  });

  testWidgets('a server problem is shown and nothing is shared', (
    tester,
  ) async {
    final service = await pump(
      tester,
      (ref, company) async =>
          throw ApiException(message: 'The report could not be loaded.'),
    );

    await tester.tap(find.byKey(const Key('report_export_button')));
    await tester.pumpAndSettle();

    expect(service.shared, isEmpty);
    expect(find.text('The report could not be loaded.'), findsOneWidget);
  });

  testWidgets('any other failure gets a plain message', (tester) async {
    final service = await pump(
      tester,
      (ref, company) async => throw StateError('boom'),
    );

    await tester.tap(find.byKey(const Key('report_export_button')));
    await tester.pumpAndSettle();

    expect(service.shared, isEmpty);
    expect(find.text('Could not create the Excel file.'), findsOneWidget);
  });

  testWidgets('shows a spinner while the file is being made', (tester) async {
    await pump(tester, (ref, company) async {
      await Future<void>.delayed(const Duration(milliseconds: 300));
      return const [
        ReportFile('A.xlsx', [1]),
      ];
    });

    await tester.tap(find.byKey(const Key('report_export_button')));
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.byKey(const Key('report_export_button')), findsNothing);
    await tester.pumpAndSettle();
  });
}
