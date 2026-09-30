import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:e6_car_spa/core/theme/app_theme.dart';
import 'package:e6_car_spa/features/jobcards/models/outside_job_model.dart';
import 'package:e6_car_spa/features/jobcards/presentation/widgets/outside_jobs_section.dart';
import 'package:e6_car_spa/features/jobcards/data/outside_job_repository.dart';
import 'package:e6_car_spa/features/jobcards/data/outside_job_api.dart';
import 'package:e6_car_spa/features/staff/models/staff_model.dart';
import 'package:dio/dio.dart';

import 'package:e6_car_spa/features/staff/data/staff_repository.dart';
import 'package:e6_car_spa/features/staff/data/staff_api.dart';

class _FakeStaffRepo extends StaffRepository {
  final List<Staff> staff;
  _FakeStaffRepo(this.staff) : super(StaffApi(Dio()));

  @override
  Future<List<Staff>> getStaff({bool? activeOnly}) async => staff;
}

class _MockOutsideJobRepo extends OutsideJobRepository {
  CreateOutsideJobRequest? lastCreatedRequest;
  UpdateOutsideJobCostRequest? lastUpdateCostRequest;
  String? lastDeletedId;
  CreateVendorRequest? lastCreatedVendorRequest;
  List<OutsideJob> mockJobs = [];

  _MockOutsideJobRepo() : super(OutsideJobApi(Dio()));

  @override
  Future<List<OutsideJob>> getByJobCardId(String jobCardId) async {
    return mockJobs;
  }

  List<Vendor> mockVendors = [
    const Vendor(
      id: 'vendor-1',
      name: 'Auto Paint Pro',
      phone: '9876543210',
      serviceSpecialty: 'Painting',
      isActive: true,
    ),
    const Vendor(
      id: 'vendor-2',
      name: 'Speedy Alignment',
      phone: '9876543211',
      serviceSpecialty: 'Alignment',
      isActive: true,
    ),
  ];

  @override
  Future<List<Vendor>> getVendors({bool? activeOnly}) async {
    return List.from(mockVendors);
  }

  @override
  Future<Vendor> createVendor(CreateVendorRequest request) async {
    lastCreatedVendorRequest = request;
    final vendor = Vendor(
      id: 'vendor-new-1',
      name: request.name,
      phone: request.phone,
      serviceSpecialty: request.serviceSpecialty,
      isActive: true,
    );
    mockVendors.add(vendor);
    return vendor;
  }

  @override
  Future<OutsideJob> createOutsideJob(
    String jobCardId,
    CreateOutsideJobRequest request,
  ) async {
    lastCreatedRequest = request;
    final job = OutsideJob(
      id: 'job-1',
      jobCardId: jobCardId,
      jobCardNumber: 'JC-001',
      vehicleId: 'veh-1',
      vehicleRegistrationNumber: 'TN33711E',
      vehicleMake: 'BMW',
      vehicleModel: 'M340i',
      customerId: 'cust-1',
      customerName: 'Gokul',
      customerPhone: '9876543210',
      vendorId: request.vendorId,
      vendorName: 'Auto Paint Pro',
      serviceName: request.serviceName,
      status: OutsideJobStatus.outside,
      statusName: 'Outside',
      sentAt: request.sentAt ?? DateTime.now(),
      expectedReturnAt: DateTime.now().add(const Duration(days: 1)),
      returnedAt: null,
      isOverdue: false,
      sentByUserId: request.sentByStaffId,
      sentByUserName: request.sentByStaffName ?? request.sentByType,
      notes: request.notes,
      createdAt: DateTime.now(),
    );
    mockJobs.add(job);
    return job;
  }

  @override
  Future<OutsideJob> updateCost(
    String outsideJobId,
    UpdateOutsideJobCostRequest request,
  ) async {
    lastUpdateCostRequest = request;
    final index = mockJobs.indexWhere((j) => j.id == outsideJobId);
    if (index >= 0) {
      final old = mockJobs[index];
      final updated = OutsideJob(
        id: old.id,
        jobCardId: old.jobCardId,
        jobCardNumber: old.jobCardNumber,
        vehicleId: old.vehicleId,
        vehicleRegistrationNumber: old.vehicleRegistrationNumber,
        vehicleMake: old.vehicleMake,
        vehicleModel: old.vehicleModel,
        customerId: old.customerId,
        customerName: old.customerName,
        customerPhone: old.customerPhone,
        vendorId: old.vendorId,
        vendorName: old.vendorName,
        vendorPhone: old.vendorPhone,
        serviceId: old.serviceId,
        serviceName: old.serviceName,
        status: old.status,
        statusName: old.statusName,
        sentAt: old.sentAt,
        expectedReturnAt: old.expectedReturnAt,
        returnedAt: old.returnedAt,
        isOverdue: old.isOverdue,
        sentByUserId: old.sentByUserId,
        sentByUserName: old.sentByUserName,
        returnedByUserId: old.returnedByUserId,
        returnedByUserName: old.returnedByUserName,
        vendorCost: request.vendorCost,
        notes: old.notes,
        returnNotes: old.returnNotes,
        cancellationReason: old.cancellationReason,
        createdAt: old.createdAt,
        updatedAt: DateTime.now(),
      );
      mockJobs[index] = updated;
      return updated;
    }
    throw Exception('Job not found');
  }

  @override
  Future<void> deleteOutsideJob(String outsideJobId) async {
    lastDeletedId = outsideJobId;
    mockJobs.removeWhere((j) => j.id == outsideJobId);
  }
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  const mockStaff = [
    Staff(
      id: 'staff-1',
      name: 'Murugan',
      phoneNumber: '9876500001',
      role: 'Detailer',
      isActive: true,
    ),
    Staff(
      id: 'staff-2',
      name: 'Karthik',
      phoneNumber: '9876500002',
      role: 'Technician',
      isActive: true,
    ),
  ];

  group('OutsideJobsSection Simplified Form Tests', () {
    testWidgets(
      'Renders OutsideJobsSection and opens simplified Send Outside sheet',
      (tester) async {
        final mockRepo = _MockOutsideJobRepo();

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              outsideJobRepositoryProvider.overrideWithValue(mockRepo),
              staffRepositoryProvider.overrideWithValue(
                _FakeStaffRepo(mockStaff),
              ),
            ],
            child: MaterialApp(
              theme: AppTheme.light,
              home: const Scaffold(
                body: SingleChildScrollView(
                  child: OutsideJobsSection(
                    jobCardId: 'jc-100',
                    vehicleRegistration: 'TN33711E',
                    vehicleModel: 'BMW M340i',
                  ),
                ),
              ),
            ),
          ),
        );

        await tester.pumpAndSettle();

        // Check header and empty state
        expect(find.text('Outside Jobs & Vehicle Movement'), findsOneWidget);
        expect(find.text('Send Vehicle Outside'), findsOneWidget);

        // Open Send Vehicle Outside sheet
        await tester.tap(find.text('Send Vehicle Outside'));
        await tester.pumpAndSettle();

        // Verify the 5 required fields are present
        expect(find.text('Outside Service *'), findsOneWidget);
        expect(find.text('Outside Shop / Vendor *'), findsOneWidget);
        expect(find.text('Sent Date & Time *'), findsOneWidget);
        expect(find.text('Sent By *'), findsOneWidget);
        expect(find.text('Notes'), findsOneWidget);

        // Verify REMOVED fields are NOT present
        expect(find.text('Expected Return *'), findsNothing);
        expect(find.text('Expected Return'), findsNothing);
        expect(find.text('Estimated Vendor Cost (₹)'), findsNothing);
        expect(find.text('Estimated Vendor Cost'), findsNothing);
        expect(find.text('Driver / Transport Contact'), findsNothing);
        expect(find.text('Driver Phone'), findsNothing);

        // Verify NO suggestion chips are present
        expect(find.text('Wheel Alignment & Balancing'), findsNothing);
        expect(find.text('Tinkering Work'), findsNothing);
        expect(find.text('Windshield & Glass Replacement'), findsNothing);
        expect(find.text('Electrical & AC Service'), findsNothing);
        expect(find.text('Upholstery & Interior Trim'), findsNothing);
        expect(find.text('Bumper Repair & Plastic Welding'), findsNothing);
        expect(find.text('Ceramic Coating Top-up'), findsNothing);

        // Verify action buttons
        expect(find.text('Cancel'), findsOneWidget);
        expect(find.text('Send Outside'), findsOneWidget);
      },
    );

    testWidgets('Submitting with Staff requires staff member selection', (
      tester,
    ) async {
      final mockRepo = _MockOutsideJobRepo();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            outsideJobRepositoryProvider.overrideWithValue(mockRepo),
            staffRepositoryProvider.overrideWithValue(
              _FakeStaffRepo(mockStaff),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const Scaffold(
              body: SingleChildScrollView(
                child: OutsideJobsSection(
                  jobCardId: 'jc-100',
                  vehicleRegistration: 'TN33711E',
                  vehicleModel: 'BMW M340i',
                ),
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Open sheet
      await tester.tap(find.text('Send Vehicle Outside'));
      await tester.pumpAndSettle();

      // Enter Service
      await tester.enterText(
        find.byWidgetPredicate(
          (w) =>
              w is TextField &&
              w.decoration?.hintText ==
                  'e.g. Denting & Painting, Wheel Alignment',
        ),
        'Denting Work',
      );

      // Select Vendor
      await tester.ensureVisible(find.text('Select Vendor'));
      await tester.tap(find.text('Select Vendor'), warnIfMissed: false);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Auto Paint Pro (Painting)').last);
      await tester.pumpAndSettle();

      // Switch Sent By to Staff
      await tester.ensureVisible(find.text('Owner'));
      await tester.tap(find.text('Owner'), warnIfMissed: false);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Staff').last);
      await tester.pumpAndSettle();

      // Staff Member * dropdown should now appear
      expect(find.text('Staff Member *'), findsOneWidget);

      // Select Staff
      await tester.ensureVisible(find.text('Select Staff Member'));
      await tester.tap(find.text('Select Staff Member'), warnIfMissed: false);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Murugan (Detailer)').last);
      await tester.pumpAndSettle();

      // Tap Send Outside
      await tester.ensureVisible(find.text('Send Outside'));
      await tester.tap(find.text('Send Outside'), warnIfMissed: false);
      await tester.pumpAndSettle();

      // Verify request payload was received by repo
      expect(mockRepo.lastCreatedRequest, isNotNull);
      expect(mockRepo.lastCreatedRequest!.serviceName, 'Denting Work');
      expect(mockRepo.lastCreatedRequest!.vendorId, 'vendor-1');
      expect(mockRepo.lastCreatedRequest!.sentByType, 'Staff');
      expect(mockRepo.lastCreatedRequest!.sentByStaffId, 'staff-1');
      expect(mockRepo.lastCreatedRequest!.sentByStaffName, 'Murugan');
    });

    testWidgets(
      'OutsideJobsSection when isLocked is true disables Send Vehicle Outside button',
      (tester) async {
        final mockRepo = _MockOutsideJobRepo();
        final mockStaffRepo = _FakeStaffRepo(mockStaff);

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              outsideJobRepositoryProvider.overrideWithValue(mockRepo),
              staffRepositoryProvider.overrideWithValue(mockStaffRepo),
            ],
            child: MaterialApp(
              theme: AppTheme.light,
              home: const Scaffold(
                body: SingleChildScrollView(
                  child: OutsideJobsSection(
                    jobCardId: 'jc-locked-1',
                    vehicleRegistration: 'TN01AB1234',
                    vehicleModel: 'Swift',
                    isLocked: true,
                  ),
                ),
              ),
            ),
          ),
        );

        await tester.pumpAndSettle();

        final btn = find.byKey(const Key('btn_send_outside'));
        expect(btn, findsOneWidget);
        expect(find.text('Send Vehicle Outside (Locked)'), findsOneWidget);

        final outlinedButton = tester.widget<OutlinedButton>(btn);
        expect(outlinedButton.onPressed, isNull);
      },
    );

    testWidgets(
      'OutsideJobsSection allows editing vendor cost and removing movement record',
      (tester) async {
        final mockRepo = _MockOutsideJobRepo();
        final mockStaffRepo = _FakeStaffRepo(mockStaff);

        final returnedJob = OutsideJob(
          id: 'job-returned-1',
          jobCardId: 'jc-edit-1',
          jobCardNumber: 'JC-002',
          vehicleId: 'veh-1',
          vehicleRegistrationNumber: 'TN33711E',
          vehicleMake: 'BMW',
          vehicleModel: 'M340i',
          customerId: 'cust-1',
          customerName: 'Gokul',
          customerPhone: '9876543210',
          vendorId: 'vendor-1',
          vendorName: 'Auto Paint Pro',
          serviceName: 'Denting & Painting',
          status: OutsideJobStatus.returned,
          statusName: 'Returned',
          sentAt: DateTime.now().subtract(const Duration(days: 1)),
          expectedReturnAt: DateTime.now(),
          returnedAt: DateTime.now(),
          isOverdue: false,
          vendorCost: 500.0,
          createdAt: DateTime.now().subtract(const Duration(days: 1)),
        );
        mockRepo.mockJobs = [returnedJob];

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              outsideJobRepositoryProvider.overrideWithValue(mockRepo),
              staffRepositoryProvider.overrideWithValue(mockStaffRepo),
            ],
            child: MaterialApp(
              theme: AppTheme.light,
              home: const Scaffold(
                body: SingleChildScrollView(
                  child: OutsideJobsSection(
                    jobCardId: 'jc-edit-1',
                    vehicleRegistration: 'TN33711E',
                    vehicleModel: 'M340i',
                  ),
                ),
              ),
            ),
          ),
        );

        await tester.pumpAndSettle();

        // Check Edit Cost button exists and tap it
        final editCostBtn = find.byKey(
          const Key('btn_edit_cost_job-returned-1'),
        );
        expect(editCostBtn, findsOneWidget);
        await tester.tap(editCostBtn);
        await tester.pumpAndSettle();

        // Edit cost dialog appears
        expect(find.text('Edit Vendor Cost'), findsOneWidget);
        await tester.enterText(
          find.byKey(const Key('input_edit_vendor_cost')),
          '1500',
        );

        // Save cost
        await tester.tap(find.byKey(const Key('btn_save_vendor_cost')));
        await tester.pumpAndSettle();

        expect(mockRepo.lastUpdateCostRequest, isNotNull);
        expect(mockRepo.lastUpdateCostRequest!.vendorCost, 1500.0);

        // Now test Remove button
        final removeBtn = find.byKey(
          const Key('btn_delete_movement_job-returned-1'),
        );
        expect(removeBtn, findsOneWidget);
        await tester.tap(removeBtn);
        await tester.pumpAndSettle();

        expect(find.text('Remove Movement'), findsOneWidget);
        await tester.tap(find.byKey(const Key('btn_confirm_delete_movement')));
        await tester.pumpAndSettle();

        expect(mockRepo.lastDeletedId, 'job-returned-1');
      },
    );

    testWidgets('New Vendor form validates 10-digit phone number correctly', (
      tester,
    ) async {
      final mockRepo = _MockOutsideJobRepo();
      final mockStaffRepo = _FakeStaffRepo(mockStaff);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            outsideJobRepositoryProvider.overrideWithValue(mockRepo),
            staffRepositoryProvider.overrideWithValue(mockStaffRepo),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const Scaffold(
              body: SingleChildScrollView(
                child: OutsideJobsSection(
                  jobCardId: 'jc-vendor-test-1',
                  vehicleRegistration: 'TN33711E',
                  vehicleModel: 'M340i',
                ),
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Open Send Outside sheet
      await tester.tap(find.text('Send Vehicle Outside'));
      await tester.pumpAndSettle();

      // Toggle New Vendor form
      final toggleBtn = find.byKey(const Key('btn_toggle_new_vendor'));
      expect(toggleBtn, findsOneWidget);
      await tester.ensureVisible(toggleBtn);
      await tester.tap(toggleBtn);
      await tester.pumpAndSettle();

      // Check fields appear
      expect(find.byKey(const Key('input_new_vendor_name')), findsOneWidget);
      expect(find.byKey(const Key('input_new_vendor_phone')), findsOneWidget);
      expect(find.byKey(const Key('btn_create_vendor')), findsOneWidget);

      // Enter vendor name
      await tester.enterText(
        find.byKey(const Key('input_new_vendor_name')),
        'Apex Detailing Works',
      );

      // Enter invalid 9-digit phone
      await tester.enterText(
        find.byKey(const Key('input_new_vendor_phone')),
        '987654321',
      );

      await tester.ensureVisible(find.byKey(const Key('btn_create_vendor')));
      await tester.tap(find.byKey(const Key('btn_create_vendor')));
      await tester.pumpAndSettle();

      // Expect validation error
      expect(
        find.text('Phone number must be exactly 10 digits.'),
        findsOneWidget,
      );
      expect(mockRepo.lastCreatedVendorRequest, isNull);

      // Enter invalid non-numeric phone
      await tester.enterText(
        find.byKey(const Key('input_new_vendor_phone')),
        '98765abcde',
      );
      await tester.tap(find.byKey(const Key('btn_create_vendor')));
      await tester.pumpAndSettle();

      expect(
        find.text('Phone number must be exactly 10 digits.'),
        findsOneWidget,
      );
      expect(mockRepo.lastCreatedVendorRequest, isNull);

      // Enter valid 10-digit phone
      await tester.enterText(
        find.byKey(const Key('input_new_vendor_phone')),
        '9876543210',
      );
      await tester.tap(find.byKey(const Key('btn_create_vendor')));
      await tester.pumpAndSettle();

      // Expect success: error gone and vendor created in repo
      expect(
        find.text('Phone number must be exactly 10 digits.'),
        findsNothing,
      );
      expect(mockRepo.lastCreatedVendorRequest, isNotNull);
      expect(mockRepo.lastCreatedVendorRequest!.name, 'Apex Detailing Works');
      expect(mockRepo.lastCreatedVendorRequest!.phone, '9876543210');
    });
  });
}
