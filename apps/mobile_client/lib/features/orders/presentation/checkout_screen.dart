import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:localshop_shared/localshop_shared.dart';
import '../../../app/theme.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/providers.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../cart/presentation/cart_controller.dart';
import '../../location/presentation/address_controller.dart';
import '../data/orders_api.dart';
import 'orders_providers.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  late final TextEditingController _phoneController;
  final _entranceController = TextEditingController();
  final _floorController = TextEditingController();
  final _apartmentController = TextEditingController();
  final _doorCodeController = TextEditingController();
  final _commentController = TextEditingController();
  final _promoCodeController = TextEditingController();

  String _changeFrom = 'exact';
  bool _placing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authControllerProvider).value;
    _phoneController = TextEditingController(text: user?.phone ?? '');
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _entranceController.dispose();
    _floorController.dispose();
    _apartmentController.dispose();
    _doorCodeController.dispose();
    _commentController.dispose();
    _promoCodeController.dispose();
    super.dispose();
  }

  Future<void> _placeOrder() async {
    final address = ref.read(addressControllerProvider);

    if (_phoneController.text.trim().isEmpty) {
      setState(() => _error = ref.t('checkout.errorPhone'));
      return;
    }

    setState(() {
      _placing = true;
      _error = null;
    });

    try {
      final parts = <String>[];
      if (_entranceController.text.isNotEmpty) parts.add("Podyezd: ${_entranceController.text}");
      if (_floorController.text.isNotEmpty) parts.add("Qavat: ${_floorController.text}");
      if (_apartmentController.text.isNotEmpty) parts.add("Xonadon: ${_apartmentController.text}");
      if (_doorCodeController.text.isNotEmpty) parts.add("Domofon: ${_doorCodeController.text}");
      final fullAddress = parts.isEmpty ? address.addressText : '${address.addressText} (${parts.join(', ')})';

      var comment = _commentController.text.trim();
      final changeNote = _changeFrom == 'exact' ? "Qaytim kerak emas" : "Qaytim: $_changeFrom so'mdan";
      comment = comment.isEmpty ? changeNote : '$comment | $changeNote';

      final promo = _promoCodeController.text.trim();
      final order = await ref.read(ordersApiProvider).createOrder(CreateOrderPayload(
            addressText: fullAddress,
            lat: address.lat,
            lng: address.lng,
            customerPhone: _phoneController.text.trim(),
            paymentMethod: PaymentMethod.cash.value,
            comment: comment,
            promoCode: promo.isNotEmpty ? promo : null,
          ));

      ref.read(cartControllerProvider.notifier).clear();
      if (!mounted) return;
      context.go('/order/${order.id}');
    } on AppException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartControllerProvider);
    final address = ref.watch(addressControllerProvider);
    final lang = ref.watch(localeProvider);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('checkout.title'))),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _SectionCard(
              title: ref.t('checkout.deliveryAddress'),
              icon: Icons.location_on,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(address.addressText, style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(child: TextField(controller: _entranceController, decoration: InputDecoration(labelText: ref.t('address.entrance')))),
                      const SizedBox(width: 8),
                      Expanded(child: TextField(controller: _floorController, decoration: InputDecoration(labelText: ref.t('address.floor')))),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(child: TextField(controller: _apartmentController, decoration: InputDecoration(labelText: ref.t('address.apartment')))),
                      const SizedBox(width: 8),
                      Expanded(child: TextField(controller: _doorCodeController, decoration: InputDecoration(labelText: ref.t('address.doorCode')))),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            _SectionCard(
              title: ref.t('checkout.contactPhone'),
              icon: Icons.phone,
              child: TextField(controller: _phoneController, keyboardType: TextInputType.phone),
            ),
            const SizedBox(height: 12),
            _SectionCard(
              title: ref.t('checkout.paymentMethod'),
              icon: Icons.payments,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: AppTheme.seed.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
                    child: Row(
                      children: [
                        const Icon(Icons.money, color: AppTheme.seed),
                        const SizedBox(width: 10),
                        Expanded(child: Text(ref.t('checkout.cashOnDelivery'), style: const TextStyle(fontWeight: FontWeight.w700))),
                        const Icon(Icons.check_circle, color: AppTheme.seed),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(ref.t('checkout.changeQuestion'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    children: [
                      _ChangeChip(label: ref.t('checkout.changeExact'), value: 'exact', selected: _changeFrom, onSelect: (v) => setState(() => _changeFrom = v)),
                      _ChangeChip(label: "50 000", value: '50 000', selected: _changeFrom, onSelect: (v) => setState(() => _changeFrom = v)),
                      _ChangeChip(label: "100 000", value: '100 000', selected: _changeFrom, onSelect: (v) => setState(() => _changeFrom = v)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            _SectionCard(
              title: ref.t('checkout.promoCode'),
              icon: Icons.local_offer_outlined,
              child: TextField(
                controller: _promoCodeController,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  hintText: ref.t('checkout.promoCodePlaceholder'),
                  prefixIcon: const Icon(Icons.confirmation_number_outlined),
                ),
              ),
            ),
            const SizedBox(height: 12),
            _SectionCard(
              title: ref.t('checkout.commentTitle'),
              icon: Icons.message,
              child: TextField(
                controller: _commentController,
                maxLines: 3,
                decoration: InputDecoration(hintText: ref.t('checkout.commentPlaceholder')),
              ),
            ),
            const SizedBox(height: 12),
            _SectionCard(
              title: ref.t('checkout.summaryTitle'),
              icon: Icons.receipt_long,
              child: Column(
                children: [
                  _SummaryRow(label: ref.t('checkout.summaryItems', {'count': '${cart.itemCount}'}), value: formatPrice(cart.totalAmount, lang)),
                  _SummaryRow(label: ref.t('checkout.summaryDelivery'), value: formatPrice(0, lang), valueColor: AppTheme.seed),
                  const Divider(),
                  _SummaryRow(
                    label: ref.t('cart.total'),
                    value: formatPrice(cart.totalAmount, lang),
                    bold: true,
                  ),
                ],
              ),
            ),
            if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: const TextStyle(color: Colors.red))),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: ElevatedButton(
            onPressed: _placing ? null : _placeOrder,
            child: _placing
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(ref.t('checkout.placeOrder')),
                      Text(formatPrice(cart.totalAmount, lang)),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.icon, required this.child});
  final String title;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [Icon(icon, size: 18, color: AppTheme.seed), const SizedBox(width: 8), Text(title, style: const TextStyle(fontWeight: FontWeight.w800))]),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

class _ChangeChip extends StatelessWidget {
  const _ChangeChip({required this.label, required this.value, required this.selected, required this.onSelect});
  final String label;
  final String value;
  final String selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final isSelected = selected == value;
    return ChoiceChip(
      label: Text(label, style: const TextStyle(fontSize: 12)),
      selected: isSelected,
      selectedColor: AppTheme.seed,
      labelStyle: TextStyle(color: isSelected ? Colors.white : const Color(0xFF334155), fontWeight: FontWeight.w700),
      onSelected: (_) => onSelect(value),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value, this.bold = false, this.valueColor});
  final String label;
  final String value;
  final bool bold;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: bold ? 15 : 13, fontWeight: bold ? FontWeight.w800 : FontWeight.normal, color: const Color(0xFF64748B))),
          Text(value, style: TextStyle(fontSize: bold ? 17 : 13, fontWeight: FontWeight.w800, color: valueColor ?? const Color(0xFF0F172A))),
        ],
      ),
    );
  }
}
