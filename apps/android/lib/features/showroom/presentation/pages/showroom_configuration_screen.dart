import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../models/showroom_operations_model.dart';
import '../../providers/showroom_configuration_provider.dart';

class ShowroomConfigurationScreen extends ConsumerStatefulWidget {
  const ShowroomConfigurationScreen({super.key});

  @override
  ConsumerState<ShowroomConfigurationScreen> createState() =>
      _ShowroomConfigurationScreenState();
}

class _ShowroomConfigurationScreenState
    extends ConsumerState<ShowroomConfigurationScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    // Rebuild so the Add button label follows the selected tab.
    _tabController.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _showAddVehicleTypeSheet(BuildContext context) {
    final nameController = TextEditingController();
    final orderController = TextEditingController(text: '0');
    String? errorText;
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppModalHeader(
                title: 'Add Vehicle Type',
                subtitle: 'Master category for showroom operations',
                onClose: () => Navigator.of(ctx).pop(),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (errorText != null) ...[
                      Text(
                        errorText!,
                        style: const TextStyle(color: AppColors.error, fontSize: 12),
                      ),
                      const SizedBox(height: 8),
                    ],
                    Text(
                      'Vehicle Type Name *',
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    AppTextField(
                      key: const Key('vt_name_field'),
                      controller: nameController,
                      hintText: 'e.g. Hatchback, Sedan, SUV/MUV, Bike...',
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Display Order',
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    AppTextField(
                      controller: orderController,
                      keyboardType: TextInputType.number,
                      hintText: '0',
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.of(ctx).pop(),
                            child: const Text('Cancel'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: AppButton(
                            label: isSaving ? 'Saving...' : 'Save',
                            isLoading: isSaving,
                            onPressed: isSaving
                                ? null
                                : () async {
                                    final name = nameController.text.trim();
                                    if (name.isEmpty) {
                                      setModalState(() {
                                        errorText = 'Name is required.';
                                      });
                                      return;
                                    }
                                    setModalState(() {
                                      isSaving = true;
                                      errorText = null;
                                    });
                                    try {
                                      final order = int.tryParse(orderController.text.trim()) ?? 0;
                                      await ref
                                          .read(showroomConfigurationProvider.notifier)
                                          .createVehicleType(name: name, displayOrder: order);
                                      if (ctx.mounted) Navigator.of(ctx).pop();
                                    } catch (e) {
                                      setModalState(() {
                                        isSaving = false;
                                        errorText = e.toString().replaceFirst('Exception: ', '');
                                      });
                                    }
                                  },
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
      ),
    );
  }

  void _showEditVehicleTypeSheet(BuildContext context, ShowroomVehicleType vt) {
    final nameController = TextEditingController(text: vt.name);
    final orderController = TextEditingController(text: vt.displayOrder.toString());
    bool isActive = vt.isActive;
    String? errorText;
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppModalHeader(
                title: 'Edit Vehicle Type',
                subtitle: vt.name,
                onClose: () => Navigator.of(ctx).pop(),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (errorText != null) ...[
                      Text(
                        errorText!,
                        style: const TextStyle(color: AppColors.error, fontSize: 12),
                      ),
                      const SizedBox(height: 8),
                    ],
                    Text(
                      'Vehicle Type Name *',
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    AppTextField(
                      controller: nameController,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Display Order',
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    AppTextField(
                      controller: orderController,
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile.adaptive(
                      title: const Text('Active', style: TextStyle(fontSize: 14)),
                      subtitle: const Text(
                        'Available for new showroom vehicle work records',
                        style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      ),
                      value: isActive,
                      onChanged: (val) {
                        setModalState(() {
                          isActive = val;
                        });
                      },
                      contentPadding: EdgeInsets.zero,
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.of(ctx).pop(),
                            child: const Text('Cancel'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: AppButton(
                            label: isSaving ? 'Saving...' : 'Update',
                            isLoading: isSaving,
                            onPressed: isSaving
                                ? null
                                : () async {
                                    final name = nameController.text.trim();
                                    if (name.isEmpty) {
                                      setModalState(() {
                                        errorText = 'Name is required.';
                                      });
                                      return;
                                    }
                                    setModalState(() {
                                      isSaving = true;
                                      errorText = null;
                                    });
                                    try {
                                      final order = int.tryParse(orderController.text.trim()) ?? 0;
                                      await ref
                                          .read(showroomConfigurationProvider.notifier)
                                          .updateVehicleType(
                                            vt.id,
                                            name: name,
                                            displayOrder: order,
                                            isActive: isActive,
                                          );
                                      if (ctx.mounted) Navigator.of(ctx).pop();
                                    } catch (e) {
                                      setModalState(() {
                                        isSaving = false;
                                        errorText = e.toString().replaceFirst('Exception: ', '');
                                      });
                                    }
                                  },
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
      ),
    );
  }

  void _showAddWorkTypeSheet(BuildContext context) {
    final nameController = TextEditingController();
    final descController = TextEditingController();
    final orderController = TextEditingController(text: '0');
    String? errorText;
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppModalHeader(
                title: 'Add Showroom Work Type',
                subtitle: 'Configurable label for showroom vehicle work',
                onClose: () => Navigator.of(ctx).pop(),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (errorText != null) ...[
                      Text(
                        errorText!,
                        style: const TextStyle(color: AppColors.error, fontSize: 12),
                      ),
                      const SizedBox(height: 8),
                    ],
                    Text(
                      'Work Type Name *',
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    AppTextField(
                      key: const Key('wt_name_field'),
                      controller: nameController,
                      hintText: 'e.g. Body Wash, Polishing, Other...',
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Description (Optional)',
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    AppTextField(
                      controller: descController,
                      hintText: 'Brief description of service...',
                      maxLines: 2,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Display Order',
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    AppTextField(
                      controller: orderController,
                      keyboardType: TextInputType.number,
                      hintText: '0',
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.of(ctx).pop(),
                            child: const Text('Cancel'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: AppButton(
                            label: isSaving ? 'Saving...' : 'Save',
                            isLoading: isSaving,
                            onPressed: isSaving
                                ? null
                                : () async {
                                    final name = nameController.text.trim();
                                    if (name.isEmpty) {
                                      setModalState(() {
                                        errorText = 'Name is required.';
                                      });
                                      return;
                                    }
                                    setModalState(() {
                                      isSaving = true;
                                      errorText = null;
                                    });
                                    try {
                                      final order = int.tryParse(orderController.text.trim()) ?? 0;
                                      final desc = descController.text.trim();
                                      await ref
                                          .read(showroomConfigurationProvider.notifier)
                                          .createWorkType(
                                            name: name,
                                            description: desc.isEmpty ? null : desc,
                                            displayOrder: order,
                                          );
                                      if (ctx.mounted) Navigator.of(ctx).pop();
                                    } catch (e) {
                                      setModalState(() {
                                        isSaving = false;
                                        errorText = e.toString().replaceFirst('Exception: ', '');
                                      });
                                    }
                                  },
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
      ),
    );
  }

  void _showEditWorkTypeSheet(BuildContext context, ShowroomWorkType wt) {
    final nameController = TextEditingController(text: wt.name);
    final descController = TextEditingController(text: wt.description ?? '');
    final orderController = TextEditingController(text: wt.displayOrder.toString());
    bool isActive = wt.isActive;
    String? errorText;
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppModalHeader(
                title: 'Edit Showroom Work Type',
                subtitle: wt.name,
                onClose: () => Navigator.of(ctx).pop(),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (errorText != null) ...[
                      Text(
                        errorText!,
                        style: const TextStyle(color: AppColors.error, fontSize: 12),
                      ),
                      const SizedBox(height: 8),
                    ],
                    Text(
                      'Work Type Name *',
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    AppTextField(
                      controller: nameController,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Description (Optional)',
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    AppTextField(
                      controller: descController,
                      maxLines: 2,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Display Order',
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    AppTextField(
                      controller: orderController,
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile.adaptive(
                      title: const Text('Active', style: TextStyle(fontSize: 14)),
                      subtitle: const Text(
                        'Available for new showroom vehicle work records',
                        style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      ),
                      value: isActive,
                      onChanged: (val) {
                        setModalState(() {
                          isActive = val;
                        });
                      },
                      contentPadding: EdgeInsets.zero,
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.of(ctx).pop(),
                            child: const Text('Cancel'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: AppButton(
                            label: isSaving ? 'Saving...' : 'Update',
                            isLoading: isSaving,
                            onPressed: isSaving
                                ? null
                                : () async {
                                    final name = nameController.text.trim();
                                    if (name.isEmpty) {
                                      setModalState(() {
                                        errorText = 'Name is required.';
                                      });
                                      return;
                                    }
                                    setModalState(() {
                                      isSaving = true;
                                      errorText = null;
                                    });
                                    try {
                                      final order = int.tryParse(orderController.text.trim()) ?? 0;
                                      final desc = descController.text.trim();
                                      await ref
                                          .read(showroomConfigurationProvider.notifier)
                                          .updateWorkType(
                                            wt.id,
                                            name: name,
                                            description: desc.isEmpty ? null : desc,
                                            displayOrder: order,
                                            isActive: isActive,
                                          );
                                      if (ctx.mounted) Navigator.of(ctx).pop();
                                    } catch (e) {
                                      setModalState(() {
                                        isSaving = false;
                                        errorText = e.toString().replaceFirst('Exception: ', '');
                                      });
                                    }
                                  },
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
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(showroomConfigurationProvider);
    final authUser = ref.watch(currentUserProvider);
    final isOwner = authUser?.isOwner ?? false;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Showroom Configuration',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 16,
            color: AppColors.textPrimary,
          ),
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          tabs: const [
            Tab(text: 'Vehicle Types'),
            Tab(text: 'Work Types'),
          ],
        ),
      ),
      body: state.isLoading
          ? const Center(child: AppLoadingState())
          : Column(
              children: [
                if (!isOwner)
                  Container(
                    width: double.infinity,
                    color: const Color(0xFFFEF3C7),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    child: const Row(
                      children: [
                        Icon(Icons.info_outline, color: Color(0xFFD97706), size: 18),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Owner-Only Management: You are viewing in read-only mode.',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF92400E),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      // TAB 1: VEHICLE TYPES
                      _buildVehicleTypesList(context, state, isOwner),
                      // TAB 2: SHOWROOM WORK TYPES
                      _buildWorkTypesList(context, state, isOwner),
                    ],
                  ),
                ),
              ],
            ),
      floatingActionButton: isOwner
          ? FloatingActionButton.extended(
              key: const Key('add_showroom_config_fab'),
              onPressed: () {
                if (_tabController.index == 0) {
                  _showAddVehicleTypeSheet(context);
                } else {
                  _showAddWorkTypeSheet(context);
                }
              },
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add),
              label: Text(_tabController.index == 0 ? 'Add Vehicle Type' : 'Add Work Type'),
            )
          : null,
    );
  }

  Widget _buildVehicleTypesList(
    BuildContext context,
    ShowroomConfigurationState state,
    bool isOwner,
  ) {
    if (state.vehicleTypes.isEmpty) {
      return const Center(
        child: Text(
          'No vehicle types configured yet.',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
      itemCount: state.vehicleTypes.length,
      itemBuilder: (ctx, index) {
        final vt = state.vehicleTypes[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: AppColors.border),
          ),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: AppColors.primary.withAlpha(20),
              foregroundColor: AppColors.primary,
              child: const Icon(Icons.directions_car_filled_outlined, size: 20),
            ),
            title: Row(
              children: [
                Expanded(
                  child: Text(
                    vt.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: vt.isActive
                        ? const Color(0xFFECFDF5)
                        : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: vt.isActive
                          ? const Color(0xFFA7F3D0)
                          : const Color(0xFFCBD5E1),
                    ),
                  ),
                  child: Text(
                    vt.isActive ? 'Active' : 'Inactive',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: vt.isActive
                          ? const Color(0xFF059669)
                          : const Color(0xFF64748B),
                    ),
                  ),
                ),
              ],
            ),
            subtitle: Text(
              'Order: ${vt.displayOrder}',
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            trailing: isOwner
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        key: Key('edit_vt_${vt.id}'),
                        icon: const Icon(Icons.edit_outlined, size: 18),
                        tooltip: 'Edit',
                        onPressed: () => _showEditVehicleTypeSheet(context, vt),
                      ),
                      IconButton(
                        key: Key('toggle_vt_${vt.id}'),
                        icon: Icon(
                          vt.isActive
                              ? Icons.toggle_on_rounded
                              : Icons.toggle_off_outlined,
                          size: 26,
                          color: vt.isActive ? AppColors.primary : AppColors.textSecondary,
                        ),
                        tooltip: vt.isActive ? 'Deactivate' : 'Activate',
                        onPressed: () {
                          ref
                              .read(showroomConfigurationProvider.notifier)
                              .toggleVehicleTypeActive(vt.id);
                        },
                      ),
                    ],
                  )
                : null,
          ),
        );
      },
    );
  }

  Widget _buildWorkTypesList(
    BuildContext context,
    ShowroomConfigurationState state,
    bool isOwner,
  ) {
    if (state.workTypes.isEmpty) {
      return const Center(
        child: Text(
          'No showroom work types configured yet.',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
      itemCount: state.workTypes.length,
      itemBuilder: (ctx, index) {
        final wt = state.workTypes[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: AppColors.border),
          ),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: const Color(0xFFEDE9FE),
              foregroundColor: const Color(0xFF7C3AED),
              child: const Icon(Icons.build_rounded, size: 18),
            ),
            title: Row(
              children: [
                Expanded(
                  child: Text(
                    wt.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: wt.isActive
                        ? const Color(0xFFECFDF5)
                        : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: wt.isActive
                          ? const Color(0xFFA7F3D0)
                          : const Color(0xFFCBD5E1),
                    ),
                  ),
                  child: Text(
                    wt.isActive ? 'Active' : 'Inactive',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: wt.isActive
                          ? const Color(0xFF059669)
                          : const Color(0xFF64748B),
                    ),
                  ),
                ),
              ],
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (wt.description != null && wt.description!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      wt.description!,
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    'Order: ${wt.displayOrder}',
                    style: const TextStyle(fontSize: 11, color: AppColors.textTertiary),
                  ),
                ),
              ],
            ),
            trailing: isOwner
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        key: Key('edit_wt_${wt.id}'),
                        icon: const Icon(Icons.edit_outlined, size: 18),
                        tooltip: 'Edit',
                        onPressed: () => _showEditWorkTypeSheet(context, wt),
                      ),
                      IconButton(
                        key: Key('toggle_wt_${wt.id}'),
                        icon: Icon(
                          wt.isActive
                              ? Icons.toggle_on_rounded
                              : Icons.toggle_off_outlined,
                          size: 26,
                          color: wt.isActive ? AppColors.primary : AppColors.textSecondary,
                        ),
                        tooltip: wt.isActive ? 'Deactivate' : 'Activate',
                        onPressed: () {
                          ref
                              .read(showroomConfigurationProvider.notifier)
                              .toggleWorkTypeActive(wt.id);
                        },
                      ),
                    ],
                  )
                : null,
          ),
        );
      },
    );
  }
}
