import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:e6_car_spa/features/reports/models/staff_productivity_report_model.dart';
import 'package:e6_car_spa/features/reports/models/showroom_report_model.dart';
import 'package:e6_car_spa/features/reports/presentation/pages/staff_productivity_screen.dart';
import 'package:e6_car_spa/features/reports/presentation/pages/showroom_report_screen.dart';
import 'package:e6_car_spa/features/reports/providers/reports_provider.dart';

void main() {
  final testStaffProductivityData = StaffProductivityReportResponseModel(
    totalStaff: 2,
    totalDaysAssigned: 4,
    totalVehiclesAttended: 5,
    totalServicesPerformed: 7,
    totalStaffHours: 6.5,
    overallDailyAverage: 2.5,
    averageVehiclesPerStaff: 2.5,
    averageServicesPerStaff: 3.5,
    items: [
      StaffProductivityRowModel(
        staffId: 'stf-1',
        staffName: 'Staff B (Replacement)',
        staffPhone: '9876543210',
        role: 'Detailer',
        homeShowroomName: 'Maruti True Value',
        workingShowroomName: 'Maruti Nexa',
        daysAssigned: 1,
        totalVehiclesAttended: 3,
        totalServicesPerformed: 3,
        totalWorkingHours: 4.0,
        dailyAverage: 3.0,
        vehicleTypes: const [
          StaffProductivityVehicleTypeGroupModel(
            vehicleTypeId: 'vt-suv',
            vehicleTypeCode: 'SUV',
            vehicleTypeName: 'SUV',
            vehicleCount: 3,
            serviceQuantity: 3,
            hours: 4.0,
            services: [
              StaffProductivityServiceItemModel(
                workTypeId: 'wt-wash',
                workTypeCode: 'EXTW',
                workTypeName: 'Exterior Wash',
                serviceCategory: 'Exterior',
                vehicleCount: 3,
                serviceQuantity: 3,
                hours: 4.0,
                assignmentType: 'Swapped',
                swapId: 'SWP-2026-001',
                originalStaffName: 'Staff A (Original)',
                replacementStaffName: 'Staff B (Replacement)',
              ),
            ],
          ),
        ],
        workRecords: [
          StaffProductivityWorkRecordModel(
            id: 'rec-1',
            date: DateTime(2026, 9, 27),
            showroomId: 'shw-nexa',
            showroomMasterId: 'shw-nexa',
            showroomName: 'Maruti Nexa',
            staffId: 'stf-1',
            staffMasterId: 'stf-1',
            staffName: 'Staff B (Replacement)',
            role: 'Detailer',
            vehicleTypeId: 'vt-suv',
            vehicleTypeCode: 'SUV',
            vehicleTypeName: 'SUV',
            workTypeId: 'wt-wash',
            workTypeCode: 'EXTW',
            workTypeName: 'Exterior Wash',
            vehicleQuantity: 3,
            serviceQuantity: 3,
            workingHours: 4.0,
            assignmentType: 'Swapped',
            swapId: 'SWP-2026-001',
            originalStaffName: 'Staff A (Original)',
            replacementStaffName: 'Staff B (Replacement)',
          ),
        ],
      ),
      StaffProductivityRowModel(
        staffId: 'stf-2',
        staffName: 'Staff C (Regular)',
        staffPhone: '9876543211',
        role: 'Washer',
        homeShowroomName: 'Maruti Nexa',
        workingShowroomName: 'Maruti Nexa',
        daysAssigned: 1,
        totalVehiclesAttended: 2,
        totalServicesPerformed: 4,
        totalWorkingHours: 2.5,
        dailyAverage: 2.0,
        vehicleTypes: const [
          StaffProductivityVehicleTypeGroupModel(
            vehicleTypeId: 'vt-sedan',
            vehicleTypeCode: 'SEDAN',
            vehicleTypeName: 'Sedan',
            vehicleCount: 2,
            serviceQuantity: 4,
            hours: 2.5,
            services: [
              StaffProductivityServiceItemModel(
                workTypeId: 'wt-interior',
                workTypeCode: 'INTC',
                workTypeName: 'Interior Cleaning',
                serviceCategory: 'Interior',
                vehicleCount: 2,
                serviceQuantity: 2,
                hours: 1.5,
                assignmentType: 'Regular',
              ),
              StaffProductivityServiceItemModel(
                workTypeId: 'wt-wax',
                workTypeCode: 'WAX',
                workTypeName: 'Full Body Wax',
                serviceCategory: 'Exterior',
                vehicleCount: 2,
                serviceQuantity: 2,
                hours: 1.0,
                assignmentType: 'Regular',
              ),
            ],
          ),
        ],
        workRecords: [
          StaffProductivityWorkRecordModel(
            id: 'rec-2',
            date: DateTime(2026, 9, 27),
            showroomId: 'shw-nexa',
            showroomMasterId: 'shw-nexa',
            showroomName: 'Maruti Nexa',
            staffId: 'stf-2',
            staffMasterId: 'stf-2',
            staffName: 'Staff C (Regular)',
            role: 'Washer',
            vehicleTypeId: 'vt-sedan',
            vehicleTypeCode: 'SEDAN',
            vehicleTypeName: 'Sedan',
            workTypeId: 'wt-interior',
            workTypeCode: 'INTC',
            workTypeName: 'Interior Cleaning',
            vehicleQuantity: 2,
            serviceQuantity: 2,
            workingHours: 1.5,
            assignmentType: 'Regular',
          ),
        ],
      ),
    ],
  );

  final testMonthlyShowroomData = MonthlyShowroomReportResponseModel(
    year: 2026,
    month: 9,
    monthName: 'September 2026',
    fromDate: DateTime(2026, 9, 1),
    toDate: DateTime(2026, 9, 30),
    showrooms: [
      MonthlyShowroomDetailModel(
        showroomId: 'shw-nexa',
        showroomMasterId: 'shw-nexa',
        showroomName: 'Maruti Nexa',
        showroomAddress: 'Bypass Road, Coimbatore',
        showroomPhone: '0422-1234567',
        showroomGstin: '33AABCU9603R1ZM',
        summary: const MonthlyShowroomSummaryModel(
          totalVehiclesServiced: 5,
          totalWorkEntries: 2,
          totalServicesPerformed: 7,
          totalActiveStaff: 2,
          totalBilledAmount: 4500.0,
          totalCollectedAmount: 4500.0,
          totalOutstandingAmount: 0.0,
          totalBillingDays: 1,
          paidDaysCount: 1,
          partiallyPaidDaysCount: 0,
          unpaidDaysCount: 0,
          totalStaffHours: 6.5,
          totalAttendanceDays: 2,
          totalSwaps: 1,
        ),
        vehicleWorks: [
          MonthlyShowroomVehicleWorkRowModel(
            id: 'work-1',
            date: DateTime(2026, 9, 27),
            showroomId: 'shw-nexa',
            showroomMasterId: 'shw-nexa',
            showroomName: 'Maruti Nexa',
            staffId: 'stf-1',
            staffMasterId: 'stf-1',
            staffName: 'Staff B (Replacement)',
            staffRole: 'Detailer',
            vehicleTypeId: 'vt-suv',
            vehicleTypeCode: 'SUV',
            vehicleTypeName: 'SUV',
            vehicleQuantity: 3,
            servicesSummary: 'Exterior Wash',
            workingHours: 4.0,
            paymentStatus: 'Paid',
            assignmentType: 'Swapped',
            swapId: 'SWP-2026-001',
            originalStaffName: 'Staff A (Original)',
            replacementStaffName: 'Staff B (Replacement)',
          ),
        ],
        attendanceRecords: [
          ShowroomAttendanceReportRowModel(
            date: DateTime(2026, 9, 27),
            staffId: 'stf-1',
            staffMasterId: 'stf-1',
            staffName: 'Staff B (Replacement)',
            role: 'Detailer',
            homeShowroomName: 'Maruti True Value',
            workingShowroomName: 'Maruti Nexa',
            attendanceStatus: 'Present',
            scheduledHours: 8.0,
            actualHours: 8.0,
            confirmationStatus: 'Confirmed',
            confirmedByName: 'Supervisor John',
            confirmedAt: DateTime(2026, 9, 27, 18, 0),
          ),
        ],
        swaps: [
          ShowroomStaffSwapReportRowModel(
            swapId: 'SWP-2026-001',
            date: DateTime(2026, 9, 27),
            showroomName: 'Maruti Nexa',
            staffAId: 'stf-0',
            staffAMasterId: 'stf-0',
            staffAName: 'Staff A (Original)',
            staffBId: 'stf-1',
            staffBMasterId: 'stf-1',
            staffBName: 'Staff B (Replacement)',
            originalWorkingTime: '09:00 - 18:00',
            replacementWorkingTime: '09:00 - 13:00',
            swapStartTime: '09:00',
            swapEndTime: '13:00',
            swapHours: 4.0,
            reason: 'Emergency Relief',
            createdByName: 'Admin',
            createdAt: DateTime(2026, 9, 27, 8, 30),
            status: 'Active',
          ),
        ],
        vehicleTypeSummary: const [
          ShowroomVehicleTypeSummaryModel(
            vehicleTypeId: 'vt-suv',
            vehicleTypeCode: 'SUV',
            vehicleTypeName: 'SUV',
            totalVehicles: 3,
            totalServices: 3,
            totalStaffHours: 4.0,
            sharePercentage: 60.0,
          ),
          ShowroomVehicleTypeSummaryModel(
            vehicleTypeId: 'vt-sedan',
            vehicleTypeCode: 'SEDAN',
            vehicleTypeName: 'Sedan',
            totalVehicles: 2,
            totalServices: 4,
            totalStaffHours: 2.5,
            sharePercentage: 40.0,
          ),
        ],
        serviceSummary: const [
          ShowroomServiceSummaryModel(
            workTypeId: 'wt-wash',
            serviceCategory: 'Exterior',
            serviceCode: 'EXTW',
            serviceName: 'Exterior Wash',
            totalVehicles: 3,
            totalQuantity: 3,
            totalStaffHours: 4.0,
            sharePercentage: 42.8,
          ),
        ],
        staffSummary: const [
          ShowroomStaffSummaryModel(
            staffId: 'stf-1',
            staffMasterId: 'stf-1',
            staffName: 'Staff B (Replacement)',
            role: 'Detailer',
            homeShowroom: 'Maruti True Value',
            assignmentType: 'Swapped',
            totalVehicles: 3,
            totalServices: 3,
            totalHours: 4.0,
            attendanceDays: 1,
            workloadSharePercent: 60.0,
          ),
        ],
      ),
    ],
  );

  group('Staff Productivity & Showroom Reports Widget Tests', () {
    testWidgets('StaffProductivityScreen renders KPI cards, staff cards and swap badges', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            staffProductivityProvider.overrideWith((ref) => Future.value(testStaffProductivityData)),
          ],
          child: const MaterialApp(
            home: StaffProductivityScreen(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('PRODUCTIVITY SUMMARY'), findsOneWidget);
      expect(find.text('5 Cars'), findsOneWidget);
      expect(find.text('7 Services Performed'), findsOneWidget);
      expect(find.text('6.5h'), findsOneWidget);
      expect(find.text('Staff B (Replacement)'), findsOneWidget);
      expect(find.text('Staff C (Regular)'), findsOneWidget);
      expect(find.text('Swap Work'), findsOneWidget);
    });

    testWidgets('ShowroomReportScreen renders all 5 tabs and swap data', (tester) async {
      tester.view.physicalSize = const Size(1200, 1000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            monthlyShowroomReportProvider.overrideWith((ref) => Future.value(testMonthlyShowroomData)),
          ],
          child: const MaterialApp(
            home: ShowroomReportScreen(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // Overview Tab
      expect(find.text('Overview'), findsOneWidget);
      expect(find.text('Vehicles & Services'), findsOneWidget);
      expect(find.text('Staff Productivity'), findsOneWidget);
      expect(find.text('Attendance'), findsOneWidget);
      expect(find.text('Staff Swaps'), findsOneWidget);
      expect(find.text('5 Vehicles Serviced'), findsOneWidget);
      expect(find.text('Vehicle Type Breakdown'), findsOneWidget);

      // Tap on Staff Swaps tab
      await tester.tap(find.text('Staff Swaps'));
      await tester.pumpAndSettle();

      expect(find.textContaining('SWP-2026-001'), findsOneWidget);
      expect(find.text('Original: Staff A (Original)'), findsOneWidget);
      expect(find.text('Replacement: Staff B (Replacement)'), findsOneWidget);
      expect(find.text('Active Swap'), findsOneWidget);
    });
  });
}
