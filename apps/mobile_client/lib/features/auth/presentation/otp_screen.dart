import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/providers.dart';
import 'auth_controller.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.phone});

  final String phone;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _controller = TextEditingController();
  bool _loading = false;
  String? _error;
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
      _startTimer();
    } on AppException catch (e) {
      setState(() => _error = e.message);
    }
  }

  Future<void> _submit() async {
    if (_controller.text.length != 6) return;
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
      setState(() => _error = e.message.isNotEmpty ? e.message : ref.t('auth.verifyFailed'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(ref.t('auth.smsTitle'), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
              const SizedBox(height: 8),
              Text(
                ref.t('auth.smsSubtitle', {'phone': widget.phone}),
                style: const TextStyle(fontSize: 14, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _controller,
                keyboardType: TextInputType.number,
                autofocus: true,
                maxLength: 6,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: 8),
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(counterText: '', errorText: _error),
                onChanged: (v) {
                  if (v.length == 6) _submit();
                },
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(ref.t('auth.verify')),
                ),
              ),
              const SizedBox(height: 16),
              Center(
                child: TextButton(
                  onPressed: _secondsLeft > 0 ? null : _resend,
                  child: Text(
                    _secondsLeft > 0 ? ref.t('auth.resendIn', {'seconds': '$_secondsLeft'}) : ref.t('auth.resendCode'),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
