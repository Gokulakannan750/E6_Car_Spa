import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../models/showroom_operations_model.dart';
import '../../providers/daily_staff_provider.dart';
import '../../providers/showroom_operations_provider.dart';

class EditVehicleWorkModalSheet extends ConsumerStatefulWidget {
  final ShowroomVehicleWork work;
  final String showroomId;
  final String showroomName;

  const EditVehicleWorkModalSheet({
    super.key,
    required this.work,
    required this.showroomId,
    required this.showroomName,
  });

  @override
  ConsumerState<EditVehicleWorkModalSheet> createState() =>
      _EditVehicleWorkModalSheetState();
}

class _EditVehicleWorkModalSheetState
    extends ConsumerState<EditVehicleWorkModalSheet> {
  late String _selectedStaffId;
  late String _selectedVehicleTypeId;
  late final Set<String> _selectedWorkTypeIds;
  late final TextEditingController _notesController;
  late final Map<String, TextEditingController> _workTypeNoteControllers;

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _selectedStaffId = widget.work.staffId;
    _selectedVehicleTypeId = widget.work.vehicleTypeId;
    _selectedWorkTypeIds = widget.work.serviceItems
        .map((e) => e.workTypeId)
        .toSet();
    _notesController = TextEditingController(text: widget.work.notes ?? '');
    _workTypeNoteControllers = {};
    for (final item in widget.work.serviceItems) {
      _workTypeNoteControllers[item.workTypeId] =
          TextEditingController(text: item.notes ?? '');
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final dailyNotifier = ref.read(
        dailyStaffProvider(widget.showroomId).notifier,
      );
      final currentDailyState = ref.read(dailyStaffProvider(widget.showroomId));

      final isSameDate =
          currentDailyState.selectedDate.year == widget.work.date.year &&
          currentDailyState.selectedDate.month == widget.work.date.month &&
          currentDailyState.selectedDate.day == widget.work.date.day;

      if (!isSameDate || currentDailyState.dailyStaffResponse == null) {
        dailyNotifier.loadDailyStaff(date: widget.work.date);
      }
    });
  }

  @override
  void dispose() {
    _notesController.dispose();
    for (final c in _workTypeNoteControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  List<ShowroomWorkType> _getDisplayedWorkTypes(
    List<ShowroomWorkType> activeWorkTypes,
  ) {
    final list = List<ShowroomWorkType>.from(activeWorkTypes);
    for (final item in widget.work.serviceItems) {
      if (!list.any((wt) => wt.id == item.workTypeId)) {
        list.add(
          ShowroomWorkType(
            id: item.workTypeId,
            name: '${item.workTypeName} (Inactive)',
            code: item.workTypeCode,
            isActive: false,
            createdAt: DateTime.now(),
          ),
        );
      }
    }
    return list;
  }

  Future<void> _handleSubmit() async {
    setState(() {
      _errorMessage = null;
    });

    if (_selectedStaffId.isEmpty) {
      setState(() {
        _errorMessage = 'Please select assigned staff.';
      });
      return;
    }

    if (_selectedVehicleTypeId.isEmpty) {
      setState(() {
        _errorMessage = 'Please select a vehicle type.';
      });
      return;
    }

    if (_selectedWorkTypeIds.isEmpty) {
      setState(() {
        _errorMessage = 'Please select at least one work type.';
      });
      return;
    }

    // Validate "Other" work type description
    final opsState = ref.read(showroomOperationsProvider(widget.showroomId));
    final displayedWorkTypes = _getDisplayedWorkTypes(opsState.workTypes);
    for (final id in _selectedWorkTypeIds) {
      final wt = displayedWorkTypes.firstWhere(
        (w) => w.id == id,
        orElse: () => ShowroomWorkType(
          id: id,
          code: '',
          name: '',
          createdAt: DateTime.now(),
        ),
      );
      final isOther =
          wt.name.trim().toLowerCase().contains('other') ||
          wt.code.trim().toUpperCase() == 'OTHER';
      if (isOther) {
        final note = _workTypeNoteControllers[id]?.text.trim() ?? '';
        if (note.isEmpty) {
          setState(() {
            _errorMessage = 'Please specify work performed for "Other".';
          });
          return;
        }
      }
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final request = UpdateShowroomVehicleWorkRequest(
        staffId: _selectedStaffId,
        vehicleTypeId: _selectedVehicleTypeId,
        serviceItems: _selectedWorkTypeIds.map((id) {
          final note = _workTypeNoteControllers[id]?.text.trim();
          return CreateShowroomVehicleWorkItemRequest(
            workTypeId: id,
            notes: (note != null && note.isNotEmpty) ? note : null,
          );
        }).toList(),
        notes: _notesController.text.trim().isEmpty
            ? null
            : _notesController.text.trim(),
      );

      await ref
          .read(showroomOperationsProvider(widget.showroomId).notifier)
          .updateVehicleWork(workId: widget.work.id, request: request);

      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _errorMessage = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final dailyState = ref.watch(dailyStaffProvider(widget.showroomId));
    final opsState = ref.watch(showroomOperationsProvider(widget.showroomId));

    // Combine daily roster staff with currently assigned staff so current staff is always selectable
    final staffItems = <DropdownMenuItem<String>>[];
    final seenIds = <String>{};

    for (final assignment in dailyState.staffAssignments) {
      if (assignment.status == 'Leave' || assignment.status == 'Absent') {
        continue;
      }
      seenIds.add(assignment.staffId);
      final buffer = StringBuffer(assignment.staffName);
      if (assignment.staffMasterId.isNotEmpty) {
        buffer.write(' (#${assignment.staffMasterId})');
      }
      if (assignment.staffRole != null && assignment.staffRole!.isNotEmpty) {
        buffer.write(' • ${assignment.staffRole}');
      }
      if (assignment.isTemporaryTransfer &&
          assignment.homeShowroomName != null &&
          assignment.homeShowroomName!.isNotEmpty) {
        buffer.write(' [Transfer: ${assignment.homeShowroomName}]');
      }

      staffItems.add(
        DropdownMenuItem<String>(
          value: assignment.staffId,
          child: Text(
            buffer.toString(),
            style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      );
    }

    if (!seenIds.contains(widget.work.staffId)) {
      staffItems.insert(
        0,
        DropdownMenuItem<String>(
          value: widget.work.staffId,
          child: Text(
            '${widget.work.staffName} (Original)',
            style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      );
    }

    final vehicleTypes = opsState.vehicleTypes;
    final vehicleTypeItems = vehicleTypes.map((vType) {
      return DropdownMenuItem<String>(
        value: vType.id,
        child: Text(
          vType.name,
          style: const TextStyle(
            fontSize: 13,
            color: AppColors.textPrimary,
          ),
          overflow: TextOverflow.ellipsis,
        ),
      );
    }).toList();

    if (_selectedVehicleTypeId.isNotEmpty &&
        !vehicleTypes.any((vt) => vt.id == _selectedVehicleTypeId)) {
      vehicleTypeItems.insert(
        0,
        DropdownMenuItem<String>(
          value: _selectedVehicleTypeId,
          child: Text(
            '${widget.work.vehicleTypeName.isNotEmpty ? widget.work.vehicleTypeName : 'Selected Type'} (Inactive)',
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              fontStyle: FontStyle.italic,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      );
    }

    final displayedWorkTypes = _getDisplayedWorkTypes(opsState.workTypes);

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AppModalHeader(
            title: 'Edit Vehicle Work',
            subtitle: widget.showroomName,
            onClose: () => Navigator.of(context).pop(),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Error Banner
                  if (_errorMessage != null) ...[
                    Container(
                      key: const Key('modal_error_banner'),
                      padding: const EdgeInsets.all(10),
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: AppColors.error.withAlpha(20),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: AppColors.error.withAlpha(80),
                        ),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.error_outline_rounded,
                            color: AppColors.error,
                            size: 18,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: const TextStyle(
                                color: AppColors.error,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // 1. Assigned Staff
                  Text(
                    'Assigned Staff *',
                    style: AppTextStyles.bodySmall.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        key: const Key('edit_staff_dropdown'),
                        isExpanded: true,
                        value: _selectedStaffId,
                        hint: const Text('Select staff'),
                        items: staffItems,
                        onChanged: (val) {
                          if (val != null) {
                            setState(() {
                              _selectedStaffId = val;
                              _errorMessage = null;
                            });
                          }
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // 2. Vehicle Type
                  Text(
                    'Vehicle Type *',
                    style: AppTextStyles.bodySmall.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        key: const Key('edit_vehicle_type_dropdown'),
                        isExpanded: true,
                        value: _selectedVehicleTypeId,
                        hint: const Text('Select vehicle type'),
                        items: vehicleTypeItems,
                        onChanged: (val) {
                          if (val != null) {
                            setState(() {
                              _selectedVehicleTypeId = val;
                              _errorMessage = null;
                            });
                          }
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // 3. Work / Service Types
                  Text(
                    'Work Types *',
                    style: AppTextStyles.bodySmall.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  if (displayedWorkTypes.isEmpty)
                    const Text(
                      'No work types available.',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    )
                  else
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: displayedWorkTypes.map((wType) {
                        final isSelected = _selectedWorkTypeIds.contains(
                          wType.id,
                        );
                        return FilterChip(
                          key: Key('edit_work_type_chip_${wType.id}'),
                          label: Text(wType.name),
                          selected: isSelected,
                          onSelected: (selected) {
                            setState(() {
                              if (selected) {
                                _selectedWorkTypeIds.add(wType.id);
                                _workTypeNoteControllers.putIfAbsent(
                                  wType.id,
                                  () => TextEditingController(),
                                );
                              } else {
                                _selectedWorkTypeIds.remove(wType.id);
                              }
                              _errorMessage = null;
                            });
                          },
                          selectedColor: AppColors.primary.withAlpha(30),
                          backgroundColor: AppColors.surfaceAlt,
                          checkmarkColor: AppColors.primary,
                          labelStyle: TextStyle(
                            fontSize: 11.5,
                            fontWeight: isSelected
                                ? FontWeight.w700
                                : FontWeight.w500,
                            color: isSelected
                                ? AppColors.primary
                                : AppColors.textPrimary,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(6),
                            side: BorderSide(
                              color: isSelected
                                  ? AppColors.primary
                                  : AppColors.border,
                            ),
                          ),
                        );
                      }).toList(),
                    ),

                  // "Other" work type description fields
                  for (final wType in displayedWorkTypes)
                    if (_selectedWorkTypeIds.contains(wType.id) &&
                        (wType.name.trim().toLowerCase().contains('other') ||
                            wType.code.trim().toUpperCase() == 'OTHER')) ...[
                      const SizedBox(height: 8),
                      AppTextField(
                        key: Key('edit_other_work_type_${wType.id}'),
                        label: 'Specify work performed: *',
                        hint: 'e.g. Engine bay cleaning, ceramic touch-up',
                        controller: _workTypeNoteControllers.putIfAbsent(
                          wType.id,
                          () => TextEditingController(),
                        ),
                      ),
                    ],
                  const SizedBox(height: 12),

                  // 4. Notes
                  AppTextField(
                    key: const Key('edit_vehicle_notes_field'),
                    label: 'Notes (Optional)',
                    controller: _notesController,
                    hint: 'e.g. Special care requested, dent on door',
                    maxLines: 2,
                  ),
                ],
              ),
            ),
          ),

          // Bottom Action Bar
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: AppButton(
                    key: const Key('modal_edit_cancel_button'),
                    label: 'Cancel',
                    variant: AppButtonVariant.secondary,
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: AppButton(
                    key: const Key('modal_update_vehicle_work_button'),
                    label: 'Update Work',
                    icon: Icons.check_rounded,
                    isLoading: _isSubmitting,
                    onPressed: _handleSubmit,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
