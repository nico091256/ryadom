import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/app_exception.dart';
import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../../auth/presentation/auth_controller.dart';
import 'profile_header.dart';

/// Max length the backend accepts for `name` (UpdateProfileDto).
const int _kNameMaxLength = 120;

/// "Profilni tahrirlash": edit the display name. The phone is the login
/// identity (OTP-verified), so it is shown read-only.
Future<void> showEditProfileSheet(BuildContext context, WidgetRef ref) {
  return showAppSheet<void>(
    context,
    title: ref.t('profile.editProfile'),
    builder: (_) => const _EditProfileSheet(),
  );
}

class _EditProfileSheet extends ConsumerStatefulWidget {
  const _EditProfileSheet();

  @override
  ConsumerState<_EditProfileSheet> createState() => _EditProfileSheetState();
}

class _EditProfileSheetState extends ConsumerState<_EditProfileSheet> {
  late final TextEditingController _name;
  late final TextEditingController _phone;
  late final String _initialName;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authControllerProvider).valueOrNull;
    _initialName = (user?.name ?? '').trim();
    _name = TextEditingController(text: _initialName);
    final phone = user?.phone ?? '';
    _phone = TextEditingController(text: phone.isEmpty ? '' : formatPhoneForDisplay(phone));
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  bool get _canSave {
    final value = _name.text.trim();
    return !_saving && value.isNotEmpty && value != _initialName;
  }

  Future<void> _save() async {
    if (!_canSave) return;
    setState(() => _saving = true);
    try {
      await ref.read(authControllerProvider.notifier).saveName(_name.text.trim());
      if (!mounted) return;
      Navigator.of(context).pop();
      showAppToast(context, ref.t('profile.saved'), tone: ToastTone.success);
    } on AppException catch (e) {
      if (!mounted) return;
      showAppToast(context, ref.errorText(e), tone: ToastTone.error);
      setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final empty = _name.text.trim().isEmpty;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(
          controller: _name,
          label: ref.t('profile.nameLabel'),
          hint: ref.t('auth.namePlaceholder'),
          icon: LucideIcons.user,
          error: empty ? ref.t('profile.nameRequired') : null,
          enabled: !_saving,
          autofocus: true,
          showClear: true,
          maxLength: _kNameMaxLength,
          keyboardType: TextInputType.name,
          textCapitalization: TextCapitalization.words,
          textInputAction: TextInputAction.done,
          onChanged: (_) => setState(() {}),
          onSubmitted: (_) => _save(),
        ),
        if (_phone.text.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          AppTextField(
            controller: _phone,
            label: ref.t('profile.phoneLabel'),
            helper: ref.t('profile.phoneLocked'),
            icon: LucideIcons.phone,
            suffix: const Icon(LucideIcons.lock, size: 16, color: AppColors.ink300),
            enabled: false,
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
        AppButton(
          label: ref.t('common.save'),
          icon: LucideIcons.check,
          loading: _saving,
          onPressed: _canSave ? _save : null,
        ),
      ],
    );
  }
}
