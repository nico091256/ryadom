import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:localshop_shared/localshop_shared.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/providers.dart';
import '../../../ui/ui.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../auth/presentation/widgets/uz_phone.dart';
import '../../cart/data/cart_api.dart';
import '../../cart/presentation/cart_controller.dart';
import '../../cart/presentation/widgets/cart_action_bar.dart';
import '../../cart/presentation/widgets/cart_summary_card.dart';
import '../../location/presentation/address_controller.dart';
import '../../location/presentation/address_picker_sheet.dart';
import '../data/orders_api.dart';
import 'orders_providers.dart';
import 'widgets/checkout_address_card.dart';
import 'widgets/checkout_payment_selector.dart';

const double _maxContentWidth = 560;

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

  PaymentMethod _paymentMethod = PaymentMethod.cash;
  String _changeFrom = 'exact';
  bool _placing = false;
  String? _phoneError;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authControllerProvider).valueOrNull;
    final phone = user?.phone;
    _phoneController = TextEditingController(text: phone == null ? '' : formatUzPhone(phone));
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
    if (_placing) return;
    final address = ref.read(addressControllerProvider);

    // Web refresh / stale tab: the cart may be empty by now.
    if (ref.read(cartControllerProvider).isEmpty) {
      showAppToast(context, ref.t('errors.CART_EMPTY'), tone: ToastTone.error);
      context.go('/cart');
      return;
    }

    // Never deliver to the Tashkent-centre placeholder: GPS was not granted
    // and nothing was picked yet, so ask for the real point first.
    if (address.isPlaceholder) {
      showAppToast(context, ref.t('checkout.chooseAddress'));
      await showAddressPickerSheet(context, ref);
      return;
    }

    // The API only accepts +998XXXXXXXXX; accept any spacing / pasted prefix.
    final rawPhone = _phoneController.text.trim();
    final digits = uzNationalDigits(rawPhone);
    if (rawPhone.isEmpty || digits.length != kUzPhoneDigits) {
      setState(() => _phoneError = ref.t(rawPhone.isEmpty ? 'checkout.errorPhone' : 'checkout.invalidPhone'));
      return;
    }
    final customerPhone = '+998$digits';

    setState(() {
      _placing = true;
      _phoneError = null;
    });
    final successMessage = ref.t('checkout.orderPlaced');

    try {
      // Courier-facing fragments stay in Uzbek on purpose (read by shopkeepers).
      final parts = <String>[];
      if (_entranceController.text.isNotEmpty) parts.add("Podyezd: ${_entranceController.text}");
      if (_floorController.text.isNotEmpty) parts.add("Qavat: ${_floorController.text}");
      if (_apartmentController.text.isNotEmpty) parts.add("Xonadon: ${_apartmentController.text}");
      if (_doorCodeController.text.isNotEmpty) parts.add("Domofon: ${_doorCodeController.text}");
      final fullAddress = _clamp(parts.isEmpty ? address.addressText : '${address.addressText} (${parts.join(', ')})', 300);

      var comment = _commentController.text.trim();
      if (_paymentMethod == PaymentMethod.cash) {
        String changeNote;
        if (_changeFrom == 'exact') {
          changeNote = "Qaytim kerak emas";
        } else {
          final banknoteUzs = int.tryParse(_changeFrom.replaceAll(' ', '')) ?? 0;
          final banknoteTiyin = banknoteUzs * 100;
          final currentTotal = ref.read(cartControllerProvider).totalAmount;
          final changeTiyin = banknoteTiyin - currentTotal;
          // A banknote smaller than the total would tell the courier to bring
          // change that does not exist — the selector already shows the red
          // hint, so refuse here instead of sending a misleading note.
          if (changeTiyin < 0) {
            showAppToast(context, ref.t('checkout.changeShort'), tone: ToastTone.error);
            return;
          }
          changeNote = changeTiyin > 0
              ? "Qaytim: $_changeFrom so'mdan (qaytim ${formatPrice(changeTiyin, SupportedLanguage.uz)})"
              : "Qaytim: $_changeFrom so'mdan (aniq summa)";
        }
        comment = comment.isEmpty ? changeNote : '$comment | $changeNote';
      }

      // The backend builds the order from its own cart — push the local one
      // first (it also re-checks stock/shop state and fails early if needed).
      await ref.read(cartApiProvider).replace(ref.read(cartControllerProvider));

      final promo = _promoCodeController.text.trim();
      final order = await ref.read(ordersApiProvider).createOrder(CreateOrderPayload(
            addressText: fullAddress,
            lat: address.lat,
            lng: address.lng,
            customerPhone: customerPhone,
            paymentMethod: _paymentMethod.value,
            comment: comment.isEmpty ? null : _clamp(comment, 500),
            promoCode: promo.isNotEmpty ? promo : null,
          ));

      ref.read(cartControllerProvider.notifier).clear();
      if (!mounted) return;
      showAppToast(context, successMessage, tone: ToastTone.success);
      context.go('/order/${order.id}');
    } on AppException catch (e) {
      // Covers INVALID_PROMO_CODE and every other backend envelope error.
      if (!mounted) return;
      showAppToast(context, ref.errorText(e), tone: ToastTone.error);
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  /// Backend limits (address_text 300, comment 500 chars).
  static String _clamp(String text, int max) => text.length <= max ? text : text.substring(0, max);

  @override
  Widget build(BuildContext context) {
    final addressText = ref.watch(addressControllerProvider.select((a) => a.addressText));
    final total = ref.watch(cartControllerProvider.select((c) => c.totalAmount));

    return Scaffold(
      appBar: AppBar(
        leading: Navigator.canPop(context)
            ? null
            : IconButton(icon: const Icon(LucideIcons.arrowLeft), tooltip: ref.t('common.back'), onPressed: () => context.go('/cart')),
        title: Text(ref.t('checkout.title')),
      ),
      body: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: _maxContentWidth),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.lg, AppSpacing.page, AppSpacing.xxl),
            children: [
              AppSection(
                title: ref.t('checkout.deliveryAddress'),
                child: CheckoutAddressCard(
                  addressText: addressText,
                  onChangeAddress: () => showAddressPickerSheet(context, ref),
                  entranceController: _entranceController,
                  floorController: _floorController,
                  apartmentController: _apartmentController,
                  doorCodeController: _doorCodeController,
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              AppSection(
                title: ref.t('checkout.contactPhone'),
                child: AppTextField(
                  controller: _phoneController,
                  icon: LucideIcons.phone,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                  hint: ref.t('auth.phonePlaceholder'),
                  error: _phoneError,
                  onChanged: _phoneError == null ? null : (_) => setState(() => _phoneError = null),
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              AppSection(
                title: ref.t('checkout.paymentMethod'),
                child: CheckoutPaymentSelector(
                  method: _paymentMethod,
                  onMethodChanged: (m) => setState(() => _paymentMethod = m),
                  changeFrom: _changeFrom,
                  onChangeFromChanged: (v) => setState(() => _changeFrom = v),
                  total: total,
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              _PromoSection(controller: _promoCodeController),
              const SizedBox(height: AppSpacing.xl),
              AppSection(
                title: ref.t('checkout.commentTitle'),
                child: AppTextField(
                  controller: _commentController,
                  maxLines: 3,
                  maxLength: 300,
                  hint: ref.t('checkout.commentPlaceholder'),
                  textCapitalization: TextCapitalization.sentences,
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              const CartSummaryCard(),
            ],
          ),
        ),
      ),
      bottomNavigationBar: CartActionBar(
        label: ref.t('checkout.placeOrder'),
        total: total,
        maxWidth: _maxContentWidth,
        loading: _placing,
        onPressed: _placing || total <= 0 ? null : _placeOrder,
      ),
    );
  }
}

/// Promo code in an orange-tinted "coupon" card. No client-side validation —
/// the backend rejects bad codes on submit (INVALID_PROMO_CODE → toast).
class _PromoSection extends ConsumerWidget {
  const _PromoSection({required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: AppSpacing.xs, bottom: AppSpacing.sm),
          child: Text(ref.t('checkout.promoCode'), style: AppText.title),
        ),
        AppCard(
          color: AppColors.orange50,
          borderColor: AppColors.orange100,
          child: AppTextField(
            controller: controller,
            icon: LucideIcons.ticket,
            hint: ref.t('checkout.promoCodePlaceholder'),
            textCapitalization: TextCapitalization.characters,
            textInputAction: TextInputAction.done,
            showClear: true,
          ),
        ),
      ],
    );
  }
}
