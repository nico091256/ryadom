import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/providers.dart';
import '../../../ui/ui.dart';
import 'auth_controller.dart';
import 'widgets/auth_page.dart';
import 'widgets/phone_field.dart';
import 'widgets/uz_phone.dart';

class PhoneScreen extends ConsumerStatefulWidget {
  const PhoneScreen({super.key});

  @override
  ConsumerState<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends ConsumerState<PhoneScreen> {
  /// Holds only the grouped national digits ("90 123 45 67"); "+998" is a fixed prefix.
  final _controller = TextEditingController();
  bool _loading = false;

  static final _fullPhone = RegExp(r'^\+998\d{9}$');

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String get _phone => '+998${uzNationalDigits(_controller.text)}';

  bool get _isValid => _fullPhone.hasMatch(_phone);

  Future<void> _submit() async {
    final phone = _phone;
    if (!_fullPhone.hasMatch(phone)) {
      showAppToast(context, ref.t('auth.invalidPhone'), tone: ToastTone.error);
      return;
    }

    setState(() => _loading = true);
    try {
      await ref.read(authControllerProvider.notifier).sendCode(phone);
      if (!mounted) return;
      context.go('/auth/otp?phone=${Uri.encodeComponent(phone)}');
    } on AppException catch (e) {
      if (!mounted) return;
      showAppToast(context, e.message.isNotEmpty ? e.message : ref.t('auth.sendCodeFailed'), tone: ToastTone.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // The stock placeholder is "+998 90 123 45 67"; the prefix now lives in the chip.
    final hint = ref.t('auth.phonePlaceholder').replaceFirst(RegExp(r'^\+?998\s*'), '');

    return AuthPage(
      title: ref.t('auth.phoneTitle'),
      subtitle: ref.t('auth.phoneSubtitle'),
      onBack: () => context.go('/welcome'),
      bottom: AppButton(
        label: ref.t('auth.sendCode'),
        loading: _loading,
        onPressed: _isValid ? _submit : null,
      ),
      child: PhoneField(
        controller: _controller,
        hint: hint,
        helper: ref.t('auth.phoneHelper'),
        autofocus: true,
        enabled: !_loading,
        onChanged: (_) => setState(() {}),
        onSubmitted: (_) => _submit(),
      ),
    );
  }
}
