import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../models/showroom_operations_model.dart';
import '../../providers/daily_staff_provider.dart';
import '../../providers/showroom_operations_provider.dart';

class VehicleConfigItem {
  String? staffId;
  String? vehicleTypeId;
  final Set<String> selectedWorkTypeIds;
  final TextEditingController notesController;
  bool isExpanded;

  VehicleConfigItem({
    this.staffId,
    this.vehicleTypeId,
    Set<String>? selectedWorkTypeIds,
    String? initialNotes,
    this.isExpanded = true,
  })  : selectedWorkTypeIds = selectedWorkTypeIds ?? <String>{},
        notesController = TextEditingController(text: initialNotes ?? '');

  void dispose() {
    notesController.dispose();
  }
}

class LogVehicleWorkModalSheet extends ConsumerStatefulWidget {
  final String showroomId;
  final String showroomName;
  final DateTime selectedDate;

  const LogVehicleWorkModalSheet({
    super.key,
    required this.showroomId,
    required this.showroomName,
    required this.selectedDate,
  });

  @override
  ConsumerState<LogVehicleWorkModalSheet> createState() =>
      _LogVehicleWorkModalSheetState();
}

class _LogVehicleWorkModalSheetState
    extends ConsumerState<LogVehicleWorkModalSheet> {
  final TextEditingController _quantityController =
      TextEditingController(text: '1');
  final ScrollController _scrollController = ScrollController();

  int _quantity = 1;
  final List<VehicleConfigItem> _configs = [];
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _configs.add(VehicleConfigItem(isExpanded: true));

    // Initialize with default staff if available
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final dailyState = ref.read(dailyStaffProvider(widget.showroomId));
      if (dailyState.staffAssignments.isNotEmpty && _configs.isNotEmpty) {
        if (_configs[0].staffId == null) {
          setState(() {
            _configs[0].staffId = dailyState.staffAssignments.first.staffId;
          });
        }
      }
      final opsState =
          ref.read(showroomOperationsProvider(widget.showroomId));
      if (opsState.vehicleTypes.isNotEmpty && _configs.isNotEmpty) {
        if (_configs[0].vehicleTypeId == null) {
          setState(() {
            _configs[0].vehicleTypeId = opsState.vehicleTypes.first.id;
          });
        }
      }
    });
  }

  @override
  void dispose() {
    _quantityController.dispose();
    _scrollController.dispose();
    for (final c in _configs) {
      c.dispose();
    }
    super.dispose();
  }

  void _onQuantityChanged(String value) {
    final parsed = int.tryParse(value);
    if (parsed == null || parsed < 1) {
      return;
    }
    final clamped = parsed > 9999 ? 9999 : parsed;
    _updateQuantity(clamped);
  }

  void _updateQuantity(int newQuantity) {
    if (newQuantity == _quantity) return;
    setState(() {
      _quantity = newQuantity;
      if (_configs.length < _quantity) {
        // Expand
        final lastStaffId =
            _configs.isNotEmpty ? _configs.last.staffId : null;
        final lastVehicleTypeId =
            _configs.isNotEmpty ? _configs.last.vehicleTypeId : null;
        final lastWorkTypes = _configs.isNotEmpty
            ? Set<String>.from(_configs.last.selectedWorkTypeIds)
            : <String>{};

        while (_configs.length < _quantity) {
          _configs.add(
            VehicleConfigItem(
              staffId: lastStaffId,
              vehicleTypeId: lastVehicleTypeId,
              selectedWorkTypeIds: Set<String>.from(lastWorkTypes),
              isExpanded: _configs.length < 5, // collapse beyond 5 for readability
            ),
          );
        }
      } else if (_configs.length > _quantity) {
        // Shrink safely
        while (_configs.length > _quantity) {
          final removed = _configs.removeLast();
          removed.dispose();
        }
      }
      _errorMessage = null;
    });
  }

  void _incrementQuantity() {
    if (_quantity < 9999) {
      final next = _quantity + 1;
      _quantityController.text = next.toString();
      _updateQuantity(next);
    }
  }

  void _decrementQuantity() {
    if (_quantity > 1) {
      final next = _quantity - 1;
      _quantityController.text = next.toString();
      _updateQuantity(next);
    }
  }

  Future<void> _handleSubmit() async {
    setState(() {
      _errorMessage = null;
    });

    if (_quantity < 1 || _quantity > 9999) {
      setState(() {
        _errorMessage = 'Vehicle quantity must be between 1 and 9999.';
      });
      return;
    }

    final dailyState = ref.read(dailyStaffProvider(widget.showroomId));
    final eligibleStaffIds =
        dailyState.staffAssignments.map((a) => a.staffId).toSet();

    // Validate each vehicle config
    for (int i = 0; i < _configs.length; i++) {
      final config = _configs[i];
      final itemIndex = i + 1;

      if (config.staffId == null || config.staffId!.isEmpty) {
        setState(() {
          config.isExpanded = true;
          _errorMessage = 'Please select assigned staff for Vehicle #$itemIndex.';
        });
        return;
      }

      if (!eligibleStaffIds.contains(config.staffId)) {
        setState(() {
          config.isExpanded = true;
          _errorMessage =
              'Assigned staff for Vehicle #$itemIndex is not on duty for this date.';
        });
        return;
      }

      if (config.vehicleTypeId == null || config.vehicleTypeId!.isEmpty) {
        setState(() {
          config.isExpanded = true;
          _errorMessage = 'Please select a vehicle type for Vehicle #$itemIndex.';
        });
        return;
      }

      if (config.selectedWorkTypeIds.isEmpty) {
        setState(() {
          config.isExpanded = true;
          _errorMessage =
              'Please select at least one service/work type for Vehicle #$itemIndex.';
        });
        return;
      }
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final notifier =
          ref.read(showroomOperationsProvider(widget.showroomId).notifier);

      final staffGroups = <String, List<VehicleConfigItem>>{};
      for (final c in _configs) {
        staffGroups.putIfAbsent(c.staffId!, () => []).add(c);
      }

      for (final entry in staffGroups.entries) {
        final staffId = entry.key;
        final groupConfigs = entry.value;

        if (groupConfigs.length == 1) {
          final single = groupConfigs.first;
          final request = CreateShowroomVehicleWorkRequest(
            staffId: staffId,
            vehicleTypeId: single.vehicleTypeId!,
            date: widget.selectedDate,
            serviceItems: single.selectedWorkTypeIds
                .map((id) => CreateShowroomVehicleWorkItemRequest(workTypeId: id))
                .toList(),
            notes: single.notesController.text.trim().isEmpty
                ? null
                : single.notesController.text.trim(),
          );
          await notifier.createVehicleWork(request);
        } else {
          final entries = groupConfigs.map((c) {
            return IndividualVehicleWorkEntry(
              vehicleTypeId: c.vehicleTypeId!,
              workTypeIds: c.selectedWorkTypeIds.toList(),
              notes: c.notesController.text.trim().isEmpty
                  ? null
                  : c.notesController.text.trim(),
            );
          }).toList();

          final batchRequest = CreateBatchShowroomVehicleWorkRequest(
            staffId: staffId,
            date: widget.selectedDate,
            vehicles: entries,
          );
          await notifier.createBatchVehicleWork(batchRequest);
        }
      }

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
    final opsState =
        ref.watch(showroomOperationsProvider(widget.showroomId));

    final staffList = dailyState.staffAssignments;
    final vehicleTypes = opsState.vehicleTypes;
    final workTypes = opsState.workTypes;

    final hasNoStaff = staffList.isEmpty;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.90,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AppModalHeader(
            title: 'Log Vehicle Work',
            subtitle: widget.showroomName,
            onClose: () => Navigator.of(context).pop(),
          ),
          Flexible(
            child: SingleChildScrollView(
              controller: _scrollController,
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
                        border: Border.all(color: AppColors.error.withAlpha(80)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline_rounded,
                              color: AppColors.error, size: 18),
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

                  // No Staff Warning
                  if (hasNoStaff) ...[
                    Container(
                      padding: const EdgeInsets.all(10),
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: Colors.amber.withAlpha(25),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.amber.withAlpha(90)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.warning_amber_rounded,
                              color: Colors.amber, size: 18),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'No staff on duty for this date. Please assign staff in the Attendance tab first.',
                              style: TextStyle(
                                color: Color(0xFF856404),
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Vehicle Quantity Stepper / Field
                  Text(
                    'Vehicle Quantity',
                    style: AppTextStyles.bodyMedium.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: AppColors.border),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              key: const Key('qty_decrement_btn'),
                              onPressed: _quantity > 1 ? _decrementQuantity : null,
                              icon: const Icon(Icons.remove, size: 18),
                              visualDensity: VisualDensity.compact,
                              color: AppColors.primary,
                            ),
                            SizedBox(
                              width: 60,
                              child: TextField(
                                key: const Key('qty_input_field'),
                                controller: _quantityController,
                                keyboardType: TextInputType.number,
                                textAlign: TextAlign.center,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                  LengthLimitingTextInputFormatter(4),
                                ],
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                ),
                                decoration: const InputDecoration(
                                  border: InputBorder.none,
                                  isDense: true,
                                  contentPadding: EdgeInsets.symmetric(vertical: 8),
                                ),
                                onChanged: _onQuantityChanged,
                              ),
                            ),
                            IconButton(
                              key: const Key('qty_increment_btn'),
                              onPressed: _quantity < 9999 ? _incrementQuantity : null,
                              icon: const Icon(Icons.add, size: 18),
                              visualDensity: VisualDensity.compact,
                              color: AppColors.primary,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _quantity == 1
                              ? 'Single Vehicle'
                              : '$_quantity Vehicles (Batch)',
                          style: AppTextStyles.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Vehicle Configurations List
                  ..._configs.asMap().entries.map((entry) {
                    final index = entry.key;
                    final config = entry.value;
                    return _buildVehicleConfigCard(
                      index: index,
                      config: config,
                      staffList: staffList,
                      vehicleTypes: vehicleTypes,
                      workTypes: workTypes,
                    );
                  }),
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
                    key: const Key('modal_cancel_button'),
                    label: 'Cancel',
                    variant: AppButtonVariant.secondary,
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: AppButton(
                    key: const Key('modal_save_vehicle_work_button'),
                    label: _quantity > 1
                        ? 'Save $_quantity Vehicles'
                        : 'Save Vehicle Work',
                    icon: Icons.check_rounded,
                    isLoading: _isSubmitting,
                    onPressed: hasNoStaff ? null : _handleSubmit,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVehicleConfigCard({
    required int index,
    required VehicleConfigItem config,
    required List<dynamic> staffList,
    required List<ShowroomVehicleType> vehicleTypes,
    required List<ShowroomWorkType> workTypes,
  }) {
    final title = 'Vehicle #${index + 1}';
    final isExpanded = config.isExpanded;

    return Container(
      key: Key('vehicle_config_card_$index'),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Collapsible Header
          InkWell(
            onTap: () {
              setState(() {
                config.isExpanded = !config.isExpanded;
              });
            },
            borderRadius: BorderRadius.circular(10),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  const Icon(
                    Icons.directions_car_filled_outlined,
                    size: 16,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      title,
                      style: AppTextStyles.bodyMedium.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  Icon(
                    isExpanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: AppColors.textSecondary,
                  ),
                ],
              ),
            ),
          ),

          if (isExpanded) ...[
            const Divider(height: 1, color: AppColors.border),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. Assigned Staff (eligible present staff only)
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
                        key: Key('staff_dropdown_$index'),
                        isExpanded: true,
                        value: config.staffId,
                        hint: const Text('Select on-duty staff'),
                        items: staffList.map((assignment) {
                          return DropdownMenuItem<String>(
                            value: assignment.staffId as String,
                            child: Text(
                              assignment.staffName as String,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.textPrimary,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          );
                        }).toList(),
                        onChanged: (val) {
                          setState(() {
                            config.staffId = val;
                            _errorMessage = null;
                          });
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
                        key: Key('vehicle_type_dropdown_$index'),
                        isExpanded: true,
                        value: config.vehicleTypeId,
                        hint: const Text('Select vehicle type'),
                        items: vehicleTypes.map((vType) {
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
                        }).toList(),
                        onChanged: (val) {
                          setState(() {
                            config.vehicleTypeId = val;
                            _errorMessage = null;
                          });
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // 3. Work / Service Types Multi-Select Chips
                  Text(
                    'Services / Work Types *',
                    style: AppTextStyles.bodySmall.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  if (workTypes.isEmpty)
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
                      children: workTypes.map((wType) {
                        final isSelected =
                            config.selectedWorkTypeIds.contains(wType.id);
                        return FilterChip(
                          key: Key('work_type_chip_${index}_${wType.id}'),
                          label: Text(wType.name),
                          selected: isSelected,
                          onSelected: (selected) {
                            setState(() {
                              if (selected) {
                                config.selectedWorkTypeIds.add(wType.id);
                              } else {
                                config.selectedWorkTypeIds.remove(wType.id);
                              }
                              _errorMessage = null;
                            });
                          },
                          selectedColor: AppColors.primary.withAlpha(30),
                          backgroundColor: Colors.white,
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
                  const SizedBox(height: 12),

                  // 4. Notes
                  AppTextField(
                    key: Key('vehicle_notes_field_$index'),
                    label: 'Notes (Optional)',
                    controller: config.notesController,
                    hint: 'e.g. Special care requested, dent on door',
                    maxLines: 2,
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
