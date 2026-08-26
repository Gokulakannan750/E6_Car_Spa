import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../shared/widgets/app_empty_state.dart';
import '../../../../shared/widgets/app_error_state.dart';
import '../../../../shared/widgets/app_loading_state.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/app_search_field.dart';
import '../providers/catalogue_providers.dart';

class CatalogueScreen extends ConsumerStatefulWidget {
  const CatalogueScreen({super.key});

  @override
  ConsumerState<CatalogueScreen> createState() => _CatalogueScreenState();
}

class _CatalogueScreenState extends ConsumerState<CatalogueScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(catalogueProvider);
    final notifier = ref.read(catalogueProvider.notifier);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Service Catalogue'),
        centerTitle: false,
        actions: const [
          AppLogoutAction(),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => notifier.loadCatalogue(),
        color: AppColors.primary,
        child: Column(
          children: [
            // Search and Category filter
            Container(
              color: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  AppSearchField(
                    controller: _searchController,
                    hint: 'Search services by name or keyword...',
                    onChanged: (val) => notifier.search(val),
                    onClear: () {
                      _searchController.clear();
                      notifier.search('');
                    },
                  ),
                  if (state.categories.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          ChoiceChip(
                            label: const Text('All Categories'),
                            selected: state.selectedCategory == null,
                            onSelected: (_) => notifier.setCategory(null),
                            labelStyle: TextStyle(
                              color: state.selectedCategory == null ? Colors.white : AppColors.textPrimary,
                              fontWeight: state.selectedCategory == null ? FontWeight.w600 : FontWeight.w500,
                              fontSize: 12,
                            ),
                            selectedColor: AppColors.primary,
                            backgroundColor: AppColors.surfaceAlt,
                            showCheckmark: false,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                              side: BorderSide(
                                color: state.selectedCategory == null ? AppColors.primary : AppColors.border,
                              ),
                            ),
                          ),
                          ...state.categories.map(
                            (cat) => Padding(
                              padding: const EdgeInsets.only(left: 6),
                              child: ChoiceChip(
                                label: Text(cat),
                                selected: state.selectedCategory == cat,
                                onSelected: (_) => notifier.setCategory(cat),
                                labelStyle: TextStyle(
                                  color: state.selectedCategory == cat ? Colors.white : AppColors.textPrimary,
                                  fontWeight: state.selectedCategory == cat ? FontWeight.w600 : FontWeight.w500,
                                  fontSize: 12,
                                ),
                                selectedColor: AppColors.primary,
                                backgroundColor: AppColors.surfaceAlt,
                                showCheckmark: false,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(20),
                                  side: BorderSide(
                                    color: state.selectedCategory == cat ? AppColors.primary : AppColors.border,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // Service Cards List
            Expanded(
              child: _buildBody(state, notifier),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(CatalogueState state, CatalogueNotifier notifier) {
    if (state.isLoading) {
      return const AppLoadingState(message: 'Loading service catalogue...');
    }

    if (state.errorMessage != null) {
      return AppErrorState(
        message: state.errorMessage!,
        onRetry: () => notifier.loadCatalogue(),
      );
    }

    if (state.services.isEmpty) {
      return AppEmptyState(
        title: 'No services found',
        message: state.searchQuery.isNotEmpty || state.selectedCategory != null
            ? 'No services match your search and category filter.'
            : 'No catalogue services available in the system.',
        icon: Icons.inventory_2_outlined,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: state.services.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final svc = state.services[index];
        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
            boxShadow: const [
              BoxShadow(
                color: Color(0x05000000),
                blurRadius: 6,
                offset: Offset(0, 2),
              ),
            ],
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.accentPill,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.build_circle_outlined, color: AppColors.primary, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          svc.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        if (svc.description != null && svc.description!.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            svc.description!,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  Text(
                    '₹${svc.price.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
              const Divider(height: 18, color: AppColors.border),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Text(
                          svc.category ?? 'General',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                        ),
                      ),
                      if (svc.durationMinutes != null) ...[
                        const SizedBox(width: 8),
                        Row(
                          children: [
                            const Icon(Icons.schedule, size: 12, color: AppColors.textTertiary),
                            const SizedBox(width: 3),
                            Text(
                              '${svc.durationMinutes} min',
                              style: const TextStyle(fontSize: 11, color: AppColors.textTertiary),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.accentPill,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      'GST ${svc.taxPercentage.toInt()}%',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
