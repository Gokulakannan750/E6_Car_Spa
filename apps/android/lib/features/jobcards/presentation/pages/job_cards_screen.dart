import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/app_search_field.dart';
import '../../../../shared/widgets/status_badge.dart';
import '../../models/job_card_model.dart';
import '../../providers/job_card_providers.dart';

class JobCardsScreen extends ConsumerStatefulWidget {
  const JobCardsScreen({super.key});

  @override
  ConsumerState<JobCardsScreen> createState() => _JobCardsScreenState();
}

class _JobCardsScreenState extends ConsumerState<JobCardsScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(jobCardListProvider);
    final notifier = ref.read(jobCardListProvider.notifier);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Job Cards'),
        centerTitle: false,
        actions: const [
          AppLogoutAction(),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          ref.read(newJobCardProvider.notifier).reset();
          context.go('/job-cards/new');
        },
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.textOnPrimary,
        icon: const Icon(Icons.add),
        label: const Text('New Job Card'),
      ),
      body: RefreshIndicator(
        onRefresh: () => notifier.loadJobCards(refresh: true),
        color: AppColors.primary,
        child: Column(
          children: [
            // Search and Status Filters
            Container(
              color: AppColors.card,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  AppSearchField(
                    controller: _searchController,
                    hint: 'Search by JC#, customer, vehicle...',
                    onChanged: (val) => notifier.search(val),
                    onClear: () {
                      _searchController.clear();
                      notifier.search('');
                    },
                  ),
                  const SizedBox(height: 10),
                  // Horizontal Status Filter Chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildFilterChip(
                          label: 'All',
                          isSelected: state.selectedStatus == null,
                          onSelected: (_) => notifier.setStatusFilter(null),
                        ),
                        ...JobCardStatus.values.map(
                          (status) => Padding(
                            padding: const EdgeInsets.only(left: 6),
                            child: _buildFilterChip(
                              label: status.label,
                              isSelected: state.selectedStatus == status,
                              onSelected: (_) => notifier.setStatusFilter(status),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Job Cards List
            Expanded(
              child: _buildBody(state, notifier),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip({
    required String label,
    required bool isSelected,
    required Function(bool) onSelected,
  }) {
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: onSelected,
      labelStyle: AppTextStyles.labelMedium.copyWith(
        color: isSelected ? AppColors.textOnPrimary : AppColors.textPrimary,
        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
      ),
      selectedColor: AppColors.primary,
      backgroundColor: AppColors.surfaceAlt,
      showCheckmark: false,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: isSelected ? AppColors.primary : AppColors.border,
        ),
      ),
    );
  }

  Widget _buildBody(JobCardListState state, JobCardListNotifier notifier) {
    if (state.isLoading && !state.isRefreshing) {
      return const AppLoadingState(message: 'Loading Job Cards...');
    }

    if (state.errorMessage != null) {
      return AppErrorState(
        message: state.errorMessage!,
        onRetry: () => notifier.loadJobCards(),
      );
    }

    if (state.items.isEmpty) {
      return AppEmptyState(
        title: 'No Job Cards found',
        message: state.searchQuery.isNotEmpty || state.selectedStatus != null
            ? 'No job cards match your filter criteria.'
            : 'Create your first Job Card using the button below.',
        icon: Icons.assignment_outlined,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.only(left: 16, right: 16, top: 12, bottom: 88),
      itemCount: state.items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final jc = state.items[index];
        return _JobCardCard(
          jobCard: jc,
          onTap: () => context.go('/job-cards/${jc.id}'),
        );
      },
    );
  }
}

class _JobCardCard extends StatelessWidget {
  final JobCardListItem jobCard;
  final VoidCallback onTap;

  const _JobCardCard({
    required this.jobCard,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border, width: 1),
      ),
      color: AppColors.card,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: JC Number + StatusBadge + Date
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    jobCard.jobCardNumber,
                    style: AppTextStyles.headingMedium.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                      fontFamily: 'monospace',
                    ),
                  ),
                  StatusBadge.fromLabel(jobCard.status.label),
                ],
              ),
              const Divider(height: 16, color: AppColors.borderLight),

              // Customer & Vehicle Details
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.person_outline, size: 15, color: AppColors.textSecondary),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                jobCard.customerName,
                                style: AppTextStyles.headingSmall,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.directions_car_outlined, size: 15, color: AppColors.textSecondary),
                            const SizedBox(width: 6),
                            Text(
                              jobCard.registrationNumber,
                              style: AppTextStyles.bodyMedium.copyWith(
                                fontWeight: FontWeight.w600,
                                fontFamily: 'monospace',
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '(${jobCard.vehicleDisplayName})',
                              style: AppTextStyles.bodySmall,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  // Total Amount
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'Total',
                        style: AppTextStyles.labelSmall,
                      ),
                      Text(
                        '₹${jobCard.totalAmount.toStringAsFixed(2)}',
                        style: AppTextStyles.headingMedium.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
