import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../config/routes.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/app_environment.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_logout_action.dart';
import '../../../../shared/widgets/powered_by_trovo.dart';
import '../../models/system_preferences_model.dart';
import '../../providers/system_preferences_provider.dart';

class SystemPreferencesScreen extends ConsumerStatefulWidget {
  const SystemPreferencesScreen({super.key});

  @override
  ConsumerState<SystemPreferencesScreen> createState() =>
      _SystemPreferencesScreenState();
}

class _SystemPreferencesScreenState
    extends ConsumerState<SystemPreferencesScreen> {
  late SystemPreferencesModel _currentPrefs;
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    _currentPrefs = SystemPreferencesModel.defaultPreferences;
  }

  void _handleBackNavigation() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      context.go(AppRoutes.settings);
    }
  }

  Future<void> _handleSave() async {
    final success = await ref
        .read(systemPreferencesNotifierProvider.notifier)
        .savePreferences(_currentPrefs);

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('System preferences saved successfully.'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _handleReset() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reset Preferences'),
        content: const Text(
          'Are you sure you want to reset all system preferences to their default values?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Reset'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      await ref
          .read(systemPreferencesNotifierProvider.notifier)
          .resetToDefaults();
      setState(() {
        _currentPrefs = SystemPreferencesModel.defaultPreferences;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Preferences reset to standard defaults.'),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(systemPreferencesNotifierProvider);

    if (!_isInitialized && !state.isLoading) {
      _currentPrefs = state.preferences;
      _isInitialized = true;
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _handleBackNavigation();
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          backgroundColor: AppColors.background,
          elevation: 0,
          scrolledUnderElevation: 0,
          leading: IconButton(
            key: const Key('system_preferences_back_button'),
            icon: const Icon(Icons.arrow_back_rounded),
            tooltip: 'Back to Settings',
            onPressed: _handleBackNavigation,
          ),
          title: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'System Preferences',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                  color: AppColors.textPrimary,
                ),
              ),
              Text(
                'Display & Application Settings',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          actions: const [
            AppLogoutAction(),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          children: [
            // Status Banner if present
            if (state.message != null) ...[
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.successLight,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.success.withAlpha(50)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle_outline,
                        color: AppColors.success, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        state.message!,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.successDark,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // 1. Date & Time Card
            _buildSectionCard(
              title: 'Date & Time',
              icon: Icons.calendar_today_rounded,
              iconColor: const Color(0xFF0284C7),
              bgColor: const Color(0xFFF0F9FF),
              children: [
                const Text(
                  'Date Format',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((fmt) {
                    final isSelected = _currentPrefs.dateFormat == fmt;
                    return ChoiceChip(
                      label: Text(fmt),
                      selected: isSelected,
                      onSelected: (val) {
                        if (val) {
                          setState(() {
                            _currentPrefs =
                                _currentPrefs.copyWith(dateFormat: fmt);
                          });
                        }
                      },
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Time Display Format',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(
                      value: '12h',
                      label: Text('12 Hours (AM/PM)'),
                      icon: Icon(Icons.access_time_rounded, size: 16),
                    ),
                    ButtonSegment(
                      value: '24h',
                      label: Text('24 Hours (Railway)'),
                      icon: Icon(Icons.schedule_rounded, size: 16),
                    ),
                  ],
                  selected: {_currentPrefs.timeFormat},
                  onSelectionChanged: (set) {
                    setState(() {
                      _currentPrefs =
                          _currentPrefs.copyWith(timeFormat: set.first);
                    });
                  },
                ),
              ],
            ),
            const SizedBox(height: 16),

            // 2. Currency & Formatting Card
            _buildSectionCard(
              title: 'Currency & Formatting',
              icon: Icons.currency_rupee_rounded,
              iconColor: const Color(0xFF059669),
              bgColor: const Color(0xFFECFDF5),
              children: [
                const Text(
                  'Currency Symbol',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(
                      value: '₹',
                      label: Text('₹ (INR)'),
                    ),
                    ButtonSegment(
                      value: '\$',
                      label: Text('\$ (USD)'),
                    ),
                    ButtonSegment(
                      value: '€',
                      label: Text('€ (EUR)'),
                    ),
                  ],
                  selected: {_currentPrefs.currencySymbol},
                  onSelectionChanged: (set) {
                    setState(() {
                      _currentPrefs =
                          _currentPrefs.copyWith(currencySymbol: set.first);
                    });
                  },
                ),
                const SizedBox(height: 16),
                const Text(
                  'Decimal Precision',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                SegmentedButton<int>(
                  segments: const [
                    ButtonSegment(
                      value: 2,
                      label: Text('2 Decimals (.00)'),
                    ),
                    ButtonSegment(
                      value: 0,
                      label: Text('0 Decimals (Whole)'),
                    ),
                  ],
                  selected: {_currentPrefs.decimalPrecision},
                  onSelectionChanged: (set) {
                    setState(() {
                      _currentPrefs =
                          _currentPrefs.copyWith(decimalPrecision: set.first);
                    });
                  },
                ),
              ],
            ),
            const SizedBox(height: 16),

            // 3. Document Printing Card
            _buildSectionCard(
              title: 'Document Printing',
              icon: Icons.print_rounded,
              iconColor: const Color(0xFF4F46E5),
              bgColor: const Color(0xFFEEF2FF),
              children: [
                const Text(
                  'Default Print Copies',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                SegmentedButton<int>(
                  segments: const [
                    ButtonSegment(value: 1, label: Text('1 Copy')),
                    ButtonSegment(value: 2, label: Text('2 Copies')),
                    ButtonSegment(value: 3, label: Text('3 Copies')),
                  ],
                  selected: {_currentPrefs.defaultPrintCopies},
                  onSelectionChanged: (set) {
                    setState(() {
                      _currentPrefs =
                          _currentPrefs.copyWith(defaultPrintCopies: set.first);
                    });
                  },
                ),
                const SizedBox(height: 14),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text(
                    'Auto-Print Receipts',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  subtitle: const Text(
                    'Automatically open print dialog after job payment settlement',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  value: _currentPrefs.autoPrintReceipt,
                  onChanged: (val) {
                    setState(() {
                      _currentPrefs =
                          _currentPrefs.copyWith(autoPrintReceipt: val);
                    });
                  },
                ),
              ],
            ),
            const SizedBox(height: 16),

            // 4. Application Behavior Card
            _buildSectionCard(
              title: 'Application Behavior',
              icon: Icons.sync_rounded,
              iconColor: const Color(0xFFD97706),
              bgColor: const Color(0xFFFFFBEB),
              children: [
                const Text(
                  'Data Auto-Refresh Interval',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Frequency to sync job status and staff updates in the background',
                  style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    {'label': 'Manual / Off', 'val': 0},
                    {'label': '15 Seconds', 'val': 15},
                    {'label': '30 Seconds (Default)', 'val': 30},
                    {'label': '60 Seconds', 'val': 60},
                  ].map((item) {
                    final val = item['val'] as int;
                    final label = item['label'] as String;
                    final isSelected = _currentPrefs.refreshInterval == val;
                    return ChoiceChip(
                      label: Text(label),
                      selected: isSelected,
                      onSelected: (selected) {
                        if (selected) {
                          setState(() {
                            _currentPrefs =
                                _currentPrefs.copyWith(refreshInterval: val);
                          });
                        }
                      },
                    );
                  }).toList(),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // 5. System Diagnostics Card
            _buildSectionCard(
              title: 'System Diagnostics',
              icon: Icons.health_and_safety_rounded,
              iconColor: const Color(0xFF0453CD),
              bgColor: const Color(0xFFEFF6FF),
              children: [
                _buildInfoRow('Application Name', AppEnvironment.appName),
                const SizedBox(height: 8),
                _buildInfoRow(
                  'Application Version',
                  'v${AppEnvironment.appVersion}',
                ),
                const SizedBox(height: 8),
                _buildInfoRow(
                  'API Base URL',
                  AppEnvironment.apiBaseUrl,
                  isMonospace: true,
                ),
                const SizedBox(height: 12),
                const Divider(height: 1),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Backend Connectivity',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: state.connectivityStatus == 'Online'
                                    ? AppColors.success
                                    : state.connectivityStatus == 'Unreachable'
                                        ? AppColors.error
                                        : Colors.amber,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              state.connectivityStatus,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: state.connectivityStatus == 'Online'
                                    ? AppColors.success
                                    : state.connectivityStatus == 'Unreachable'
                                        ? AppColors.error
                                        : Colors.amber.shade800,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    OutlinedButton.icon(
                      key: const Key('test_connectivity_button'),
                      onPressed: state.isCheckingConnectivity
                          ? null
                          : () => ref
                              .read(systemPreferencesNotifierProvider.notifier)
                              .testConnectivity(),
                      icon: state.isCheckingConnectivity
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.wifi_find_rounded, size: 16),
                      label: Text(
                        state.isCheckingConnectivity
                            ? 'Checking...'
                            : 'Test Connectivity',
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Actions
            AppButton(
              key: const Key('save_preferences_button'),
              label: 'Save Preferences',
              icon: Icons.save_outlined,
              isLoading: state.isSaving,
              fullWidth: true,
              onPressed: state.isSaving ? null : _handleSave,
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              key: const Key('reset_preferences_button'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: state.isSaving ? null : _handleReset,
              icon: const Icon(Icons.restore_rounded, size: 18),
              label: const Text('Reset to Defaults'),
            ),
            const SizedBox(height: 24),

            const PoweredByTrovo(),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionCard({
    required String title,
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1.2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x04000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 20, color: iconColor),
              ),
              const SizedBox(width: 12),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {bool isMonospace = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: AppColors.textSecondary,
          ),
        ),
        Flexible(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              fontFamily: isMonospace ? 'monospace' : null,
              color: AppColors.textPrimary,
            ),
            textAlign: TextAlign.end,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
