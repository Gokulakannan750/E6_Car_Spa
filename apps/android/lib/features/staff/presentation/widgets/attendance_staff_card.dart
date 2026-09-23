import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../models/staff_attendance_models.dart';
import '../../providers/staff_attendance_providers.dart';

class AttendanceStaffCard extends ConsumerStatefulWidget {
  final DailyStaffAttendanceItem item;
  final bool isConfirmed;
  final bool canManage;

  const AttendanceStaffCard({
    super.key,
    required this.item,
    required this.isConfirmed,
    required this.canManage,
  });

  @override
  ConsumerState<AttendanceStaffCard> createState() => _AttendanceStaffCardState();
}

class _AttendanceStaffCardState extends ConsumerState<AttendanceStaffCard> {
  bool _isExpanded = false;
  late final TextEditingController _checkInController;
  late final TextEditingController _checkOutController;
  late final TextEditingController _notesController;

  @override
  void initState() {
    super.initState();
    _checkInController = TextEditingController(text: widget.item.checkInTime ?? '');
    _checkOutController = TextEditingController(text: widget.item.checkOutTime ?? '');
    _notesController = TextEditingController(text: widget.item.notes ?? '');
  }

  @override
  void didUpdateWidget(covariant AttendanceStaffCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.item != widget.item) {
      if (_checkInController.text != (widget.item.checkInTime ?? '')) {
        _checkInController.text = widget.item.checkInTime ?? '';
      }
      if (_checkOutController.text != (widget.item.checkOutTime ?? '')) {
        _checkOutController.text = widget.item.checkOutTime ?? '';
      }
      if (_notesController.text != (widget.item.notes ?? '')) {
        _notesController.text = widget.item.notes ?? '';
      }
    }
  }

  @override
  void dispose() {
    _checkInController.dispose();
    _checkOutController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _updateStatus(String newStatus) async {
    if (widget.isConfirmed || !widget.canManage) return;

    await ref.read(attendanceActionProvider.notifier).markAttendance(
      staffId: widget.item.staffId,
      attendanceDate: widget.item.attendanceDate,
      status: newStatus,
      checkInTime: _checkInController.text.trim().isEmpty ? null : _checkInController.text.trim(),
      checkOutTime: _checkOutController.text.trim().isEmpty ? null : _checkOutController.text.trim(),
      notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
    );
  }

  Future<void> _saveDetails() async {
    if (widget.isConfirmed || !widget.canManage) return;

    await ref.read(attendanceActionProvider.notifier).markAttendance(
      staffId: widget.item.staffId,
      attendanceDate: widget.item.attendanceDate,
      status: widget.item.status,
      checkInTime: _checkInController.text.trim().isEmpty ? null : _checkInController.text.trim(),
      checkOutTime: _checkOutController.text.trim().isEmpty ? null : _checkOutController.text.trim(),
      notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
    );
    setState(() {
      _isExpanded = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final isLocked = widget.isConfirmed || !widget.canManage;

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: item.status == 'Present'
              ? AppColors.success.withAlpha(100)
              : item.status == 'HalfDay'
                  ? AppColors.warningDark.withAlpha(100)
                  : item.status == 'Leave'
                      ? AppColors.error.withAlpha(100)
                      : AppColors.border,
        ),
      ),
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Staff info + Expand toggle
            Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: AppColors.accentPill,
                  child: Text(
                    item.staffName.isNotEmpty ? item.staffName.substring(0, 1).toUpperCase() : 'S',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.staffName,
                        style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.w700),
                      ),
                      Text(
                        '${item.staffRole ?? 'Staff'} • ${item.staffPhoneNumber}',
                        style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                if (!isLocked)
                  IconButton(
                    icon: Icon(
                      _isExpanded ? Icons.expand_less_rounded : Icons.more_horiz_rounded,
                      color: AppColors.textSecondary,
                      size: 20,
                    ),
                    tooltip: 'Check-in times & notes',
                    onPressed: () {
                      setState(() {
                        _isExpanded = !_isExpanded;
                      });
                    },
                  ),
              ],
            ),
            const SizedBox(height: 12),

            // Segmented Attendance Status Buttons
            Row(
              children: [
                _buildStatusOption(
                  label: 'Present',
                  statusValue: 'Present',
                  currentStatus: item.status,
                  color: AppColors.success,
                  bgColor: AppColors.successLight,
                  isLocked: isLocked,
                ),
                const SizedBox(width: 6),
                _buildStatusOption(
                  label: 'Half Day',
                  statusValue: 'HalfDay',
                  currentStatus: item.status,
                  color: AppColors.warningDark,
                  bgColor: AppColors.warningLight,
                  isLocked: isLocked,
                ),
                const SizedBox(width: 6),
                _buildStatusOption(
                  label: 'Leave',
                  statusValue: 'Leave',
                  currentStatus: item.status,
                  color: AppColors.error,
                  bgColor: AppColors.errorLight,
                  isLocked: isLocked,
                ),
                const SizedBox(width: 6),
                _buildStatusOption(
                  label: 'Unmarked',
                  statusValue: 'Unmarked',
                  currentStatus: item.status,
                  color: AppColors.textSecondary,
                  bgColor: AppColors.surface,
                  isLocked: isLocked,
                ),
              ],
            ),

            // Expandable Time & Notes Section
            if (_isExpanded) ...[
              const Divider(height: 20, color: AppColors.border),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _checkInController,
                      enabled: !isLocked,
                      decoration: const InputDecoration(
                        labelText: 'Check In (e.g. 09:30)',
                        labelStyle: TextStyle(fontSize: 12),
                        isDense: true,
                        prefixIcon: Icon(Icons.login_rounded, size: 16),
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _checkOutController,
                      enabled: !isLocked,
                      decoration: const InputDecoration(
                        labelText: 'Check Out (e.g. 18:30)',
                        labelStyle: TextStyle(fontSize: 12),
                        isDense: true,
                        prefixIcon: Icon(Icons.logout_rounded, size: 16),
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _notesController,
                enabled: !isLocked,
                decoration: const InputDecoration(
                  labelText: 'Remarks / Notes',
                  labelStyle: TextStyle(fontSize: 12),
                  isDense: true,
                  prefixIcon: Icon(Icons.note_alt_outlined, size: 16),
                  border: OutlineInputBorder(),
                ),
              ),
              if (!isLocked) ...[
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerRight,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: _saveDetails,
                    child: const Text('Save Details', style: TextStyle(fontSize: 12)),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusOption({
    required String label,
    required String statusValue,
    required String currentStatus,
    required Color color,
    required Color bgColor,
    required bool isLocked,
  }) {
    final isSelected = currentStatus == statusValue;

    return Expanded(
      child: Material(
        color: isSelected ? bgColor : Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(
            color: isSelected ? color : AppColors.border,
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: isLocked ? null : () => _updateStatus(statusValue),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Center(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                  color: isSelected ? color : AppColors.textSecondary,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
