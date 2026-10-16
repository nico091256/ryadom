import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers.dart';
import '../../auth/presentation/auth_controller.dart';

/// Placeholder orders board — the real New/In-Progress/Completed tabs with
/// loud alerts and the acceptance countdown are the next build step. Exists
/// now so the auth + forced-password-change flow has somewhere to land and
/// can be verified end to end on its own.
class OrdersBoardScreen extends ConsumerWidget {
  const OrdersBoardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).value;
    return Scaffold(
      appBar: AppBar(title: Text(ref.t('common.appName'))),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('👋 ${user?.name ?? user?.login ?? ''}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: () => ref.read(authControllerProvider.notifier).logout(),
              child: Text(ref.t('common.logout')),
            ),
          ],
        ),
      ),
    );
  }
}
