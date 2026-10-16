import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/providers.dart';
import '../../../ui/ui.dart';
import 'auth_controller.dart';
import 'widgets/auth_page.dart';
import 'widgets/otp_code_field.dart';
import 'widgets/uz_phone.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.phone});

  final String phone;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  static const _codeLength = 6;

  final _controller = TextEditingController();
  bool _loading = false;
  String? _error;
  int _shakeTick = 0;
  int _secondsLeft = 60;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _secondsLeft = 60;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsLeft <= 1) {
        timer.cancel();
        setState(() => _secondsLeft = 0);
      } else {
        setState(() => _secondsLeft--);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _resend() async {
    if (_secondsLeft > 0) return;
    try {
      await ref.read(authControllerProvider.notifier).sendCode(widget.phone);
      if (!mounted) return;
      _controller.clear();
      setState(() {
        _error = null;
        _startTimer();
      });
    } on AppException catch (e) {
      if (!mounted) return;
      showAppToast(context, e.message.isNotEmpty ? e.message : ref.t('auth.sendCodeFailed'), tone: ToastTone.error);
    }
  }

  Future<void> _submit() async {
    if (_controller.text.length != _codeLength || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final isNewUser = await ref.read(authControllerProvider.notifier).verifyCode(widget.phone, _controller.text);
      if (!mounted) return;
      if (isNewUser) context.go('/auth/name');
      // Otherwise the router's redirect takes over once auth state updates.
    } on AppException catch (e) {
      if (!mounted) return;
      _controller.clear();
      setState(() {
        _error = e.message.isNotEmpty ? e.message : ref.t('auth.verifyFailed');
        _shakeTick++;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final complete = _controller.text.length == _codeLength;

    return AuthPage(
      title: ref.t('auth.smsTitle'),
      subtitle: ref.t('auth.smsSubtitle', {'phone': formatUzPhone(widget.phone)}),
      onBack: () => context.go('/auth/phone'),
      bottom: AppButton(
        label: ref.t('auth.verify'),
        loading: _loading,
        onPressed: complete ? _submit : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          OtpCodeField(
            controller: _controller,
            length: _codeLength,
            enabled: !_loading,
            hasError: _error != null,
            shakeTick: _shakeTick,
            onChanged: (_) => setState(() => _error = null),
            onCompleted: (_) => _submit(),
          ),
          AnimatedSize(
            duration: AppDurations.normal,
            curve: AppCurves.standard,
            alignment: Alignment.topLeft,
            child: _error == null
                ? const SizedBox(width: double.infinity)
                : Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.md, left: AppSpacing.xs),
                    child: Row(
                      children: [
                        const Icon(LucideIcons.alertCircle, size: 14, color: AppColors.danger),
                        const SizedBox(width: 6),
                        Expanded(child: Text(_error!, style: AppText.caption.danger)),
                      ],
                    ),
                  ),
          ),
          const SizedBox(height: AppSpacing.xxl),
          Center(child: _ResendRow(secondsLeft: _secondsLeft, onResend: _resend)),
        ],
      ),
    );
  }
}

class _ResendRow extends ConsumerWidget {
  const _ResendRow({required this.secondsLeft, required this.onResend});

  final int secondsLeft;
  final VoidCallback onResend;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (secondsLeft > 0) {
      final m = (secondsLeft ~/ 60).toString().padLeft(2, '0');
      final s = (secondsLeft % 60).toString().padLeft(2, '0');
      return Text(
        ref.t('auth.resendIn', {'time': '$m:$s'}),
        style: AppText.izoh.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
      );
    }
    return Pressable(
      onTap: onResend,
      haptic: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.refreshCw, size: 16, color: AppColors.brand),
            const SizedBox(width: AppSpacing.sm),
            Text(ref.t('auth.resendCode'), style: AppText.bodyStrong.brand),
          ],
        ),
      ),
    ).animate().fadeIn(duration: AppDurations.normal);
  }
}
