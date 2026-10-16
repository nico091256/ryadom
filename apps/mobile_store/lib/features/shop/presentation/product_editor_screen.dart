import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:localshop_shared/localshop_shared.dart';
import '../../../app/theme.dart';
import '../../../core/config/env.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/providers.dart';
import '../data/seller_api.dart';
import '../domain/seller_product.dart';
import 'shop_providers.dart';

class ProductEditorScreen extends ConsumerStatefulWidget {
  const ProductEditorScreen({super.key, this.product});

  final SellerProduct? product;

  @override
  ConsumerState<ProductEditorScreen> createState() => _ProductEditorScreenState();
}

class _ProductEditorScreenState extends ConsumerState<ProductEditorScreen> {
  late final _nameUzController = TextEditingController(text: widget.product?.nameUz ?? '');
  late final _nameRuController = TextEditingController(text: widget.product?.nameRu ?? '');
  late final _nameEnController = TextEditingController(text: widget.product?.nameEn ?? '');
  late final _descController = TextEditingController(text: widget.product?.descriptionUz ?? '');
  late final _priceController = TextEditingController(
    text: widget.product != null ? tiyinToUzs(widget.product!.price).toString() : '',
  );
  late final _stockController = TextEditingController(text: widget.product?.stock.toString() ?? '');

  String? _categoryId;
  bool _isAvailable = true;
  String? _imageUrl;
  bool _uploadingImage = false;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _categoryId = widget.product?.categoryId;
    _isAvailable = widget.product?.isAvailable ?? true;
    _imageUrl = widget.product?.imageUrl;
  }

  @override
  void dispose() {
    _nameUzController.dispose();
    _nameRuController.dispose();
    _nameEnController.dispose();
    _descController.dispose();
    _priceController.dispose();
    _stockController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null) return;
    setState(() => _uploadingImage = true);
    try {
      final url = await ref.read(sellerApiProvider).uploadImage(picked.path);
      setState(() => _imageUrl = url);
    } on AppException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _uploadingImage = false);
    }
  }

  Future<void> _save() async {
    final name = _nameUzController.text.trim();
    final priceUzs = int.tryParse(_priceController.text.trim());
    final stock = int.tryParse(_stockController.text.trim());

    if (name.isEmpty) {
      setState(() => _error = ref.t('editor.nameRequired'));
      return;
    }
    if (priceUzs == null || priceUzs <= 0) {
      setState(() => _error = ref.t('editor.priceInvalid'));
      return;
    }
    if (_categoryId == null) {
      setState(() => _error = ref.t('editor.nameRequired'));
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final api = ref.read(sellerApiProvider);
      if (widget.product == null) {
        await api.createProduct(ProductInput(
          nameUz: name,
          nameRu: _nameRuController.text.trim().isEmpty ? null : _nameRuController.text.trim(),
          nameEn: _nameEnController.text.trim().isEmpty ? null : _nameEnController.text.trim(),
          categoryId: _categoryId!,
          descriptionUz: _descController.text.trim().isEmpty ? null : _descController.text.trim(),
          price: uzsToTiyin(priceUzs),
          imageUrl: _imageUrl,
          stock: stock ?? 0,
          isAvailable: _isAvailable,
        ));
      } else {
        await api.updateProduct(widget.product!.id, {
          'name_uz': name,
          'name_ru': ?_nameRuController.text.trim().isEmpty ? null : _nameRuController.text.trim(),
          'name_en': ?_nameEnController.text.trim().isEmpty ? null : _nameEnController.text.trim(),
          'category_id': _categoryId,
          'description_uz': ?_descController.text.trim().isEmpty ? null : _descController.text.trim(),
          'price': uzsToTiyin(priceUzs),
          'image_url': _imageUrl,
          'stock': stock ?? 0,
          'is_available': _isAvailable,
        });
      }
      if (mounted) Navigator.of(context).pop();
    } on AppException catch (e) {
      setState(() => _error = e.message.isNotEmpty ? e.message : ref.t('editor.saveFailed'));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final categoriesAsync = ref.watch(categoriesProvider);

    return Scaffold(
      appBar: AppBar(title: Text(widget.product == null ? ref.t('editor.titleNew') : ref.t('editor.titleEdit'))),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(ref.t('editor.image'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _uploadingImage ? null : _pickImage,
              child: Container(
                height: 120,
                width: 120,
                decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(14)),
                child: _uploadingImage
                    ? const Center(child: CircularProgressIndicator())
                    : _imageUrl != null
                        ? ClipRRect(borderRadius: BorderRadius.circular(14), child: Image.network(Env.resolveMediaUrl(_imageUrl!), fit: BoxFit.cover))
                        : const Icon(Icons.add_a_photo_outlined, color: Color(0xFF94A3B8), size: 32),
              ),
            ),
            const SizedBox(height: 20),
            TextField(controller: _nameUzController, decoration: InputDecoration(labelText: ref.t('editor.nameUz'))),
            const SizedBox(height: 10),
            TextField(controller: _nameRuController, decoration: InputDecoration(labelText: ref.t('editor.nameRu'))),
            const SizedBox(height: 10),
            TextField(controller: _nameEnController, decoration: InputDecoration(labelText: ref.t('editor.nameEn'))),
            const SizedBox(height: 10),
            TextField(controller: _descController, maxLines: 3, decoration: InputDecoration(labelText: ref.t('editor.descUz'))),
            const SizedBox(height: 16),
            categoriesAsync.when(
              data: (categories) => DropdownButtonFormField<String>(
                initialValue: _categoryId,
                decoration: InputDecoration(labelText: ref.t('editor.category')),
                items: categories.map((c) => DropdownMenuItem(value: c.id, child: Text(c.nameUz))).toList(),
                onChanged: (v) => setState(() => _categoryId = v),
              ),
              loading: () => const LinearProgressIndicator(),
              error: (err, _) => Text('$err'),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: TextField(controller: _priceController, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: ref.t('editor.price')))),
                const SizedBox(width: 10),
                Expanded(child: TextField(controller: _stockController, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: ref.t('editor.stock')))),
              ],
            ),
            const SizedBox(height: 10),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(ref.t('editor.availableSwitch')),
              value: _isAvailable,
              activeTrackColor: AppTheme.seed,
              onChanged: (v) => setState(() => _isAvailable = v),
            ),
            if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: const TextStyle(color: Colors.red))),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(ref.t('editor.save')),
            ),
          ],
        ),
      ),
    );
  }
}
