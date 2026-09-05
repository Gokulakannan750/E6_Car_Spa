import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:e6_car_spa/features/auth/models/auth_user.dart';
import 'package:e6_car_spa/features/auth/providers/auth_provider.dart';
import 'package:e6_car_spa/features/auth/providers/auth_state.dart';
import 'package:e6_car_spa/features/jobcards/data/job_card_repository.dart';
import 'package:e6_car_spa/features/jobcards/models/job_card_model.dart';
import 'package:e6_car_spa/features/jobcards/presentation/pages/job_card_details_screen.dart';
import 'package:e6_car_spa/features/jobcards/providers/job_card_providers.dart';

class _FakeJobCardRepo implements JobCardRepository {
  final JobCard jobCard;
  _FakeJobCardRepo(this.jobCard);

  @override
  dynamic noSuchMethod(Invocation invocation) {
    if (invocation.memberName == #getJobCardById) {
      return Future.value(jobCard);
    }
    return super.noSuchMethod(invocation);
  }
}

void main() {
  const dummyCustomer = CustomerSummary(id: 'c1', name: 'John Doe', phoneNumber: '9876543210');
  const dummyVehicle = VehicleSummary(id: 'v1', registrationNumber: 'TN38AB1234', make: 'Hyundai', model: 'Creta');
  const dummyService = JobCardServiceItem(
    id: 's1',
    serviceId: 'svc1',
    serviceName: 'Full Spa',
    unitPrice: 1000.0,
    quantity: 1,
    taxPercentage: 18.0,
    lineTotal: 1180.0,
  );

  final editableJobCard = JobCard(
    id: 'jc-1',
    jobCardNumber: 'JC-2026-000001',
    customer: dummyCustomer,
    vehicle: dummyVehicle,
    status: JobCardStatus.inProgress,
    services: const [dummyService],
    subtotal: 1000.0,
    taxAmount: 180.0,
    totalAmount: 1180.0,
  );

  final lockedJobCard = JobCard(
    id: 'jc-2',
    jobCardNumber: 'JC-2026-000002',
    customer: dummyCustomer,
    vehicle: dummyVehicle,
    status: JobCardStatus.invoiced,
    services: const [dummyService],
    subtotal: 1000.0,
    taxAmount: 180.0,
    totalAmount: 1180.0,
    invoiceId: 'inv-1',
    invoiceNumber: 'INV-2026-000001',
    invoiceStatus: 'Paid',
  );

  group('Job Card Details Edit Button Tests', () {
    testWidgets('Edit button visible when user has jobcards.edit and job card is editable', (tester) async {
      const user = AuthUser(
        id: 'u1',
        fullName: 'Manager',
        username: 'mgr',
        role: 'Manager',
        isOwner: false,
        permissions: ['jobcards.view', 'jobcards.edit'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => AuthNotifierMock(const Authenticated(user))),
            jobCardRepositoryProvider.overrideWithValue(_FakeJobCardRepo(editableJobCard)),
            jobCardDetailsProvider('jc-1').overrideWith(
              (ref) => JobCardDetailsNotifier(
                'jc-1',
                _FakeJobCardRepo(editableJobCard),
                JobCardDetailsState(isLoading: false, jobCard: editableJobCard),
                false,
              ),
            ),
          ],
          child: const MaterialApp(
            home: JobCardDetailsScreen(jobCardId: 'jc-1'),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byKey(const Key('edit_job_card_button')), findsOneWidget);
      expect(find.byKey(const Key('edit_services_button')), findsOneWidget);
    });

    testWidgets('Edit button hidden when user lacks jobcards.edit permission', (tester) async {
      const user = AuthUser(
        id: 'u2',
        fullName: 'Viewer',
        username: 'view',
        role: 'Staff',
        isOwner: false,
        permissions: ['jobcards.view'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => AuthNotifierMock(const Authenticated(user))),
            jobCardRepositoryProvider.overrideWithValue(_FakeJobCardRepo(editableJobCard)),
            jobCardDetailsProvider('jc-1').overrideWith(
              (ref) => JobCardDetailsNotifier(
                'jc-1',
                _FakeJobCardRepo(editableJobCard),
                JobCardDetailsState(isLoading: false, jobCard: editableJobCard),
                false,
              ),
            ),
          ],
          child: const MaterialApp(
            home: JobCardDetailsScreen(jobCardId: 'jc-1'),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byKey(const Key('edit_job_card_button')), findsNothing);
      expect(find.byKey(const Key('edit_services_button')), findsNothing);
    });

    testWidgets('Edit button hidden when job card is locked by invoice', (tester) async {
      const user = AuthUser(
        id: 'u1',
        fullName: 'Manager',
        username: 'mgr',
        role: 'Manager',
        isOwner: false,
        permissions: ['jobcards.view', 'jobcards.edit'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => AuthNotifierMock(const Authenticated(user))),
            jobCardRepositoryProvider.overrideWithValue(_FakeJobCardRepo(lockedJobCard)),
            jobCardDetailsProvider('jc-2').overrideWith(
              (ref) => JobCardDetailsNotifier(
                'jc-2',
                _FakeJobCardRepo(lockedJobCard),
                JobCardDetailsState(isLoading: false, jobCard: lockedJobCard),
                false,
              ),
            ),
          ],
          child: const MaterialApp(
            home: JobCardDetailsScreen(jobCardId: 'jc-2'),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byKey(const Key('edit_job_card_button')), findsNothing);
      expect(find.byKey(const Key('edit_services_button')), findsNothing);
      expect(find.text('Job Card is Locked'), findsOneWidget);
    });
  });
}

class AuthNotifierMock extends StateNotifier<AuthState> implements AuthNotifier {
  AuthNotifierMock(super.initial);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
