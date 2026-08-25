import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/service_repository.dart';
import '../../models/service_model.dart';

class CatalogueState {
  final List<Service> services;
  final List<String> categories;
  final String? selectedCategory;
  final String searchQuery;
  final bool isLoading;
  final String? errorMessage;

  const CatalogueState({
    this.services = const [],
    this.categories = const [],
    this.selectedCategory,
    this.searchQuery = '',
    this.isLoading = false,
    this.errorMessage,
  });

  CatalogueState copyWith({
    List<Service>? services,
    List<String>? categories,
    String? selectedCategory,
    bool clearCategory = false,
    String? searchQuery,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) {
    return CatalogueState(
      services: services ?? this.services,
      categories: categories ?? this.categories,
      selectedCategory: clearCategory ? null : (selectedCategory ?? this.selectedCategory),
      searchQuery: searchQuery ?? this.searchQuery,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class CatalogueNotifier extends StateNotifier<CatalogueState> {
  final ServiceRepository _repository;

  CatalogueNotifier(this._repository) : super(const CatalogueState()) {
    loadCatalogue();
  }

  Future<void> loadCatalogue() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final res = await _repository.getServices(
        search: state.searchQuery.isEmpty ? null : state.searchQuery,
        category: state.selectedCategory,
      );
      final cats = await _repository.getCategories();

      if (!mounted) return;
      state = state.copyWith(
        services: res.items,
        categories: cats,
        isLoading: false,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceAll('ApiException: ', ''),
      );
    }
  }

  void search(String query) {
    state = state.copyWith(searchQuery: query);
    loadCatalogue();
  }

  void setCategory(String? category) {
    if (category == null) {
      state = state.copyWith(clearCategory: true);
    } else {
      state = state.copyWith(selectedCategory: category);
    }
    loadCatalogue();
  }
}

final catalogueProvider = StateNotifierProvider<CatalogueNotifier, CatalogueState>((ref) {
  final repo = ref.watch(serviceRepositoryProvider);
  return CatalogueNotifier(repo);
});
