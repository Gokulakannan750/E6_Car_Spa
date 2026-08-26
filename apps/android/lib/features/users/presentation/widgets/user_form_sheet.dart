import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_modal_header.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../models/create_user_request.dart';
import '../../models/permission_model.dart';
import '../../models/update_user_request.dart';
import '../../models/user_model.dart';
import '../../providers/users_provider.dart';
import '../../providers/users_state.dart';
import 'permission_selector.dart';

class UserFormSheet extends ConsumerStatefulWidget {
  final UserModel? user; // Null if create mode
  final List<PermissionGroupModel> permissionGroups;

  const UserFormSheet({
    super.key,
    this.user,
    required this.permissionGroups,
  });

  static Future<bool?> show(
    BuildContext context, {
    UserModel? user,
    required List<PermissionGroupModel> permissionGroups,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => UserFormSheet(
        user: user,
        permissionGroups: permissionGroups,
      ),
    );
  }

  @override
  ConsumerState<UserFormSheet> createState() => _UserFormSheetState();
}

class _UserFormSheetState extends ConsumerState<UserFormSheet> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _nameController;
  late final TextEditingController _usernameController;
  late final TextEditingController _emailController;
  late final TextEditingController _passwordController;
  late final TextEditingController _confirmPasswordController;

  late String _role;
  late List<String> _selectedPermissions;

  bool _isSubmitting = false;
  String? _errorMessage;

  bool get _isEdit => widget.user != null;
  bool get _isOwner => widget.user?.isOwner ?? false;

  @override
  void initState() {
    super.initState();
    final u = widget.user;
    _nameController = TextEditingController(text: u?.fullName ?? '');
    _usernameController = TextEditingController(text: u?.username ?? '');
    _emailController = TextEditingController(text: u?.email ?? '');
    _passwordController = TextEditingController();
    _confirmPasswordController = TextEditingController();

    _role = u?.role ?? 'Manager';
    if (_role.toLowerCase() != 'manager' && _role.toLowerCase() != 'staff') {
      _role = _isOwner ? 'Owner' : 'Manager';
    }

    _selectedPermissions = List<String>.from(u?.permissions ?? []);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _usernameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    setState(() {
      _errorMessage = null;
    });

    if (!_formKey.currentState!.validate()) {
      return;
    }

    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;
    final username = _usernameController.text.trim().toLowerCase();

    if (!_isEdit && password.isEmpty) {
      setState(() {
        _errorMessage = 'Password is required for new accounts.';
      });
      return;
    }

    if (password.isNotEmpty) {
      if (password.length < 8) {
        setState(() {
          _errorMessage = 'Password must be at least 8 characters long.';
        });
        return;
      }
      if (password != confirmPassword) {
        setState(() {
          _errorMessage = 'Password and confirmation password do not match.';
        });
        return;
      }
      if (username.isNotEmpty && password.toLowerCase() == username) {
        setState(() {
          _errorMessage = 'Password cannot be the same as the username.';
        });
        return;
      }
    }

    setState(() {
      _isSubmitting = true;
    });

    bool success = false;
    final notifier = ref.read(usersNotifierProvider.notifier);

    if (_isEdit) {
      final request = UpdateUserRequest(
        fullName: _nameController.text.trim(),
        email: _emailController.text.trim().isEmpty
            ? null
            : _emailController.text.trim(),
        password: password.isNotEmpty ? password : null,
        confirmPassword: confirmPassword.isNotEmpty ? confirmPassword : null,
        role: _isOwner ? 'Owner' : _role,
        permissionCodes: _isOwner ? null : _selectedPermissions,
      );

      success = await notifier.updateUser(widget.user!.id, request);
    } else {
      final request = CreateUserRequest(
        fullName: _nameController.text.trim(),
        username: username,
        email: _emailController.text.trim().isEmpty
            ? null
            : _emailController.text.trim(),
        password: password,
        confirmPassword: confirmPassword,
        role: _role,
        permissionCodes: _selectedPermissions,
      );

      success = await notifier.createUser(request);
    }

    if (mounted) {
      setState(() {
        _isSubmitting = false;
      });

      if (success) {
        Navigator.pop(context, true);
      } else {
        // Extract error message from state
        final currentState = ref.read(usersNotifierProvider);
        if (currentState is UsersLoaded &&
            currentState.mutationErrorMessage != null) {
          setState(() {
            _errorMessage = currentState.mutationErrorMessage;
          });
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            child: AppModalHeader(
              title: _isEdit
                  ? (_isOwner
                      ? 'Edit Owner Account'
                      : 'Edit User: ${widget.user?.fullName}')
                  : 'Add New User',
              subtitle: _isEdit
                  ? 'Update profile and module permissions'
                  : 'Create a Manager or Staff account and assign permissions',
              icon: _isEdit ? Icons.manage_accounts_rounded : Icons.person_add_rounded,
              iconBgColor: AppColors.primaryContainer,
              iconColor: AppColors.textOnPrimary,
              showDragHandle: true,
            ),
          ),

          // Scrollable Form Body
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottomInset),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Error Notice
                    if (_errorMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.errorLight,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                              color: AppColors.error.withAlpha(60)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded,
                                color: AppColors.error, size: 18),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _errorMessage!,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.error,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Owner Access Banner (if Owner)
                    if (_isOwner) ...[
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF3E8FF),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE9D5FF)),
                        ),
                        child: const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(Icons.shield_rounded,
                                    color: Color(0xFF7C3AED), size: 20),
                                SizedBox(width: 8),
                                Text(
                                  'OWNER ACCESS',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF6B21A8),
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                            SizedBox(height: 8),
                            Text(
                              '• Full access to all current and future modules\n• Role and permissions cannot be restricted\n• Protected against deactivation and deletion',
                              style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF581C87),
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Full Name
                    AppTextField(
                      controller: _nameController,
                      label: 'Full Name *',
                      hintText: 'e.g. Ramesh Kumar',
                      prefixIcon: const Icon(Icons.person_outline_rounded, size: 20),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Full name is required';
                        }
                        if (val.trim().length > 150) {
                          return 'Full name cannot exceed 150 characters';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Username
                    AppTextField(
                      controller: _usernameController,
                      label: _isEdit ? 'Username (Immutable)' : 'Username *',
                      hintText: 'e.g. ramesh',
                      isEnabled: !_isEdit,
                      prefixIcon: const Icon(Icons.alternate_email_rounded, size: 20),
                      validator: (val) {
                        if (!_isEdit) {
                          if (val == null || val.trim().isEmpty) {
                            return 'Username is required';
                          }
                          if (val.trim().length > 50) {
                            return 'Username cannot exceed 50 characters';
                          }
                          if (val.contains(' ')) {
                            return 'Username cannot contain spaces';
                          }
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Email Address
                    AppTextField(
                      controller: _emailController,
                      label: 'Email Address (Optional)',
                      hintText: 'user@e6carspa.com',
                      keyboardType: TextInputType.emailAddress,
                      prefixIcon: const Icon(Icons.email_outlined, size: 20),
                      validator: (val) {
                        if (val != null && val.trim().isNotEmpty) {
                          final emailRegex =
                              RegExp(r'^[\w\.-]+@([\w-]+\.)+[\w-]{2,4}$');
                          if (!emailRegex.hasMatch(val.trim())) {
                            return 'Enter a valid email address';
                          }
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Role Selector (Hidden for Owner)
                    if (!_isOwner) ...[
                      const Text(
                        'ROLE *',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _role,
                            isExpanded: true,
                            icon: const Icon(Icons.arrow_drop_down_rounded,
                                color: AppColors.textSecondary),
                            items: const [
                              DropdownMenuItem(
                                value: 'Manager',
                                child: Text('Manager',
                                    style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600)),
                              ),
                              DropdownMenuItem(
                                value: 'Staff',
                                child: Text('Staff',
                                    style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600)),
                              ),
                            ],
                            onChanged: (newRole) {
                              if (newRole != null) {
                                setState(() {
                                  _role = newRole;
                                });
                              }
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],

                    // Password Section
                    const Divider(color: AppColors.border),
                    const SizedBox(height: 8),
                    Text(
                      _isEdit
                          ? 'CHANGE PASSWORD (OPTIONAL)'
                          : 'SET PASSWORD *',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _isEdit
                          ? 'Leave blank to retain current password'
                          : 'Must be at least 8 characters long',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 12),

                    AppTextField(
                      controller: _passwordController,
                      label: _isEdit ? 'New Password' : 'Password *',
                      hintText: 'Min 8 characters',
                      isPassword: true,
                      prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                      validator: (val) {
                        if (!_isEdit && (val == null || val.isEmpty)) {
                          return 'Password is required';
                        }
                        if (val != null && val.isNotEmpty && val.length < 8) {
                          return 'Password must be at least 8 characters';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    AppTextField(
                      controller: _confirmPasswordController,
                      label: _isEdit
                          ? 'Confirm New Password'
                          : 'Confirm Password *',
                      hintText: 'Re-enter password',
                      isPassword: true,
                      prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                      validator: (val) {
                        if (_passwordController.text.isNotEmpty) {
                          if (val == null || val.isEmpty) {
                            return 'Please confirm the password';
                          }
                          if (val != _passwordController.text) {
                            return 'Passwords do not match';
                          }
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 20),

                    // Permissions Section (Hidden for Owner)
                    if (!_isOwner) ...[
                      const Divider(color: AppColors.border),
                      const SizedBox(height: 8),
                      const Text(
                        'ASSIGNED MODULE PERMISSIONS',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Select granular permissions granted to this user',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 12),

                      PermissionSelector(
                        groups: widget.permissionGroups,
                        selected: _selectedPermissions,
                        onChange: (newPerms) {
                          setState(() {
                            _selectedPermissions = newPerms;
                          });
                        },
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Action Buttons
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _isSubmitting
                                ? null
                                : () => Navigator.pop(context),
                            style: OutlinedButton.styleFrom(
                              padding:
                                  const EdgeInsets.symmetric(vertical: 14),
                              side: const BorderSide(color: AppColors.border),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text(
                              'Cancel',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: AppButton(
                            label: _isEdit ? 'Save Changes' : 'Create User',
                            isLoading: _isSubmitting,
                            icon: _isEdit
                                ? Icons.save_rounded
                                : Icons.person_add_rounded,
                            onPressed: _isSubmitting ? null : _handleSubmit,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
