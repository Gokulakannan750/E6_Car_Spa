import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../models/showroom_staff_assignment_model.dart';

class EditStaffSessionModalSheet extends StatefulWidget {
  final DailyStaffAssignment assignment;
  final String showroomName;
  final Future<void> Function({
    required String startTime,
    required String endTime,
    String? status,
    String? transferReason,
    String? notes,
  })
  onUpdate;

  const EditStaffSessionModalSheet({
    super.key,
    required this.assignment,
    required this.showroomName,
    required this.onUpdate,
  });

  @override
  State<EditStaffSessionModalSheet> createState() =>
      _EditStaffSessionModalSheetState();
}

class _EditStaffSessionModalSheetState
    extends State<EditStaffSessionModalSheet> {
  late ShowroomSessionType _sessionType;
  late String _startTime;
  late String _endTime;
  late String _status;
  late TextEditingController _transferReasonController;
  late TextEditingController _notesController;

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _startTime = widget.assignment.startTime;
    _endTime = widget.assignment.endTime;
    _status = widget.assignment.status;
    _transferReasonController = TextEditingController(
      text: widget.assignment.transferReason ?? '',
    );
    _notesController = TextEditingController(
      text: widget.assignment.notes ?? '',
    );

    // Match preset if applicable
    if (_startTime == '09:00' && _endTime == '18:00') {
      _sessionType = ShowroomSessionType.fullDay;
    } else if (_startTime == '09:00' && _endTime == '14:00') {
      _sessionType = ShowroomSessionType.morning;
    } else if (_startTime == '14:00' && _endTime == '18:00') {
      _sessionType = ShowroomSessionType.afternoon;
    } else {
      _sessionType = ShowroomSessionType.custom;
    }
  }

  @override
  void dispose() {
    _transferReasonController.dispose();
    _notesController.dispose();
    super.dispose();
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
      await widget.onUpdate(
        startTime: _startTime,
        endTime: _endTime,
        status: _status,
        transferReason: widget.assignment.isTemporaryTransfer
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
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final calculatedHours = calculateSessionHours(_startTime, _endTime);
    final hoursDisplay = calculatedHours != null
        ? formatSessionHours(calculatedHours)
        : 'Invalid Time';

    final isTransfer = widget.assignment.isTemporaryTransfer;

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
          AppModalHeader(
            title: 'Edit Work Session',
            subtitle: 'Staff: ${widget.assignment.staffName}',
            icon: Icons.edit_calendar_outlined,
            iconBgColor: AppColors.primary.withAlpha(20),
            iconColor: AppColors.primary,
            showDragHandle: true,
          ),
          const SizedBox(height: 12),

          // Error Banner (e.g. Overlap 409 conflict)
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
                  // Staff Info Card
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isTransfer
                          ? Colors.purple.withAlpha(15)
                          : AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isTransfer
                            ? Colors.purple.withAlpha(80)
                            : AppColors.border,
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
                            widget.assignment.initials,
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
                                      widget.assignment.staffName,
                                      style: AppTextStyles.bodyMedium.copyWith(
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.textPrimary,
                                      ),
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
                                  if (widget.assignment.staffRole != null &&
                                      widget.assignment.staffRole!.isNotEmpty)
                                    Text(
                                      widget.assignment.staffRole!,
                                      style: AppTextStyles.bodySmall.copyWith(
                                        color: AppColors.textSecondary,
                                        fontSize: 11,
                                      ),
                                    ),
                                  Text(
                                    'Home: ${widget.assignment.displayHomeShowroom}',
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
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Attendance Status Selector
                  Text(
                    'Attendance Status:',
                    style: AppTextStyles.bodySmall.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(8),
                      color: Colors.white,
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _status,
                        isExpanded: true,
                        items: [
                          const DropdownMenuItem(
                            value: 'Present',
                            child: Text('Present'),
                          ),
                          const DropdownMenuItem(
                            value: 'HalfDay',
                            child: Text('Half Day'),
                          ),
                          const DropdownMenuItem(
                            value: 'Leave',
                            child: Text('Leave'),
                          ),
                          const DropdownMenuItem(
                            value: 'Absent',
                            child: Text('Absent'),
                          ),
                          if (isTransfer)
                            const DropdownMenuItem(
                              value: 'TemporaryTransfer',
                              child: Text('Temporary Transfer'),
                            ),
                        ],
                        onChanged: (val) {
                          if (val != null) {
                            setState(() => _status = val);
                          }
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Session Type Presets
                  Text(
                    'Session Presets:',
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
                                    const Icon(
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
                                    const Icon(
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

                  // Calculated Working Hours Badge
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

                  // Transfer Reason (if Temporary Transfer)
                  if (isTransfer) ...[
                    AppTextField(
                      controller: _transferReasonController,
                      label: 'Transfer Reason',
                      hintText: 'e.g. Covering shift',
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
                    hintText: 'Optional session notes...',
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
                  key: const Key('edit_modal_cancel_button'),
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
                  key: const Key('edit_modal_save_button'),
                  label: 'Save Changes',
                  icon: Icons.check_rounded,
                  isLoading: _isSubmitting,
                  onPressed: _handleSubmit,
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
