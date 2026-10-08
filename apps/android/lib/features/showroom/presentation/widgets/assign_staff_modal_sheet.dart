import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_search_field.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../staff/models/staff_model.dart';
import '../../../staff/providers/staff_provider.dart';
import '../../models/showroom_staff_assignment_model.dart';

class AssignStaffModalSheet extends ConsumerStatefulWidget {
  final String? showroomId;
  final String showroomName;
  final DateTime selectedDate;
  final Set<String> alreadyAssignedStaffIds;
  final Future<void> Function({
    required String staffId,
    required String startTime,
    required String endTime,
    required String assignmentType,
    String? transferReason,
    String? notes,
  })
  onAssign;

  const AssignStaffModalSheet({
    super.key,
    this.showroomId,
    required this.showroomName,
    required this.selectedDate,
    required this.alreadyAssignedStaffIds,
    required this.onAssign,
  });

  @override
  ConsumerState<AssignStaffModalSheet> createState() =>
      _AssignStaffModalSheetState();
}

class _AssignStaffModalSheetState extends ConsumerState<AssignStaffModalSheet> {
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _transferReasonController =
      TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  String? _selectedStaffId;
  ShowroomSessionType _sessionType = ShowroomSessionType.fullDay;
  String _startTime = '09:00';
  String _endTime = '18:00';
  String _assignmentType = 'Regular';

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(staffProvider.notifier).loadStaff();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _transferReasonController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _onStaffSelected(Staff staff) {
    setState(() {
      _selectedStaffId = staff.id;
      _errorMessage = null;

      // Auto-detect Regular vs Temporary Transfer
      final staffHomeId = staff.defaultShowroomId ?? '';
      final currentShowroomId = widget.showroomId ?? '';

      if (staffHomeId.isNotEmpty &&
          currentShowroomId.isNotEmpty &&
          staffHomeId != currentShowroomId) {
        _assignmentType = 'TemporaryTransfer';
      } else {
        _assignmentType = 'Regular';
      }
    });
  }

  void _applySessionPreset(ShowroomSessionType type) {
    setState(() {
      _sessionType = type;
      _errorMessage = null;
      if (type == ShowroomSessionType.fullDay) {
        _startTime = '09:00';
        _endTime = '18:00';
      } else if (type == ShowroomSessionType.morning) {
        _startTime = '09:00';
        _endTime = '14:00';
      } else if (type == ShowroomSessionType.afternoon) {
        _startTime = '14:00';
        _endTime = '18:00';
      }
    });
  }

  Future<void> _pickStartTime() async {
    final initial =
        _parseTimeOfDay(_startTime) ?? const TimeOfDay(hour: 9, minute: 0);
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );

    if (picked != null) {
      final formatted = _formatTimeOfDay(picked);
      setState(() {
        _startTime = formatted;
        _sessionType = ShowroomSessionType.custom;
        _errorMessage = null;
      });
    }
  }

  Future<void> _pickEndTime() async {
    final initial =
        _parseTimeOfDay(_endTime) ?? const TimeOfDay(hour: 18, minute: 0);
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );

    if (picked != null) {
      final formatted = _formatTimeOfDay(picked);
      setState(() {
        _endTime = formatted;
        _sessionType = ShowroomSessionType.custom;
        _errorMessage = null;
      });
    }
  }

  TimeOfDay? _parseTimeOfDay(String timeStr) {
    final parts = timeStr.split(':').map(int.tryParse).toList();
    if (parts.length == 2 && parts[0] != null && parts[1] != null) {
      return TimeOfDay(hour: parts[0]!, minute: parts[1]!);
    }
    return null;
  }

  String _formatTimeOfDay(TimeOfDay time) {
    final h = time.hour.toString().padLeft(2, '0');
    final m = time.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  Future<void> _handleSubmit() async {
    if (_selectedStaffId == null) {
      setState(() {
        _errorMessage = 'Please select a staff member to assign.';
      });
      return;
    }

    final hours = calculateSessionHours(_startTime, _endTime);
    if (hours == null || hours <= 0) {
      setState(() {
        _errorMessage = 'End time must be later than start time.';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      await widget.onAssign(
        staffId: _selectedStaffId!,
        startTime: _startTime,
        endTime: _endTime,
        assignmentType: _assignmentType,
        transferReason: _assignmentType == 'TemporaryTransfer'
            ? _transferReasonController.text.trim()
            : null,
        notes: _notesController.text.trim().isNotEmpty
            ? _notesController.text.trim()
            : null,
      );
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final staffState = ref.watch(staffProvider);
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    // Filter staff
    final searchTerm = _searchController.text.trim().toLowerCase();
    final activeStaffList = staffState.staffList.where((s) => s.isActive).where(
      (s) {
        if (searchTerm.isEmpty) return true;
        return s.name.toLowerCase().contains(searchTerm) ||
            s.phoneNumber.contains(searchTerm) ||
            (s.role != null && s.role!.toLowerCase().contains(searchTerm));
      },
    ).toList();

    final selectedStaff = _selectedStaffId != null
        ? staffState.staffList
              .where((s) => s.id == _selectedStaffId)
              .firstOrNull
        : null;

    final calculatedHours = calculateSessionHours(_startTime, _endTime);
    final hoursDisplay = calculatedHours != null
        ? formatSessionHours(calculatedHours)
        : 'Invalid Time';

    final isTransfer = _assignmentType == 'TemporaryTransfer';

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.90,
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: 20 + bottomInset,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          AppModalHeader(
            title: 'Assign Staff Work Session',
            subtitle: 'Showroom: ${widget.showroomName}',
            icon: Icons.person_add_alt_1_outlined,
            iconBgColor: AppColors.primary.withAlpha(20),
            iconColor: AppColors.primary,
            showDragHandle: true,
          ),
          const SizedBox(height: 12),

          // Error Banner (Overlap 409 / validation error)
          if (_errorMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.errorLight,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.error.withAlpha(80)),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.error_outline,
                    size: 18,
                    color: AppColors.error,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: AppTextStyles.bodySmall.copyWith(
                        color: AppColors.errorDark,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],

          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Selected Staff Member Summary Card
                  if (selectedStaff != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isTransfer
                            ? Colors.purple.withAlpha(15)
                            : AppColors.primary.withAlpha(15),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isTransfer
                              ? Colors.purple.withAlpha(80)
                              : AppColors.primary.withAlpha(80),
                        ),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 18,
                            backgroundColor: isTransfer
                                ? Colors.purple
                                : AppColors.primary,
                            child: Text(
                              selectedStaff.initials,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        selectedStaff.name,
                                        style: AppTextStyles.bodyMedium
                                            .copyWith(
                                              fontWeight: FontWeight.w700,
                                              color: AppColors.textPrimary,
                                            ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 2,
                                      ),
                                      decoration: BoxDecoration(
                                        color: isTransfer
                                            ? Colors.purple.withAlpha(25)
                                            : AppColors.primary.withAlpha(25),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        isTransfer
                                            ? 'Temporary Transfer'
                                            : 'Regular',
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                          color: isTransfer
                                              ? Colors.purple
                                              : AppColors.primary,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Wrap(
                                  spacing: 6,
                                  runSpacing: 2,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    if (selectedStaff.role != null &&
                                        selectedStaff.role!.isNotEmpty)
                                      Text(
                                        selectedStaff.role!,
                                        style: AppTextStyles.bodySmall.copyWith(
                                          color: AppColors.textSecondary,
                                          fontSize: 11,
                                        ),
                                      ),
                                    if (selectedStaff.defaultShowroomName !=
                                            null &&
                                        selectedStaff
                                            .defaultShowroomName!
                                            .isNotEmpty)
                                      Text(
                                        'Home: ${selectedStaff.defaultShowroomName}',
                                        style: AppTextStyles.bodySmall.copyWith(
                                          color: isTransfer
                                              ? Colors.purple.shade700
                                              : AppColors.textSecondary,
                                          fontSize: 11,
                                          fontWeight: isTransfer
                                              ? FontWeight.w600
                                              : FontWeight.normal,
                                        ),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, size: 18),
                            color: AppColors.textSecondary,
                            onPressed: () =>
                                setState(() => _selectedStaffId = null),
                            tooltip: 'Change staff',
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                  ] else ...[
                    // Staff Search & Selection
                    Text(
                      'Select Active Staff Member:',
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    AppSearchField(
                      controller: _searchController,
                      hint: 'Search staff by name, role, phone...',
                      onChanged: (_) => setState(() {}),
                      onClear: () {
                        _searchController.clear();
                        setState(() {});
                      },
                    ),
                    const SizedBox(height: 8),

                    Container(
                      constraints: const BoxConstraints(maxHeight: 180),
                      decoration: BoxDecoration(
                        border: Border.all(color: AppColors.border),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: staffState.isLoading
                          ? const Center(
                              child: Padding(
                                padding: EdgeInsets.all(16),
                                child: CircularProgressIndicator(),
                              ),
                            )
                          : activeStaffList.isEmpty
                          ? Center(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Text(
                                  'No active staff found.',
                                  style: AppTextStyles.bodySmall.copyWith(
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ),
                            )
                          : ListView.separated(
                              shrinkWrap: true,
                              itemCount: activeStaffList.length,
                              separatorBuilder: (context, index) =>
                                  const Divider(height: 1),
                              itemBuilder: (context, index) {
                                final staff = activeStaffList[index];
                                final isAlreadyAssigned = widget
                                    .alreadyAssignedStaffIds
                                    .contains(staff.id);

                                return ListTile(
                                  dense: true,
                                  title: Text(
                                    staff.name,
                                    style: AppTextStyles.bodyMedium.copyWith(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  subtitle: Text(
                                    '${staff.role ?? 'Staff'} • Home: ${staff.defaultShowroomName ?? 'General'}',
                                    style: AppTextStyles.bodySmall.copyWith(
                                      fontSize: 11,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                  trailing: isAlreadyAssigned
                                      ? Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 6,
                                            vertical: 2,
                                          ),
                                          decoration: BoxDecoration(
                                            color: AppColors.surfaceAlt,
                                            borderRadius: BorderRadius.circular(
                                              4,
                                            ),
                                          ),
                                          child: const Text(
                                            'Assigned',
                                            style: TextStyle(
                                              fontSize: 10,
                                              color: AppColors.textTertiary,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        )
                                      : const Icon(
                                          Icons.arrow_forward_ios,
                                          size: 12,
                                        ),
                                  onTap: () => _onStaffSelected(staff),
                                );
                              },
                            ),
                    ),
                    const SizedBox(height: 14),
                  ],

                  // Session Type Presets
                  Text(
                    'Session Type:',
                    style: AppTextStyles.bodySmall.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      _buildSessionTypeChip(
                        ShowroomSessionType.fullDay,
                        'Full Day (09:00 – 18:00)',
                      ),
                      _buildSessionTypeChip(
                        ShowroomSessionType.morning,
                        'Morning (09:00 – 14:00)',
                      ),
                      _buildSessionTypeChip(
                        ShowroomSessionType.afternoon,
                        'Afternoon (14:00 – 18:00)',
                      ),
                      _buildSessionTypeChip(
                        ShowroomSessionType.custom,
                        'Custom',
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Start Time & End Time Pickers
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Start Time',
                              style: AppTextStyles.bodySmall.copyWith(
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 4),
                            InkWell(
                              onTap: _pickStartTime,
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 10,
                                ),
                                decoration: BoxDecoration(
                                  border: Border.all(color: AppColors.border),
                                  borderRadius: BorderRadius.circular(8),
                                  color: Colors.white,
                                ),
                                child: Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      _startTime,
                                      style: AppTextStyles.bodyMedium.copyWith(
                                        fontWeight: FontWeight.w700,
                                        fontFamily: 'monospace',
                                      ),
                                    ),
                                    Icon(
                                      Icons.access_time,
                                      size: 16,
                                      color: AppColors.primary,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'End Time',
                              style: AppTextStyles.bodySmall.copyWith(
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 4),
                            InkWell(
                              onTap: _pickEndTime,
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 10,
                                ),
                                decoration: BoxDecoration(
                                  border: Border.all(color: AppColors.border),
                                  borderRadius: BorderRadius.circular(8),
                                  color: Colors.white,
                                ),
                                child: Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      _endTime,
                                      style: AppTextStyles.bodyMedium.copyWith(
                                        fontWeight: FontWeight.w700,
                                        fontFamily: 'monospace',
                                      ),
                                    ),
                                    Icon(
                                      Icons.access_time,
                                      size: 16,
                                      color: AppColors.primary,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Working Hours Badge (Auto-Calculated)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: calculatedHours != null
                          ? AppColors.primary.withAlpha(15)
                          : AppColors.errorLight,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: calculatedHours != null
                            ? AppColors.primary.withAlpha(40)
                            : AppColors.error.withAlpha(50),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Calculated Working Hours:',
                          style: AppTextStyles.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        Text(
                          hoursDisplay,
                          style: AppTextStyles.bodyMedium.copyWith(
                            fontWeight: FontWeight.w800,
                            color: calculatedHours != null
                                ? AppColors.primary
                                : AppColors.error,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Temporary Transfer Reason (if Transfer)
                  if (isTransfer) ...[
                    AppTextField(
                      controller: _transferReasonController,
                      label: 'Transfer Reason',
                      hintText: 'e.g. Covering shift / Cross-showroom support',
                      prefixIcon: const Icon(
                        Icons.swap_horiz_rounded,
                        size: 20,
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],

                  // Notes (Optional)
                  AppTextField(
                    controller: _notesController,
                    label: 'Notes (Optional)',
                    hintText: 'Optional notes for this session...',
                    prefixIcon: const Icon(Icons.notes_rounded, size: 20),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Action Buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  key: const Key('modal_cancel_button'),
                  onPressed: _isSubmitting
                      ? null
                      : () {
                          FocusScope.of(context).unfocus();
                          Navigator.of(context).pop();
                        },
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: const BorderSide(color: AppColors.border),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: AppButton(
                  key: const Key('modal_assign_button'),
                  label: 'Assign Work Session',
                  icon: Icons.check_rounded,
                  isLoading: _isSubmitting,
                  onPressed: _selectedStaffId == null ? null : _handleSubmit,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSessionTypeChip(ShowroomSessionType type, String label) {
    final isSelected = _sessionType == type;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => _applySessionPreset(type),
      selectedColor: AppColors.primary,
      backgroundColor: AppColors.surfaceAlt,
      labelStyle: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w600,
        color: isSelected ? Colors.white : AppColors.textPrimary,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(
          color: isSelected ? AppColors.primary : AppColors.border,
        ),
      ),
      showCheckmark: false,
    );
  }
}
