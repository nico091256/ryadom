import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../app/theme.dart';
import '../../../core/config/env.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/providers.dart';
import '../../auth/presentation/auth_controller.dart';
import '../domain/seller_shop.dart';
import 'shop_providers.dart';

class ShopSettingsScreen extends ConsumerWidget {
  const ShopSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shopAsync = ref.watch(sellerShopProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(ref.t('shopSettings.title')),
        actions: [IconButton(icon: const Icon(Icons.logout), onPressed: () => ref.read(authControllerProvider.notifier).logout())],
      ),
      body: shopAsync.when(
        data: (shop) => _ShopForm(shop: shop),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('$err')),
      ),
    );
  }
}

class _ShopForm extends ConsumerStatefulWidget {
  const _ShopForm({required this.shop});
  final SellerShop shop;

  @override
  ConsumerState<_ShopForm> createState() => _ShopFormState();
}

class _ShopFormState extends ConsumerState<_ShopForm> {
  late final _nameController = TextEditingController(text: widget.shop.name);
  late final _phoneController = TextEditingController(text: widget.shop.phone);
  late final _addressController = TextEditingController(text: widget.shop.addressText);
  late final _openTimeController = TextEditingController(text: widget.shop.openTime);
  late final _closeTimeController = TextEditingController(text: widget.shop.closeTime);
  late bool _isOpen = widget.shop.isOpen;
  late String? _logoUrl = widget.shop.logoUrl;
  bool _uploadingLogo = false;
  bool _saving = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _openTimeController.dispose();
    _closeTimeController.dispose();
    super.dispose();
  }

  Future<void> _pickLogo() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null) return;
    setState(() => _uploadingLogo = true);
    try {
      final url = await ref.read(sellerApiProvider).uploadImage(picked.path);
      setState(() => _logoUrl = url);
    } on AppException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _uploadingLogo = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(sellerApiProvider).updateShop({
        'name': _nameController.text.trim(),
        'phone': _phoneController.text.trim(),
        'address_text': _addressController.text.trim(),
        'open_time': _openTimeController.text.trim(),
        'close_time': _closeTimeController.text.trim(),
        'is_open': _isOpen,
        'logo_url': ?_logoUrl,
      });
      ref.invalidate(sellerShopProvider);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ref.t('shopSettings.saved'))));
    } on AppException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message.isNotEmpty ? e.message : ref.t('shopSettings.saveFailed'))));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(
            child: GestureDetector(
              onTap: _uploadingLogo ? null : _pickLogo,
              child: Container(
                height: 96,
                width: 96,
                decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(48)),
                child: _uploadingLogo
                    ? const Center(child: CircularProgressIndicator())
                    : _logoUrl != null
                        ? ClipRRect(borderRadius: BorderRadius.circular(48), child: CachedNetworkImage(imageUrl: Env.resolveMediaUrl(_logoUrl!), fit: BoxFit.cover))
                        : const Icon(Icons.storefront, color: Color(0xFF94A3B8), size: 32),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: _isOpen ? const Color(0xFFF0FDF4) : const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(14)),
            child: Row(
              children: [
                Expanded(child: Text(_isOpen ? ref.t('shopSettings.statusOpen') : ref.t('shopSettings.statusClosed'), style: const TextStyle(fontWeight: FontWeight.w700))),
                Switch(value: _isOpen, activeTrackColor: AppTheme.seed, onChanged: (v) => setState(() => _isOpen = v)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          TextField(controller: _nameController, decoration: InputDecoration(labelText: ref.t('shopSettings.name'))),
          const SizedBox(height: 10),
          TextField(controller: _phoneController, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: ref.t('shopSettings.phone'))),
          const SizedBox(height: 10),
          TextField(controller: _addressController, decoration: InputDecoration(labelText: ref.t('shopSettings.address'))),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: TextField(controller: _openTimeController, decoration: InputDecoration(labelText: ref.t('shopSettings.openTime'), hintText: '08:00'))),
              const SizedBox(width: 10),
              Expanded(child: TextField(controller: _closeTimeController, decoration: InputDecoration(labelText: ref.t('shopSettings.closeTime'), hintText: '22:00'))),
            ],
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(ref.t('common.save')),
          ),
        ],
      ),
    );
  }
}
