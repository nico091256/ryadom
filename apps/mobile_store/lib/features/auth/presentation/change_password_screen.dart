import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app/theme.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/providers.dart';
import 'auth_controller.dart';

class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_newController.text.length < 6) {
      setState(() => _error = ref.t('changePassword.tooShort'));
      return;
    }
    if (_newController.text != _confirmController.text) {
      setState(() => _error = ref.t('changePassword.mismatch'));
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await ref.read(authControllerProvider.notifier).changePassword(_currentController.text, _newController.text);
      // Router redirect takes over once mustChangePassword is false.
    } on AppException catch (e) {
      setState(() => _error = e.message.isNotEmpty ? e.message : ref.t('changePassword.failed'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.lock_reset, color: AppTheme.seed, size: 48),
                const SizedBox(height: 16),
                Text(ref.t('changePassword.title'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
                const SizedBox(height: 8),
                Text(ref.t('changePassword.subtitle'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
                const SizedBox(height: 20),
                TextField(controller: _currentController, obscureText: true, decoration: InputDecoration(labelText: ref.t('changePassword.currentLabel'))),
                const SizedBox(height: 12),
                TextField(controller: _newController, obscureText: true, decoration: InputDecoration(labelText: ref.t('changePassword.newLabel'))),
                const SizedBox(height: 12),
                TextField(
                  controller: _confirmController,
                  obscureText: true,
                  decoration: InputDecoration(labelText: ref.t('changePassword.confirmLabel'), errorText: _error),
                  onSubmitted: (_) => _submit(),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(ref.t('changePassword.submit')),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
