import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:localshop_shared/localshop_shared.dart';
import '../../../app/theme.dart';
import '../../../core/providers.dart';
import '../data/seller_api.dart';
import 'shop_providers.dart';

class StatsScreen extends ConsumerWidget {
  const StatsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(sellerStatsProvider);
    final lang = ref.watch(localeProvider);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('stats.title'))),
      body: statsAsync.when(
        data: (stats) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _StatCard(label: ref.t('stats.today'), period: stats.today, lang: lang, ref: ref),
            const SizedBox(height: 12),
            _StatCard(label: ref.t('stats.thisWeek'), period: stats.thisWeek, lang: lang, ref: ref),
            const SizedBox(height: 12),
            _StatCard(label: ref.t('stats.thisMonth'), period: stats.thisMonth, lang: lang, ref: ref),
          ],
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('$err')),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.period, required this.lang, required this.ref});

  final String label;
  final SellerStatsPeriod period;
  final SupportedLanguage lang;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF64748B))),
          const SizedBox(height: 10),
          Text(formatPrice(period.revenueTiyin, lang), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppTheme.seed)),
          const SizedBox(height: 4),
          Text(ref.t('stats.orders', {'count': '${period.orderCount}'}), style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
        ],
      ),
    );
  }
}
