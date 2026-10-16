import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/providers.dart';
import '../../../ui/ui.dart';
import 'auth_controller.dart';
import 'widgets/auth_page.dart';

class NameScreen extends ConsumerStatefulWidget {
  const NameScreen({super.key});

  @override
  ConsumerState<NameScreen> createState() => _NameScreenState();
}

class _NameScreenState extends ConsumerState<NameScreen> {
  final _controller = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _isValid => _controller.text.trim().isNotEmpty;

  Future<void> _submit() async {
    final name = _controller.text.trim();
    if (name.isEmpty) return;
    setState(() => _loading = true);
    try {
      await ref.read(authControllerProvider.notifier).saveName(name);
      // Router redirect takes over once auth state has a named user.
    } on AppException catch (e) {
      if (!mounted) return;
      showAppToast(context, e.message.isNotEmpty ? e.message : ref.t('common.error'), tone: ToastTone.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthPage(
      title: ref.t('auth.namePrompt'),
      subtitle: ref.t('auth.nameSubtitle'),
      bottom: AppButton(
        label: ref.t('auth.saveName'),
        loading: _loading,
        onPressed: _isValid ? _submit : null,
      ),
      child: AppTextField(
        controller: _controller,
        icon: LucideIcons.user,
        hint: ref.t('auth.namePlaceholder'),
        autofocus: true,
        enabled: !_loading,
        textCapitalization: TextCapitalization.words,
        textInputAction: TextInputAction.done,
        keyboardType: TextInputType.name,
        maxLength: 60,
        showClear: true,
        onChanged: (_) => setState(() {}),
        onSubmitted: (_) => _submit(),
      ),
    );
  }
}
