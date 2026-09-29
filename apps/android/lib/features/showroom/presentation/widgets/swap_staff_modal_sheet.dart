import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../data/showroom_repository.dart';
import '../../models/showroom_staff_assignment_model.dart';
import '../../providers/daily_staff_provider.dart';
import '../../providers/showroom_provider.dart';

class SwapStaffModalSheet extends ConsumerStatefulWidget {
  final String showroomId;
  final String showroomName;
  final DateTime selectedDate;
  final DailyStaffAssignment? initialStaffA;
  final List<DailyStaffAssignment> currentShowroomStaff;

  const SwapStaffModalSheet({
    super.key,
    required this.showroomId,
    required this.showroomName,
    required this.selectedDate,
    this.initialStaffA,
    required this.currentShowroomStaff,
  });

  @override
  ConsumerState<SwapStaffModalSheet> createState() => _SwapStaffModalSheetState();
}

class _SwapStaffModalSheetState extends ConsumerState<SwapStaffModalSheet> {
  final _formKey = GlobalKey<FormState>();
  final _reasonController = TextEditingController();
  final _notesController = TextEditingController();

  DailyStaffAssignment? _selectedStaffA;
  String? _selectedTargetShowroomId;
  DailyStaffAssignment? _selectedStaffB;

  String _coverageStartTime = '14:00';
  String _coverageEndTime = '18:00';

  bool _isLoadingTargetStaff = false;
  List<DailyStaffAssignment> _targetStaffList = [];
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _selectedStaffA = widget.initialStaffA ??
        (widget.currentShowroomStaff.isNotEmpty ? widget.currentShowroomStaff.first : null);
    if (_selectedStaffA != null) {
      _coverageStartTime = _selectedStaffA!.startTime;
      _coverageEndTime = _selectedStaffA!.endTime;
    }
  }

  @override
  void dispose() {
    _reasonController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  double? _calculateCoverageDuration() {
    return calculateSessionHours(_coverageStartTime, _coverageEndTime);
  }

  String _formatDurationString(double? hours) {
    if (hours == null || hours <= 0) return 'Invalid Period';
    if (hours == 1.0) return '1 hour';
    final isInt = (hours % 1) == 0;
    return isInt ? '${hours.toInt()} hours' : '$hours hours';
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

  Future<void> _pickCoverageStartTime() async {
    final initial = _parseTimeOfDay(_coverageStartTime) ?? const TimeOfDay(hour: 14, minute: 0);
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );

    if (picked != null) {
      setState(() {
        _coverageStartTime = _formatTimeOfDay(picked);
        _errorMessage = null;
      });
    }
  }

  Future<void> _pickCoverageEndTime() async {
    final initial = _parseTimeOfDay(_coverageEndTime) ?? const TimeOfDay(hour: 18, minute: 0);
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );

    if (picked != null) {
      setState(() {
        _coverageEndTime = _formatTimeOfDay(picked);
        _errorMessage = null;
      });
    }
  }

  Future<void> _onTargetShowroomChanged(String? showroomId) async {
    setState(() {
      _selectedTargetShowroomId = showroomId;
      _selectedStaffB = null;
      _targetStaffList = [];
      _errorMessage = null;
    });

    if (showroomId == null || showroomId.isEmpty) return;

    setState(() => _isLoadingTargetStaff = true);
    try {
      final repository = ref.read(showroomRepositoryProvider);
      final response = await repository.getDailyStaff(showroomId, widget.selectedDate);
      final assignments = response.staffAssignments;

      if (!mounted) return;
      setState(() {
        _targetStaffList = assignments;
        _isLoadingTargetStaff = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoadingTargetStaff = false;
        _errorMessage = 'Could not load staff for selected showroom.';
      });
    }
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedStaffA == null) {
      setState(() => _errorMessage = 'Please select Staff A.');
      return;
    }
    if (_selectedTargetShowroomId == null) {
      setState(() => _errorMessage = 'Please select target showroom.');
      return;
    }
    if (_selectedStaffB == null) {
      setState(() => _errorMessage = 'Please select Staff B.');
      return;
    }
    if (_selectedStaffA!.staffId == _selectedStaffB!.staffId) {
      setState(() => _errorMessage = 'Cannot swap a staff member with themselves.');
      return;
    }

    final durationHours = _calculateCoverageDuration();
    if (durationHours == null || durationHours <= 0) {
      setState(() => _errorMessage = 'Coverage end time must be after start time.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final swapResult = await ref
          .read(dailyStaffProvider(widget.showroomId).notifier)
          .swapStaff(
            staffAId: _selectedStaffA!.staffId,
            staffBId: _selectedStaffB!.staffId,
            showroomBId: _selectedTargetShowroomId!,
            coverageStartTime: _coverageStartTime,
            coverageEndTime: _coverageEndTime,
            reason: _reasonController.text.trim(),
            notes: _notesController.text.trim().isNotEmpty
                ? _notesController.text.trim()
                : null,
          );

      if (!mounted) return;
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Staff swap completed! Swap ID: #${swapResult.swapId}',
          ),
          backgroundColor: AppColors.primary,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _errorMessage = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final showroomsState = ref.watch(showroomsProvider);
    final availableShowrooms = showroomsState.showrooms
        .where((s) => s.id != widget.showroomId && s.isActive)
        .toList();

    final dateHeading = DateFormat('dd MMM yyyy').format(widget.selectedDate);
    final durationHours = _calculateCoverageDuration();
    final isDurationValid = durationHours != null && durationHours > 0;
    final durationText = _formatDurationString(durationHours);

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10, bottom: 8),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.purple.withAlpha(25),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.swap_horiz, color: Colors.purple, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Swap Staff Assignment',
                          style: AppTextStyles.headingSmall.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          '${widget.showroomName} • $dateHeading',
                          style: AppTextStyles.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close),
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
            ),
            const Divider(height: 1),

            // Form Body
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_errorMessage != null)
                      Container(
                        padding: const EdgeInsets.all(10),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: AppColors.error.withAlpha(20),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.error.withAlpha(60)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, size: 16, color: AppColors.error),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _errorMessage!,
                                style: const TextStyle(fontSize: 12, color: AppColors.error),
                              ),
                            ),
                          ],
                        ),
                      ),

                    // Staff A
                    Text(
                      'Primary Staff (Staff A in ${widget.showroomName}) *',
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<DailyStaffAssignment>(
                      value: _selectedStaffA,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      items: widget.currentShowroomStaff.map((a) {
                        return DropdownMenuItem(
                          value: a,
                          child: Text(
                            '${a.staffName} (${a.displayTimeRange})',
                            style: const TextStyle(fontSize: 13),
                          ),
                        );
                      }).toList(),
                      onChanged: (val) {
                        setState(() {
                          _selectedStaffA = val;
                          if (val != null) {
                            _coverageStartTime = val.startTime;
                            _coverageEndTime = val.endTime;
                          }
                        });
                      },
                    ),
                    const SizedBox(height: 14),

                    // Target Showroom (Showroom B)
                    Text(
                      'Target Showroom (Showroom B) *',
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: _selectedTargetShowroomId,
                      isExpanded: true,
                      hint: const Text('Select destination showroom'),
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      items: availableShowrooms.map((s) {
                        return DropdownMenuItem(
                          value: s.id,
                          child: Text(
                            s.name,
                            style: const TextStyle(fontSize: 13),
                          ),
                        );
                      }).toList(),
                      onChanged: _onTargetShowroomChanged,
                    ),
                    const SizedBox(height: 14),

                    // Replacement Staff (Staff B)
                    if (_selectedTargetShowroomId != null) ...[
                      Text(
                        'Replacement Staff (Staff B) *',
                        style: AppTextStyles.bodySmall.copyWith(
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      if (_isLoadingTargetStaff)
                        const Padding(
                          padding: EdgeInsets.all(8.0),
                          child: Center(child: CircularProgressIndicator()),
                        )
                      else if (_targetStaffList.isEmpty)
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade50,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.amber.shade300),
                          ),
                          child: Text(
                            'No staff assigned to this showroom on $dateHeading.',
                            style: TextStyle(fontSize: 12, color: Colors.amber.shade900),
                          ),
                        )
                      else
                        DropdownButtonFormField<DailyStaffAssignment>(
                          value: _selectedStaffB,
                          isExpanded: true,
                          hint: const Text('Select staff member to swap with'),
                          decoration: const InputDecoration(
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                          items: _targetStaffList
                              .where((b) => _selectedStaffA == null || b.staffId != _selectedStaffA!.staffId)
                              .map((b) {
                            return DropdownMenuItem(
                              value: b,
                              child: Text(
                                '${b.staffName} (${b.displayTimeRange})',
                                style: const TextStyle(fontSize: 13),
                              ),
                            );
                          }).toList(),
                          onChanged: (val) => setState(() => _selectedStaffB = val),
                        ),
                      const SizedBox(height: 14),
                    ],

                    // Swap Coverage Period Section
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.purple.withAlpha(8),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.purple.withAlpha(35)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'SWAP COVERAGE PERIOD',
                                style: AppTextStyles.bodySmall.copyWith(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 11,
                                  letterSpacing: 0.5,
                                  color: Colors.purple.shade900,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: isDurationValid ? Colors.purple.withAlpha(20) : AppColors.error.withAlpha(20),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(
                                    color: isDurationValid ? Colors.purple.withAlpha(60) : AppColors.error.withAlpha(60),
                                  ),
                                ),
                                child: Text(
                                  isDurationValid ? 'Duration: $durationText' : 'Invalid Period',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: isDurationValid ? Colors.purple.shade900 : AppColors.error,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Start Time',
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                                    ),
                                    const SizedBox(height: 4),
                                    InkWell(
                                      onTap: _pickCoverageStartTime,
                                      borderRadius: BorderRadius.circular(8),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                        decoration: BoxDecoration(
                                          border: Border.all(color: Colors.grey.shade400),
                                          borderRadius: BorderRadius.circular(8),
                                          color: Colors.white,
                                        ),
                                        child: Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(_coverageStartTime, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                            const Icon(Icons.access_time, size: 16, color: Colors.purple),
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
                                    const Text(
                                      'End Time',
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                                    ),
                                    const SizedBox(height: 4),
                                    InkWell(
                                      onTap: _pickCoverageEndTime,
                                      borderRadius: BorderRadius.circular(8),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                        decoration: BoxDecoration(
                                          border: Border.all(color: Colors.grey.shade400),
                                          borderRadius: BorderRadius.circular(8),
                                          color: Colors.white,
                                        ),
                                        child: Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(_coverageEndTime, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                            const Icon(Icons.access_time, size: 16, color: Colors.purple),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          // Quick Presets
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children: [
                              ActionChip(
                                label: const Text('Full Day (09:00-18:00)', style: TextStyle(fontSize: 10)),
                                visualDensity: VisualDensity.compact,
                                padding: EdgeInsets.zero,
                                onPressed: () {
                                  setState(() {
                                    _coverageStartTime = '09:00';
                                    _coverageEndTime = '18:00';
                                  });
                                },
                              ),
                              ActionChip(
                                label: const Text('Morning (09:00-14:00)', style: TextStyle(fontSize: 10)),
                                visualDensity: VisualDensity.compact,
                                padding: EdgeInsets.zero,
                                onPressed: () {
                                  setState(() {
                                    _coverageStartTime = '09:00';
                                    _coverageEndTime = '14:00';
                                  });
                                },
                              ),
                              ActionChip(
                                label: const Text('Afternoon (14:00-18:00)', style: TextStyle(fontSize: 10)),
                                visualDensity: VisualDensity.compact,
                                padding: EdgeInsets.zero,
                                onPressed: () {
                                  setState(() {
                                    _coverageStartTime = '14:00';
                                    _coverageEndTime = '18:00';
                                  });
                                },
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Confirmation Summary Card
                    if (_selectedStaffA != null && _selectedStaffB != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'SWAP CONFIRMATION SUMMARY',
                              style: AppTextStyles.bodySmall.copyWith(
                                fontWeight: FontWeight.w700,
                                fontSize: 10,
                                letterSpacing: 0.5,
                                color: AppColors.textSecondary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            _buildSummaryRow('Original Staff:', '${_selectedStaffA!.staffName} (${_selectedStaffA!.displayTimeRange})'),
                            const SizedBox(height: 4),
                            _buildSummaryRow('Replacement Staff:', '${_selectedStaffB!.staffName} (${_selectedStaffB!.displayTimeRange})'),
                            const SizedBox(height: 4),
                            _buildSummaryRow('Coverage Period:', '$_coverageStartTime – $_coverageEndTime'),
                            const SizedBox(height: 4),
                            _buildSummaryRow('Coverage Duration:', durationText),
                            const SizedBox(height: 8),
                            Text(
                              'Note: ${_selectedStaffB!.staffName} will cover ${_selectedStaffA!.staffName} temporarily during this specific period.',
                              style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],

                    // Reason for Swap
                    Text(
                      'Reason for Swap *',
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _reasonController,
                      decoration: const InputDecoration(
                        hintText: 'e.g. Coverage for heavy ceramic workload',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Please provide a reason for the swap.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Additional Notes
                    Text(
                      'Additional Notes (Optional)',
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _notesController,
                      decoration: const InputDecoration(
                        hintText: 'Optional operational notes...',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Submit Button
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.purple.shade700,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        onPressed: (_isSubmitting || !isDurationValid) ? null : _handleSubmit,
                        child: _isSubmitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text(
                                'Execute Staff Swap',
                                style: TextStyle(fontWeight: FontWeight.w700),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 125,
          child: Text(
            label,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
          ),
        ),
      ],
    );
  }
}
