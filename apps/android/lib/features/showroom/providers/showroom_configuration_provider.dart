import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/api_exception.dart';
import '../data/showroom_repository.dart';
import '../models/showroom_operations_model.dart';

@immutable
class ShowroomConfigurationState {
  final List<ShowroomVehicleType> vehicleTypes;
  final List<ShowroomWorkType> workTypes;
  final bool isLoading;
  final bool isMutating;
  final String? errorMessage;

  const ShowroomConfigurationState({
    this.vehicleTypes = const [],
    this.workTypes = const [],
    this.isLoading = false,
    this.isMutating = false,
    this.errorMessage,
  });

  ShowroomConfigurationState copyWith({
    List<ShowroomVehicleType>? vehicleTypes,
    List<ShowroomWorkType>? workTypes,
    bool? isLoading,
    bool? isMutating,
    String? errorMessage,
    bool clearError = false,
  }) {
    return ShowroomConfigurationState(
      vehicleTypes: vehicleTypes ?? this.vehicleTypes,
      workTypes: workTypes ?? this.workTypes,
      isLoading: isLoading ?? this.isLoading,
      isMutating: isMutating ?? this.isMutating,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class ShowroomConfigurationNotifier
    extends StateNotifier<ShowroomConfigurationState> {
  final ShowroomRepository _repository;

  ShowroomConfigurationNotifier(this._repository)
      : super(const ShowroomConfigurationState()) {
    loadConfiguration();
  }

  Future<void> loadConfiguration({bool silent = false}) async {
    if (!silent) {
      state = state.copyWith(isLoading: true, clearError: true);
    }
    try {
      final vTypesFuture = _repository.getShowroomVehicleTypes();
      final wTypesFuture = _repository.getShowroomWorkTypes();
      final results = await Future.wait([vTypesFuture, wTypesFuture]);

      state = state.copyWith(
        vehicleTypes: results[0] as List<ShowroomVehicleType>,
        workTypes: results[1] as List<ShowroomWorkType>,
        isLoading: false,
        clearError: true,
      );
    } on ApiException catch (e) {
      if (!silent) {
        state = state.copyWith(isLoading: false, errorMessage: e.message);
      }
    } catch (e) {
      if (!silent) {
        state = state.copyWith(
          isLoading: false,
          errorMessage: 'Failed to load showroom configuration.',
        );
      }
    }
  }

  Future<void> createVehicleType({
    required String name,
    int displayOrder = 0,
  }) async {
    state = state.copyWith(isMutating: true, clearError: true);
    try {
      await _repository.createShowroomVehicleType(
        name: name,
        displayOrder: displayOrder,
      );
      await loadConfiguration(silent: true);
      state = state.copyWith(isMutating: false);
    } on ApiException catch (e) {
      state = state.copyWith(isMutating: false, errorMessage: e.message);
      rethrow;
    } catch (e) {
      state = state.copyWith(
        isMutating: false,
        errorMessage: 'Failed to create vehicle type.',
      );
      rethrow;
    }
  }

  Future<void> updateVehicleType(
    String id, {
    required String name,
    int displayOrder = 0,
    bool isActive = true,
  }) async {
    state = state.copyWith(isMutating: true, clearError: true);
    try {
      await _repository.updateShowroomVehicleType(
        id,
        name: name,
        displayOrder: displayOrder,
        isActive: isActive,
      );
      await loadConfiguration(silent: true);
      state = state.copyWith(isMutating: false);
    } on ApiException catch (e) {
      state = state.copyWith(isMutating: false, errorMessage: e.message);
      rethrow;
    } catch (e) {
      state = state.copyWith(
        isMutating: false,
        errorMessage: 'Failed to update vehicle type.',
      );
      rethrow;
    }
  }

  Future<void> toggleVehicleTypeActive(String id) async {
    state = state.copyWith(isMutating: true, clearError: true);
    try {
      await _repository.toggleVehicleTypeActive(id);
      await loadConfiguration(silent: true);
      state = state.copyWith(isMutating: false);
    } on ApiException catch (e) {
      state = state.copyWith(isMutating: false, errorMessage: e.message);
      rethrow;
    } catch (e) {
      state = state.copyWith(
        isMutating: false,
        errorMessage: 'Failed to toggle vehicle type status.',
      );
      rethrow;
    }
  }

  Future<void> createWorkType({
    required String name,
    String? description,
    int displayOrder = 0,
  }) async {
    state = state.copyWith(isMutating: true, clearError: true);
    try {
      await _repository.createShowroomWorkType(
        name: name,
        description: description,
        displayOrder: displayOrder,
      );
      await loadConfiguration(silent: true);
      state = state.copyWith(isMutating: false);
    } on ApiException catch (e) {
      state = state.copyWith(isMutating: false, errorMessage: e.message);
      rethrow;
    } catch (e) {
      state = state.copyWith(
        isMutating: false,
        errorMessage: 'Failed to create showroom work type.',
      );
      rethrow;
    }
  }

  Future<void> updateWorkType(
    String id, {
    required String name,
    String? description,
    int displayOrder = 0,
    bool isActive = true,
  }) async {
    state = state.copyWith(isMutating: true, clearError: true);
    try {
      await _repository.updateShowroomWorkType(
        id,
        name: name,
        description: description,
        displayOrder: displayOrder,
        isActive: isActive,
      );
      await loadConfiguration(silent: true);
      state = state.copyWith(isMutating: false);
    } on ApiException catch (e) {
      state = state.copyWith(isMutating: false, errorMessage: e.message);
      rethrow;
    } catch (e) {
      state = state.copyWith(
        isMutating: false,
        errorMessage: 'Failed to update showroom work type.',
      );
      rethrow;
    }
  }

  Future<void> toggleWorkTypeActive(String id) async {
    state = state.copyWith(isMutating: true, clearError: true);
    try {
      await _repository.toggleWorkTypeActive(id);
      await loadConfiguration(silent: true);
      state = state.copyWith(isMutating: false);
    } on ApiException catch (e) {
      state = state.copyWith(isMutating: false, errorMessage: e.message);
      rethrow;
    } catch (e) {
      state = state.copyWith(
        isMutating: false,
        errorMessage: 'Failed to toggle work type status.',
      );
      rethrow;
    }
  }
}

final showroomConfigurationProvider = StateNotifierProvider<
    ShowroomConfigurationNotifier, ShowroomConfigurationState>((ref) {
  final repository = ref.watch(showroomRepositoryProvider);
  return ShowroomConfigurationNotifier(repository);
});
