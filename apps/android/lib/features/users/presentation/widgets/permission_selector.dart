import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../models/permission_model.dart';

class PermissionSelector extends StatelessWidget {
  final List<PermissionGroupModel> groups;
  final List<String> selected;
  final ValueChanged<List<String>> onChange;
  final bool disabled;

  const PermissionSelector({
    super.key,
    required this.groups,
    required this.selected,
    required this.onChange,
    this.disabled = false,
  });

  void _togglePermission(String code) {
    if (disabled) return;
    if (selected.contains(code)) {
      onChange(selected.where((c) => c != code).toList());
    } else {
      onChange([...selected, code]);
    }
  }

  void _selectAllModule(List<PermissionModel> modulePermissions) {
    if (disabled) return;
    final moduleCodes = modulePermissions.map((p) => p.code).toSet();
    final newSelected = {...selected, ...moduleCodes}.toList();
    onChange(newSelected);
  }

  void _clearAllModule(List<PermissionModel> modulePermissions) {
    if (disabled) return;
    final moduleCodes = modulePermissions.map((p) => p.code).toSet();
    onChange(selected.where((c) => !moduleCodes.contains(c)).toList());
  }

  @override
  Widget build(BuildContext context) {
    if (groups.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: const Center(
          child: Text(
            'No permissions available to configure.',
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: groups.map((group) {
        final selectedCount =
            group.permissions.where((p) => selected.contains(p.code)).length;
        final totalCount = group.permissions.length;

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              initiallyExpanded: selectedCount > 0,
              tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              title: Row(
                children: [
                  Expanded(
                    child: Text(
                      group.module.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: selectedCount > 0
                          ? AppColors.primary.withAlpha(20)
                          : AppColors.background,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '$selectedCount / $totalCount',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: selectedCount > 0
                            ? AppColors.primary
                            : AppColors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
              children: [
                if (!disabled)
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        TextButton(
                          onPressed: () => _selectAllModule(group.permissions),
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text(
                            'Select All',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Text('|',
                            style: TextStyle(color: AppColors.border)),
                        const SizedBox(width: 8),
                        TextButton(
                          onPressed: () => _clearAllModule(group.permissions),
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text(
                            'Clear All',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                const Divider(height: 1, color: AppColors.border),
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(12),
                  itemCount: group.permissions.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 6),
                  itemBuilder: (context, index) {
                    final perm = group.permissions[index];
                    final isChecked = selected.contains(perm.code);

                    return InkWell(
                      onTap: disabled ? null : () => _togglePermission(perm.code),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: isChecked
                              ? const Color(0xFFEFF6FF)
                              : AppColors.background,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: isChecked
                                ? const Color(0xFFBFDBFE)
                                : AppColors.border,
                            width: 1,
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(
                              width: 22,
                              height: 22,
                              child: Checkbox(
                                value: isChecked,
                                onChanged: disabled
                                    ? null
                                    : (_) => _togglePermission(perm.code),
                                activeColor: AppColors.primary,
                                materialTapTargetSize:
                                    MaterialTapTargetSize.shrinkWrap,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(4),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    perm.name,
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: isChecked
                                          ? FontWeight.w700
                                          : FontWeight.w600,
                                      color: isChecked
                                          ? const Color(0xFF1E3A8A)
                                          : AppColors.textPrimary,
                                    ),
                                  ),
                                  if (perm.description != null &&
                                      perm.description!.isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      perm.description!,
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.textSecondary,
                                        height: 1.2,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}
