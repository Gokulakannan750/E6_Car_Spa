import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../staff/providers/staff_provider.dart';

class AssignStaffModalSheet extends ConsumerStatefulWidget {
  final String showroomName;
  final DateTime selectedDate;
  final Set<String> alreadyAssignedStaffIds;
  final Future<void> Function(List<String> staffIds, int initialVehicles) onAssign;

  const AssignStaffModalSheet({
    super.key,
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
  final TextEditingController _vehiclesController = TextEditingController(text: '0');

  final Set<String> _selectedStaffIds = <String>{};
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
    _vehiclesController.dispose();
    super.dispose();
  }

  void _toggleStaffSelection(String staffId) {
    setState(() {
      if (_selectedStaffIds.contains(staffId)) {
        _selectedStaffIds.remove(staffId);
      } else {
        _selectedStaffIds.add(staffId);
      }
      _errorMessage = null;
    });
  }

  void _removeSelectedStaff(String staffId) {
    setState(() {
      _selectedStaffIds.remove(staffId);
      _errorMessage = null;
    });
  }

  Future<void> _handleSubmit() async {
    if (_selectedStaffIds.isEmpty) {
      setState(() {
        _errorMessage = 'Please select at least one staff member to assign.';
      });
      return;
    }

    final rawVehicles = _vehiclesController.text.trim();
    final vehicles = int.tryParse(rawVehicles);
    if (vehicles == null || vehicles < 0) {
      setState(() {
        _errorMessage = 'Vehicles attended must be a valid non-negative integer (0 or greater).';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      await widget.onAssign(_selectedStaffIds.toList(), vehicles);
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
    final activeStaffList = staffState.staffList.where((s) => s.isActive).where((s) {
      if (searchTerm.isEmpty) return true;
      return s.name.toLowerCase().contains(searchTerm) ||
          s.phoneNumber.contains(searchTerm) ||
          (s.role != null && s.role!.toLowerCase().contains(searchTerm));
    }).toList();

    // Map of all staff for quick lookup of selected chips
    final staffMap = {for (var s in staffState.staffList) s.id: s};

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.88,
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
            title: 'Assign Staff Members',
            subtitle: 'Showroom: ${widget.showroomName}',
            icon: Icons.person_add_alt_1_outlined,
            iconBgColor: AppColors.primary.withAlpha(20),
            iconColor: AppColors.primary,
            showDragHandle: true,
          ),
          const SizedBox(height: 12),

          // Error Banner
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
                  const Icon(Icons.error_outline, size: 18, color: AppColors.error),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: AppTextStyles.bodySmall.copyWith(
                        color: AppColors.errorDark,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],

          // Vehicles Attended Field
          Row(
            children: [
              Expanded(
                child: AppTextField(
                  key: const Key('vehicles_attended_input'),
                  controller: _vehiclesController,
                  label: 'Vehicles Attended (Initial)',
                  hintText: '0',
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  prefixIcon: const Icon(Icons.directions_car_outlined, size: 20),
                  onChanged: (_) {
                    if (_errorMessage != null) {
                      setState(() => _errorMessage = null);
                    }
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Selected Staff Chips (if any)
          if (_selectedStaffIds.isNotEmpty) ...[
            Text(
              'Selected Staff (${_selectedStaffIds.length}):',
              style: AppTextStyles.bodySmall.copyWith(
                fontWeight: FontWeight.w600,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 6),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 72),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: _selectedStaffIds.map((id) {
                    final staff = staffMap[id];
                    final name = staff?.name ?? 'Staff';
                    return Container(
                      margin: const EdgeInsets.only(right: 8, bottom: 4),
                      child: Chip(
                        avatar: CircleAvatar(
                          backgroundColor: AppColors.primary,
                          child: Text(
                            staff?.initials ?? '?',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        label: Text(
                          name,
                          style: AppTextStyles.bodySmall.copyWith(
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                        ),
                        deleteIcon: const Icon(Icons.close, size: 16),
                        deleteIconColor: AppColors.textSecondary,
                        onDeleted: () => _removeSelectedStaff(id),
                        backgroundColor: AppColors.primary.withAlpha(20),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                          side: BorderSide(color: AppColors.primary.withAlpha(80)),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
            const SizedBox(height: 6),
          ],

          // Search Field
          AppTextField(
            controller: _searchController,
            hintText: 'Search staff by name, role, or phone...',
            prefixIcon: const Icon(Icons.search),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 10),

          // Staff List Header
          Text(
            'Select Active Staff Members:',
            style: AppTextStyles.bodySmall.copyWith(
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),

          // Staff List View
          Expanded(
            child: staffState.isLoading
                ? const Center(child: CircularProgressIndicator())
                : activeStaffList.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 24),
                          child: Text(
                            'No active staff found.',
                            style: AppTextStyles.bodyMedium.copyWith(
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                      )
                    : ListView.builder(
                        itemCount: activeStaffList.length,
                        itemBuilder: (context, index) {
                          final staff = activeStaffList[index];
                          final isAlreadyAssigned =
                              widget.alreadyAssignedStaffIds.contains(staff.id);
                          final isSelected = _selectedStaffIds.contains(staff.id);

                          return Container(
                            margin: const EdgeInsets.only(bottom: 6),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppColors.primary.withAlpha(15)
                                  : (isAlreadyAssigned
                                      ? AppColors.surfaceAlt.withAlpha(150)
                                      : Colors.white),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isSelected
                                    ? AppColors.primary
                                    : (isAlreadyAssigned
                                        ? AppColors.border.withAlpha(80)
                                        : AppColors.border),
                                width: isSelected ? 1.5 : 1.0,
                              ),
                            ),
                            child: ListTile(
                              dense: true,
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 2,
                              ),
                              enabled: !isAlreadyAssigned,
                              leading: CircleAvatar(
                                radius: 16,
                                backgroundColor: isSelected
                                    ? AppColors.primary
                                    : (isAlreadyAssigned
                                        ? AppColors.surfaceAlt
                                        : AppColors.primary.withAlpha(25)),
                                child: Text(
                                  staff.initials,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: isSelected
                                        ? Colors.white
                                        : (isAlreadyAssigned
                                            ? AppColors.textTertiary
                                            : AppColors.primary),
                                  ),
                                ),
                              ),
                              title: Text(
                                staff.name,
                                style: AppTextStyles.bodyMedium.copyWith(
                                  fontWeight: FontWeight.w600,
                                  color: isAlreadyAssigned
                                      ? AppColors.textTertiary
                                      : AppColors.textPrimary,
                                ),
                              ),
                              subtitle: Wrap(
                                crossAxisAlignment: WrapCrossAlignment.center,
                                spacing: 6,
                                runSpacing: 2,
                                children: [
                                  if (staff.role != null && staff.role!.isNotEmpty)
                                    Text(
                                      staff.role!,
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: isAlreadyAssigned
                                            ? AppColors.textTertiary
                                            : AppColors.textSecondary,
                                      ),
                                    ),
                                  Text(
                                    staff.phoneNumber,
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontFamily: 'monospace',
                                      color: isAlreadyAssigned
                                          ? AppColors.textTertiary
                                          : AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                              trailing: isAlreadyAssigned
                                  ? Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 3,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.surfaceAlt,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        'Already Assigned',
                                        style: AppTextStyles.bodySmall.copyWith(
                                          color: AppColors.textTertiary,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    )
                                  : Checkbox(
                                      value: isSelected,
                                      activeColor: AppColors.primary,
                                      onChanged: (val) => _toggleStaffSelection(staff.id),
                                    ),
                              onTap: isAlreadyAssigned
                                  ? null
                                  : () => _toggleStaffSelection(staff.id),
                            ),
                          );
                        },
                      ),
          ),
          const SizedBox(height: 12),

          // Bottom action buttons (Cancel + Submit)
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
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: AppButton(
                  key: const Key('modal_assign_button'),
                  label: _selectedStaffIds.length > 1
                      ? 'Assign (${_selectedStaffIds.length}) Staff'
                      : 'Assign Staff',
                  icon: Icons.check_rounded,
                  isLoading: _isSubmitting,
                  onPressed: _selectedStaffIds.isEmpty ? null : _handleSubmit,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
