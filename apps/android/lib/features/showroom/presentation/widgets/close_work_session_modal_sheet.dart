import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../models/showroom_staff_assignment_model.dart';
import '../../providers/showroom_operations_provider.dart';

class CloseWorkSessionModalSheet extends ConsumerStatefulWidget {
  final String showroomId;
  final String showroomName;
  final DailyStaffAssignment assignment;

  const CloseWorkSessionModalSheet({
    super.key,
    required this.showroomId,
    required this.showroomName,
    required this.assignment,
  });

  @override
  ConsumerState<CloseWorkSessionModalSheet> createState() =>
      _CloseWorkSessionModalSheetState();
}

class _CloseWorkSessionModalSheetState
    extends ConsumerState<CloseWorkSessionModalSheet> {
  late final TextEditingController _clockOutTimeController;
  late final TextEditingController _notesController;

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final currentHour = now.hour.toString().padLeft(2, '0');
    final currentMinute = now.minute.toString().padLeft(2, '0');
    _clockOutTimeController =
        TextEditingController(text: '$currentHour:$currentMinute');
    _notesController = TextEditingController();
  }

  @override
  void dispose() {
    _clockOutTimeController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _selectTime() async {
    final parts = _clockOutTimeController.text.split(':');
    final initialHour = parts.isNotEmpty ? int.tryParse(parts[0]) ?? 18 : 18;
    final initialMin = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;

    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: initialHour, minute: initialMin),
    );

    if (picked != null) {
      final hour = picked.hour.toString().padLeft(2, '0');
      final minute = picked.minute.toString().padLeft(2, '0');
      setState(() {
        _clockOutTimeController.text = '$hour:$minute';
        _errorMessage = null;
      });
    }
  }

  Future<void> _handleSubmit() async {
    setState(() {
      _errorMessage = null;
      _isSubmitting = true;
    });

    try {
      final clockOutTime = _clockOutTimeController.text.trim().isEmpty
          ? null
          : _clockOutTimeController.text.trim();
      final clockOutNotes = _notesController.text.trim().isEmpty
          ? null
          : _notesController.text.trim();

      await ref
          .read(showroomOperationsProvider(widget.showroomId).notifier)
          .closeStaffWorkSession(
            sessionId: widget.assignment.id,
            clockOutTime: clockOutTime,
            clockOutNotes: clockOutNotes,
          );

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
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AppModalHeader(
            title: 'Close Work Session',
            subtitle: widget.assignment.staffName,
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

                  // Session Info Card
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 14),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(
                              Icons.person_outline_rounded,
                              size: 16,
                              color: AppColors.primary,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              widget.assignment.staffName,
                              style: AppTextStyles.bodyMedium.copyWith(
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Icon(
                              Icons.schedule_rounded,
                              size: 14,
                              color: AppColors.textSecondary,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Shift: ${widget.assignment.startTime} - ${widget.assignment.endTime}',
                              style: AppTextStyles.bodySmall.copyWith(
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Clock-out Time Field
                  Text(
                    'Clock-out / End Time',
                    style: AppTextStyles.bodySmall.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  InkWell(
                    onTap: _selectTime,
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.access_time_rounded,
                            size: 18,
                            color: AppColors.primary,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _clockOutTimeController.text,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),
                          const Icon(
                            Icons.arrow_drop_down,
                            color: AppColors.textSecondary,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Notes Field
                  AppTextField(
                    key: const Key('close_session_notes_field'),
                    label: 'Clock-out Notes (Optional)',
                    controller: _notesController,
                    hint: 'e.g. Left early with permission, completed extra shift',
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
                    key: const Key('modal_close_cancel_button'),
                    label: 'Cancel',
                    variant: AppButtonVariant.secondary,
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: AppButton(
                    key: const Key('modal_confirm_close_session_button'),
                    label: 'Clock Out Staff',
                    icon: Icons.logout_rounded,
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
