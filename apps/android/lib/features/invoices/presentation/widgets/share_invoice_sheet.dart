import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_confirm_dialog.dart';
import '../../data/invoice_repository.dart';
import '../../models/invoice_public_link.dart';

/// Gives the customer a link, and a QR code to scan, for a read-only copy of their invoice.
class ShareInvoiceSheet extends ConsumerStatefulWidget {
  final String invoiceId;
  final String? invoiceNumber;

  const ShareInvoiceSheet({
    super.key,
    required this.invoiceId,
    this.invoiceNumber,
  });

  static Future<void> show(
    BuildContext context, {
    required String invoiceId,
    String? invoiceNumber,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) =>
          ShareInvoiceSheet(invoiceId: invoiceId, invoiceNumber: invoiceNumber),
    );
  }

  @override
  ConsumerState<ShareInvoiceSheet> createState() => _ShareInvoiceSheetState();
}

class _ShareInvoiceSheetState extends ConsumerState<ShareInvoiceSheet> {
  bool _loading = true;
  bool _working = false;
  bool _copied = false;
  String? _error;
  String? _notice;
  String? _url;
  InvoicePublicLinkStatus? _status;

  InvoiceRepository get _repo => ref.read(invoiceRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _message(Object e) =>
      e is ApiException ? e.message : 'Something went wrong. Please try again.';

  Future<void> _load() async {
    try {
      var status = await _repo.getPublicLinkStatus(widget.invoiceId);
      String? url;
      String? notice;
      if (!status.hasActiveLink) {
        // Like Windows, make the first link straight away.
        final made = await _repo.createPublicLink(widget.invoiceId);
        url = made.url;
        status = InvoicePublicLinkStatus(
          hasActiveLink: true,
          createdAt: made.createdAt,
        );
        notice = 'Public invoice link created.';
      }
      if (!mounted) return;
      setState(() {
        _status = status;
        _url = url;
        _notice = notice;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = _message(e);
        _loading = false;
      });
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _working = true;
      _error = null;
      _notice = null;
    });
    try {
      await action();
    } catch (e) {
      if (mounted) setState(() => _error = _message(e));
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _newLink() async {
    final ok = await AppConfirmDialog.show(
      context: context,
      title: 'Make a new link?',
      message:
          'The link the customer has now will stop working. Anyone you sent it to will need the new one.',
      confirmLabel: 'Make new link',
    );
    if (ok != true) return;
    await _run(() async {
      final made = await _repo.rotatePublicLink(widget.invoiceId);
      if (!mounted) return;
      setState(() {
        _url = made.url;
        _status = InvoicePublicLinkStatus(
          hasActiveLink: true,
          createdAt: made.createdAt,
        );
        _notice = 'New link made. The earlier link no longer works.';
        _copied = false;
      });
    });
  }

  Future<void> _revoke() async {
    final ok = await AppConfirmDialog.show(
      context: context,
      title: 'Stop sharing this invoice?',
      message: 'The customer link will stop working at once.',
      confirmLabel: 'Stop sharing',
      isDestructive: true,
    );
    if (ok != true) return;
    await _run(() async {
      await _repo.revokePublicLink(widget.invoiceId);
      if (!mounted) return;
      setState(() {
        _url = null;
        _status = const InvoicePublicLinkStatus(hasActiveLink: false);
        _notice = 'Sharing stopped. The link no longer works.';
      });
    });
  }

  Future<void> _makeFirstLink() => _run(() async {
    final made = await _repo.createPublicLink(widget.invoiceId);
    if (!mounted) return;
    setState(() {
      _url = made.url;
      _status = InvoicePublicLinkStatus(
        hasActiveLink: true,
        createdAt: made.createdAt,
      );
      _notice = 'Public invoice link created.';
    });
  });

  Future<void> _copy() async {
    final url = _url;
    if (url == null) return;
    await Clipboard.setData(ClipboardData(text: url));
    if (!mounted) return;
    setState(() => _copied = true);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        16,
        16,
        16,
        16 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Share invoice', style: AppTextStyles.headingMedium),
            Text(
              '${widget.invoiceNumber ?? 'Invoice'} · read-only link for the customer',
              style: AppTextStyles.caption.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 12),
            if (_notice != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  _notice!,
                  key: const Key('share_invoice_notice'),
                  style: AppTextStyles.bodySmall.copyWith(
                    color: AppColors.success,
                  ),
                ),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  _error!,
                  key: const Key('share_invoice_error'),
                  style: AppTextStyles.bodySmall.copyWith(
                    color: AppColors.error,
                  ),
                ),
              ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: CircularProgressIndicator()),
              )
            else
              ..._body(),
          ],
        ),
      ),
    );
  }

  List<Widget> _body() {
    final status = _status;
    final url = _url;

    if (url != null) {
      return [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(8),
          ),
          child: SelectableText(
            url,
            key: const Key('share_invoice_url'),
            style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
          ),
        ),
        const SizedBox(height: 8),
        AppButton(
          key: const Key('share_invoice_copy'),
          label: _copied ? 'Copied' : 'Copy link',
          icon: _copied ? Icons.check_rounded : Icons.copy_rounded,
          variant: AppButtonVariant.secondary,
          fullWidth: true,
          onPressed: _copy,
        ),
        const SizedBox(height: 14),
        Center(
          child: Container(
            key: const Key('share_invoice_qr'),
            color: Colors.white,
            padding: const EdgeInsets.all(8),
            child: QrImageView(data: url, size: 180),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'The customer can scan this with their phone camera to see and download the invoice.',
          textAlign: TextAlign.center,
          style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
        ),
        ..._usage(status),
        const SizedBox(height: 12),
        ..._manageButtons(),
      ];
    }

    if (status != null && status.hasActiveLink) {
      return [
        Text(
          'A public link is already active for this invoice.',
          style: AppTextStyles.bodyMedium,
        ),
        const SizedBox(height: 4),
        Text(
          'For security the link itself cannot be shown again. Make a new link to copy it or show the QR code; the earlier link then stops working.',
          style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
        ),
        ..._usage(status),
        const SizedBox(height: 12),
        ..._manageButtons(),
      ];
    }

    return [
      Text(
        'This invoice is not shared at the moment.',
        key: const Key('share_invoice_not_shared'),
        style: AppTextStyles.bodyMedium,
      ),
      const SizedBox(height: 12),
      AppButton(
        key: const Key('share_invoice_make'),
        label: 'Create link',
        icon: Icons.link_rounded,
        fullWidth: true,
        isLoading: _working,
        onPressed: _makeFirstLink,
      ),
    ];
  }

  List<Widget> _usage(InvoicePublicLinkStatus? status) {
    if (status == null) return const [];
    return [
      const SizedBox(height: 8),
      Text(
        'Opened ${status.accessCount} ${status.accessCount == 1 ? 'time' : 'times'}',
        key: const Key('share_invoice_access_count'),
        textAlign: TextAlign.center,
        style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
      ),
    ];
  }

  List<Widget> _manageButtons() => [
    AppButton(
      key: const Key('share_invoice_new_link'),
      label: _url == null ? 'Make a new link' : 'Replace with a new link',
      icon: Icons.refresh_rounded,
      variant: AppButtonVariant.secondary,
      fullWidth: true,
      isLoading: _working,
      onPressed: _working ? null : _newLink,
    ),
    const SizedBox(height: 8),
    AppButton(
      key: const Key('share_invoice_revoke'),
      label: 'Stop sharing',
      icon: Icons.block_rounded,
      variant: AppButtonVariant.secondary,
      fullWidth: true,
      onPressed: _working ? null : _revoke,
    ),
  ];
}
