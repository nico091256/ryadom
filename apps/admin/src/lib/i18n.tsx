'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Globe } from 'lucide-react';

export type Lang = 'uz' | 'ru' | 'en';

const STORAGE_KEY = 'ryadom_lang';

const EXACT_TRANSLATIONS: Record<string, { ru: string; en: string }> = {
  // App & Navigation
  "Do'kon paneli": { ru: 'Панель магазина', en: 'Seller Panel' },
  'Admin panel': { ru: 'Админ панель', en: 'Admin Panel' },
  "Ryadom Do'kon": { ru: 'Ryadom Магазин', en: 'Ryadom Store' },
  'Ryadom Admin': { ru: 'Ryadom Админ', en: 'Ryadom Admin' },
  Asosiy: { ru: 'Основное', en: 'Main' },
  Savdo: { ru: 'Торговля', en: 'Commerce' },
  Katalog: { ru: 'Каталог', en: 'Catalog' },
  Odamlar: { ru: 'Люди', en: 'People' },
  Nazorat: { ru: 'Контроль', en: 'Oversight' },
  'Boshqaruv paneli': { ru: 'Панель управления', en: 'Dashboard' },
  Panel: { ru: 'Панель', en: 'Dashboard' },
  Buyurtmalar: { ru: 'Заказы', en: 'Orders' },
  Buyurtma: { ru: 'Заказы', en: 'Orders' },
  Mahsulotlar: { ru: 'Товары', en: 'Products' },
  "Do'kon": { ru: 'Магазин', en: 'Shop' },
  "Do'konlar": { ru: 'Магазины', en: 'Shops' },
  "Yangi do'kon": { ru: 'Новый магазин', en: 'New Shop' },
  "Do'kon tafsilotlari": { ru: 'Детали магазина', en: 'Shop Details' },
  Statistika: { ru: 'Статистика', en: 'Statistics' },
  Kategoriyalar: { ru: 'Категории', en: 'Categories' },
  'Promo-kodlar': { ru: 'Промокоды', en: 'Promo Codes' },
  Foydalanuvchilar: { ru: 'Пользователи', en: 'Users' },
  'Audit jurnali': { ru: 'Журнал аудита', en: 'Audit Log' },
  Boshqa: { ru: 'Ещё', en: 'More' },
  Menyu: { ru: 'Меню', en: 'Menu' },
  Yopish: { ru: 'Закрыть', en: 'Close' },
  "Yig'ish": { ru: 'Свернуть', en: 'Collapse' },
  Kengaytirish: { ru: 'Развернуть', en: 'Expand' },
  Parol: { ru: 'Пароль', en: 'Password' },
  "Parolni o'zgartirish": { ru: 'Изменить пароль', en: 'Change Password' },
  Chiqish: { ru: 'Выйти', en: 'Log out' },
  "Do'konchi": { ru: 'Продавец', en: 'Seller' },
  Administrator: { ru: 'Администратор', en: 'Administrator' },
  '← Panelga qaytish': { ru: '← Вернуться в панель', en: '← Back to dashboard' },

  // Statuses & Roles
  Hammasi: { ru: 'Все', en: 'All' },
  Yangi: { ru: 'Новый', en: 'New' },
  'Qabul qilindi': { ru: 'Принят', en: 'Accepted' },
  "Yo'lda": { ru: 'В пути', en: 'On the way' },
  Yetkazildi: { ru: 'Доставлен', en: 'Delivered' },
  'Bekor qilindi': { ru: 'Отменён', en: 'Cancelled' },
  Faol: { ru: 'Активен', en: 'Active' },
  Bloklangan: { ru: 'Заблокирован', en: 'Blocked' },
  'Tasdiqlash kutilmoqda': { ru: 'Ожидает подтверждения', en: 'Pending approval' },
  Kutilmoqda: { ru: 'Ожидается', en: 'Pending' },
  "To'langan": { ru: 'Оплачен', en: 'Paid' },
  Qaytarilgan: { ru: 'Возвращён', en: 'Refunded' },
  Xato: { ru: 'Ошибка', en: 'Failed' },
  Naqd: { ru: 'Наличные', en: 'Cash' },
  Onlayn: { ru: 'Онлайн', en: 'Online' },
  Mijoz: { ru: 'Клиент', en: 'Customer' },
  Sotuvchi: { ru: 'Продавец', en: 'Seller' },
  Admin: { ru: 'Админ', en: 'Admin' },
  Ochiq: { ru: 'Открыто', en: 'Open' },
  Yopiq: { ru: 'Закрыто', en: 'Closed' },
  Sotuvda: { ru: 'В продаже', en: 'Available' },
  Yashirilgan: { ru: 'Скрыт', en: 'Hidden' },
  Tugagan: { ru: 'Нет в наличии', en: 'Out of stock' },

  // Common Buttons & Actions
  Saqlash: { ru: 'Сохранить', en: 'Save' },
  "O'zgarishlarni saqlash": { ru: 'Сохранить изменения', en: 'Save changes' },
  'Sozlamalarni saqlash': { ru: 'Сохранить настройки', en: 'Save settings' },
  Bekor: { ru: 'Отмена', en: 'Cancel' },
  'Bekor qilish': { ru: 'Отменить', en: 'Cancel' },
  Tasdiqlash: { ru: 'Подтвердить', en: 'Confirm' },
  Yangilash: { ru: 'Обновить', en: 'Refresh' },
  "Qo'shish": { ru: 'Добавить', en: 'Add' },
  Yaratish: { ru: 'Создать', en: 'Create' },
  Tahrirlash: { ru: 'Редактировать', en: 'Edit' },
  "O'chirish": { ru: 'Удалить', en: 'Delete' },
  Yuklash: { ru: 'Загрузить', en: 'Upload' },
  Rasm: { ru: 'Фото', en: 'Image' },
  'Rasm tanlash': { ru: 'Выбрать фото', en: 'Choose image' },
  'Fayl tanlash': { ru: 'Выбрать файл', en: 'Choose file' },
  'Qayta yaratish': { ru: 'Пересоздать', en: 'Regenerate' },
  'Kalit yaratish': { ru: 'Создать ключ', en: 'Generate key' },
  Nusxalash: { ru: 'Копировать', en: 'Copy' },
  Nusxalandi: { ru: 'Скопировано', en: 'Copied' },
  "Ko'rsatish": { ru: 'Показать', en: 'Show' },
  Yashirish: { ru: 'Скрыть', en: 'Hide' },
  Oldingi: { ru: 'Назад', en: 'Previous' },
  Keyingi: { ru: 'Вперёд', en: 'Next' },
  Tozalash: { ru: 'Очистить', en: 'Clear' },
  'Filtrni tozalash': { ru: 'Сбросить фильтр', en: 'Clear filter' },
  'Filtrlarni tozalash': { ru: 'Сбросить фильтры', en: 'Clear filters' },
  'Qidiruvni tozalash': { ru: 'Очистить поиск', en: 'Clear search' },
  'Qayta urinish': { ru: 'Повторить', en: 'Retry' },
  Kirish: { ru: 'Войти', en: 'Sign in' },
  'Tizimga kirish': { ru: 'Вход в систему', en: 'Sign in' },

  // Orders Page (Store & Admin)
  "Mijozlardan tushgan buyurtmalarni real vaqtda qabul qiling va yetkazib bering": {
    ru: 'Принимайте и доставляйте заказы клиентов в реальном времени',
    en: 'Accept and fulfill customer orders in real time',
  },
  'Jonli ulanish': { ru: 'В сети (Live)', en: 'Live connected' },
  'Qayta ulanmoqda…': { ru: 'Переподключение…', en: 'Reconnecting…' },
  'Ovoz yoqilgan': { ru: 'Звук включён', en: 'Sound on' },
  "Ovoz o'chirilgan": { ru: 'Звук выключен', en: 'Sound off' },
  'Qabul qilish': { ru: 'Принять заказ', en: 'Accept order' },
  'Rad etish': { ru: 'Отклонить', en: 'Reject' },
  "Yo'lga chiqdi": { ru: 'Отправить в путь', en: 'Mark on the way' },
  'Yetkazib berildi': { ru: 'Доставлено', en: 'Mark delivered' },
  'Buyurtmalar topilmadi': { ru: 'Заказы не найдены', en: 'No orders found' },
  "Hozircha buyurtmalar yo'q": { ru: 'Пока нет заказов', en: 'No orders yet' },
  "Yangi buyurtma tushishi bilan shu yerda avtomatik ko'rinadi va ovozli xabar beriladi": {
    ru: 'Новые заказы появятся здесь автоматически со звуковым оповещением',
    en: 'New orders will appear here automatically with a sound alert',
  },
  'Buyurtma tarkibi': { ru: 'Состав заказа', en: 'Order items' },
  'Yetkazib berish manzili': { ru: 'Адрес доставки', en: 'Delivery address' },
  Izoh: { ru: 'Комментарий', en: 'Comment' },
  Chegirma: { ru: 'Скидка', en: 'Discount' },
  Jami: { ru: 'Итого', en: 'Total' },
  Vaqt: { ru: 'Время', en: 'Time' },
  Holat: { ru: 'Статус', en: 'Status' },
  "To'lov": { ru: 'Оплата', en: 'Payment' },
  Amal: { ru: 'Действие', en: 'Action' },

  // Products Page (Store)
  "Do'koningizdagi mahsulotlar, narxlar va qoldiqlar": {
    ru: 'Товары, цены и остатки вашего магазина',
    en: 'Products, prices, and inventory in your shop',
  },
  'Yangi mahsulot': { ru: 'Новый товар', en: 'New product' },
  "Mahsulot qo'shish": { ru: 'Добавить товар', en: 'Add product' },
  'Mahsulotni tahrirlash': { ru: 'Редактировать товар', en: 'Edit product' },
  "Mahsulotni o'chirish": { ru: 'Удалить товар', en: 'Delete product' },
  'REGOS / YES POS dan yuklash': { ru: 'Загрузить из REGOS / YES POS', en: 'Import from REGOS / YES POS' },
  'REGOS / POS dan yuklash': { ru: 'Загрузить из REGOS / POS', en: 'Import from REGOS / POS' },
  'Barcha kategoriyalar': { ru: 'Все категории', en: 'All categories' },
  'Nomi, shtrix-kod, artikul yoki kategoriya…': {
    ru: 'Название, штрих-код, артикул или категория…',
    en: 'Name, barcode, SKU, or category…',
  },
  "Nomi, shtrix-kod yoki SKU bo'yicha qidirish": {
    ru: 'Поиск по названию, штрих-коду или SKU',
    en: 'Search by name, barcode, or SKU',
  },
  'Mahsulot topilmadi': { ru: 'Товары не найдены', en: 'No products found' },
  "Hali mahsulot yo'q": { ru: 'Товаров пока нет', en: 'No products yet' },
  Ruscha: { ru: 'Русский', en: 'Russian' },
  Inglizcha: { ru: 'Английский', en: 'English' },
  Mahsulot: { ru: 'Товар', en: 'Product' },
  'Kod / Shtrix-kod': { ru: 'Код / Штрих-код', en: 'Code / Barcode' },
  Kategoriya: { ru: 'Категория', en: 'Category' },
  Narx: { ru: 'Цена', en: 'Price' },
  Qoldiq: { ru: 'Остаток', en: 'Stock' },
  "Hozircha mahsulotlar yo'q": { ru: 'Товаров пока нет', en: 'No products yet' },
  "Birinchi mahsulotingizni qo'shing yoki REGOS / YES POS dan tortib oling": {
    ru: 'Добавьте первый товар или загрузите каталог из REGOS / YES POS',
    en: 'Add your first product or import from REGOS / YES POS',
  },
  'Hech narsa topilmadi': { ru: 'Ничего не найдено', en: 'Nothing found' },

  // Shop Settings & POS Integration
  "Do'kon sozlamalari": { ru: 'Настройки магазина', en: 'Shop settings' },
  "Do'kon holati, ish vaqti, manzil va aloqa ma'lumotlari": {
    ru: 'Статус магазина, время работы, адрес и контактные данные',
    en: 'Shop status, working hours, address, and contact info',
  },
  'Kassa (POS) integratsiyasi — REGOS.Online & YES POS': {
    ru: 'Интеграция кассы (POS) — REGOS.Online и YES POS',
    en: 'POS Integration — REGOS.Online & YES POS',
  },
  "REGOS, YES POS (yespos.uz), BILLZ, 1C, MoySklad, Jowi, iiko, Poster tizimlarini ulang va mahsulotlarni qo'lda kiritmasdan avtomatik tortib oling": {
    ru: 'Подключите REGOS, YES POS (yespos.uz), BILLZ, 1C, МойСклад, Jowi, iiko, Poster и загружайте товары автоматически',
    en: 'Connect REGOS, YES POS (yespos.uz), BILLZ, 1C, MoySklad, Jowi, iiko, Poster to sync products automatically',
  },
  'Kassa tizimi': { ru: 'Кассовая система (POS)', en: 'POS System' },
  'Webhook manzili (yangi buyurtma)': { ru: 'Webhook URL (новый заказ)', en: 'Webhook URL (new order)' },
  'REGOS dan mahsulotlarni tortish': { ru: 'Загрузить товары из REGOS', en: 'Pull products from REGOS' },
  'YES POS dan mahsulotlarni tortish': { ru: 'Загрузить товары из YES POS', en: 'Pull products from YES POS' },
  'Demo REGOS bazasidan sinash': { ru: 'Тест демо-базы REGOS', en: 'Test with REGOS demo' },
  'Demo YES POS bazasidan sinash': { ru: 'Тест демо-базы YES POS', en: 'Test with YES POS demo' },
  'Standart kategoriya (yangi mahsulotlar uchun)': {
    ru: 'Категория по умолчанию (для новых товаров)',
    en: 'Default category (for new products)',
  },
  'Push-API kalit (Kassadan Ryadom ga yuborish uchun)': {
    ru: 'Push-API ключ (для отправки из кассы в Ryadom)',
    en: 'Push-API key (from POS to Ryadom)',
  },
  'Telegram bildirishnomalar': { ru: 'Telegram-уведомления', en: 'Telegram notifications' },
  'Xaritadan tanlash': { ru: 'Выбрать на карте', en: 'Pick on map' },

  // Statistics Page (Store & Admin)
  "Do'koningizning savdo ko'rsatkichlari va katalog holati": {
    ru: 'Показатели продаж и состояние каталога вашего магазина',
    en: 'Sales performance and catalog overview of your shop',
  },
  Bugun: { ru: 'Сегодня', en: 'Today' },
  'Shu hafta': { ru: 'За неделю', en: 'This week' },
  'Shu oy': { ru: 'За месяц', en: 'This month' },
  'Bugungi savdo': { ru: 'Продажи за сегодня', en: 'Sales today' },
  'Haftalik savdo': { ru: 'Продажи за неделю', en: 'Weekly sales' },
  'Oylik savdo': { ru: 'Продажи за месяц', en: 'Monthly sales' },
  "O'rtacha chek (oylik)": { ru: 'Средний чек (за месяц)', en: 'Average order value (monthly)' },
  'Faol buyurtmalar': { ru: 'Активные заказы', en: 'Active orders' },
  'Mahsulotlar katalogi': { ru: 'Каталог товаров', en: 'Product catalog' },
  'Tugagan mahsulotlar': { ru: 'Товары без остатка', en: 'Out-of-stock products' },
  "Buyurtmalarga o'tish →": { ru: 'Перейти к заказам →', en: 'Go to orders →' },
  "Qoldiqni to'ldirish →": { ru: 'Пополнить остатки →', en: 'Restock products →' },
  'Davrlar taqqoslovi': { ru: 'Сравнение периодов', en: 'Period comparison' },
  "Faqat yetkazib berilgan buyurtmalar tushumga qo'shiladi": {
    ru: 'В выручку учитываются только доставленные заказы',
    en: 'Only delivered orders count toward revenue',
  },

  // Admin Panel Specifics
  "Platformaning umumiy ko'rsatkichlari va so'nggi faollik": {
    ru: 'Общие показатели платформы и последняя активность',
    en: 'Platform overview and recent activity',
  },
  'Jami buyurtmalar': { ru: 'Всего заказов', en: 'Total orders' },
  'Jami tushum': { ru: 'Общая выручка', en: 'Total revenue' },
  "Faol do'konlar": { ru: 'Активные магазины', en: 'Active shops' },
  "So'nggi 7 kunlik buyurtmalar": { ru: 'Заказы за последние 7 дней', en: 'Orders in the last 7 days' },
  "So'nggi buyurtmalar": { ru: 'Последние заказы', en: 'Recent orders' },
  "Barchasini ko'rish →": { ru: 'Смотреть все →', en: 'View all →' },
  "Do'kon qo'shish": { ru: 'Добавить магазин', en: 'Add shop' },
  "Yangi kategoriya": { ru: 'Новая категория', en: 'New category' },
  "Kategoriya qo'shish": { ru: 'Добавить категорию', en: 'Add category' },
  'Kategoriyani tahrirlash': { ru: 'Редактировать категорию', en: 'Edit category' },
  'Yangi promo-kod': { ru: 'Новый промокод', en: 'New promo code' },
  "Promo-kod qo'shish": { ru: 'Добавить промокод', en: 'Add promo code' },
  'Bloklash': { ru: 'Заблокировать', en: 'Block' },
  'Blokdan chiqarish': { ru: 'Разблокировать', en: 'Unblock' },
  'Parolni tiklash': { ru: 'Сбросить пароль', en: 'Reset password' },

  // Login & Password Pages
  Login: { ru: 'Логин', en: 'Username' },
  'Joriy parol': { ru: 'Текущий пароль', en: 'Current password' },
  'Yangi parol': { ru: 'Новый пароль', en: 'New password' },
  'Yangi parolni tasdiqlang': { ru: 'Подтвердите новый пароль', en: 'Confirm new password' },
  'Kamida 6 ta belgi': { ru: 'Минимум 6 символов', en: 'At least 6 characters' },
  "Administrator hisobingiz uchun yangi parol o'rnating": {
    ru: 'Установите новый пароль для вашей учётной записи администратора',
    en: 'Set a new password for your administrator account',
  },
  "Do'kon hisobiga kirish uchun login va parolni kiriting": {
    ru: 'Введите логин и пароль для входа в кабинет магазина',
    en: 'Enter your username and password to sign in to the seller portal',
  },
  "Boshqaruv paneliga kirish uchun login va parolni kiriting": {
    ru: 'Введите логин и пароль для входа в панель управления',
    en: 'Enter your username and password to access the admin dashboard',
  },

  // Additional Admin & Store Table Headers, Descriptions & Actions
  'Platformadagi barcha buyurtmalarni kuzating va boshqaring': {
    ru: 'Отслеживайте и управляйте всеми заказами на платформе',
    en: 'Track and manage all orders across the platform',
  },
  "Hamkor do'konlar, ularning egalari va ko'rsatkichlari": {
    ru: 'Партнёрские магазины, их владельцы и показатели',
    en: 'Partner shops, their owners, and performance metrics',
  },
  "Barcha do'konlar uchun umumiy mahsulot kategoriyalari": {
    ru: 'Общие категории товаров для всех магазинов',
    en: 'Shared product categories across all shops',
  },
  "Mijozlar buyurtma berishda qo'llaydigan chegirma kodlari": {
    ru: 'Промокоды на скидку, применяемые клиентами при заказе',
    en: 'Discount promo codes used by customers at checkout',
  },
  'Mijozlar, sotuvchilar va administratorlar': {
    ru: 'Клиенты, продавцы и администраторы',
    en: 'Customers, sellers, and administrators',
  },
  "Platformada bajarilgan barcha muhim amallar tarixi": {
    ru: 'История всех важных действий, выполненных на платформе',
    en: 'History of all administrative actions on the platform',
  },
  Mijozlar: { ru: 'Клиенты', en: 'Customers' },
  Sotuvchilar: { ru: 'Продавцы', en: 'Sellers' },
  Adminlar: { ru: 'Админы', en: 'Admins' },
  Foydalanuvchi: { ru: 'Пользователь', en: 'User' },
  'Promo-kod': { ru: 'Промокод', en: 'Promo code' },
  'Promo-kodni tahrirlash': { ru: 'Редактировать промокод', en: 'Edit promo code' },
  Rol: { ru: 'Роль', en: 'Role' },
  'Telefon / login': { ru: 'Телефон / логин', en: 'Phone / username' },
  'Jami xarid': { ru: 'Сумма покупок', en: 'Total spent' },
  "Ro'yxatdan o'tgan": { ru: 'Зарегистрирован', en: 'Registered' },
  Summa: { ru: 'Сумма', en: 'Amount' },
  Tushum: { ru: 'Выручка', en: 'Revenue' },
  Egasi: { ru: 'Владелец', en: 'Owner' },
  'Ish vaqti': { ru: 'Время работы', en: 'Working hours' },
  Manzil: { ru: 'Адрес', en: 'Address' },
  Telefon: { ru: 'Телефон', en: 'Phone' },
  Ismsiz: { ru: 'Без имени', en: 'Unnamed' },
  Blok: { ru: 'Блок', en: 'Blocked' },
  Ochish: { ru: 'Разблок.', en: 'Unblock' },
  Faollashtirish: { ru: 'Активировать', en: 'Activate' },
  Batafsil: { ru: 'Подробнее', en: 'Details' },
  "Barcha do'konlar": { ru: 'Все магазины', en: 'All shops' },
  "Barcha to'lovlar": { ru: 'Все типы оплаты', en: 'All payment methods' },
  'Barcha holatlar': { ru: 'Все статусы', en: 'All statuses' },
  'Barcha amallar': { ru: 'Все действия', en: 'All actions' },
  'ID, telefon yoki ism': { ru: 'ID, телефон или имя', en: 'ID, phone, or name' },
  'Nomi, telefon yoki manzil': { ru: 'Название, телефон или адрес', en: 'Name, phone, or address' },
  'Ism, telefon yoki login': { ru: 'Имя, телефон или логин', en: 'Name, phone, or login' },
  'Kategoriya qidirish': { ru: 'Поиск категории', en: 'Search category' },
  "Do'konlar topilmadi": { ru: 'Магазины не найдены', en: 'No shops found' },
  'Foydalanuvchilar topilmadi': { ru: 'Пользователи не найдены', en: 'No users found' },
  "Kategoriyalar yo'q": { ru: 'Категорий нет', en: 'No categories' },
  "Promo-kodlar yo'q": { ru: 'Промокодов нет', en: 'No promo codes' },
  "Nomi (o'zbekcha)": { ru: 'Название (узб.)', en: 'Name (Uzbek)' },
  'Nomi (ruscha)': { ru: 'Название (рус.)', en: 'Name (Russian)' },
  'Nomi (inglizcha)': { ru: 'Название (англ.)', en: 'Name (English)' },
  "Bo'sh qolsa o'zbekcha nomi ishlatiladi": {
    ru: 'Если пусто — используется узбекское название',
    en: 'Falls back to Uzbek name if left blank',
  },
  Ikonka: { ru: 'Иконка', en: 'Icon' },
  Kod: { ru: 'Код', en: 'Code' },
  Tavsif: { ru: 'Описание', en: 'Description' },
  'Maksimal chegirma': { ru: 'Макс. скидка', en: 'Max discount' },
  'Minimal buyurtma': { ru: 'Мин. сумма заказа', en: 'Min order amount' },
  'Foydalanish limiti': { ru: 'Лимит использований', en: 'Usage limit' },
  'Amal qilish muddati': { ru: 'Срок действия', en: 'Expiration date' },
  Ishlatilgan: { ru: 'Использовано', en: 'Used' },
  Muddati: { ru: 'Срок', en: 'Expires' },
  Cheksiz: { ru: 'Без лимита', en: 'Unlimited' },
  'Muddati tugagan': { ru: 'Истёк', en: 'Expired' },
  'Limiti tugagan': { ru: 'Исчерпан', en: 'Limit reached' },
  "O'chirilgan": { ru: 'Отключён', en: 'Disabled' },

  // Audit Actions
  "Do'kon yaratildi": { ru: 'Магазин создан', en: 'Shop created' },
  "Do'kon tasdiqlandi": { ru: 'Магазин подтверждён', en: 'Shop approved' },
  "Do'kon bloklandi": { ru: 'Магазин заблокирован', en: 'Shop blocked' },
  "Do'kon blokdan chiqarildi": { ru: 'Магазин разблокирован', en: 'Shop unblocked' },
  'Sotuvchi paroli tiklandi': { ru: 'Пароль продавца сброшен', en: 'Seller password reset' },
  "Do'kon tahrirlandi": { ru: 'Магазин изменён', en: 'Shop updated' },
  'Buyurtma bekor qilindi': { ru: 'Заказ отменён', en: 'Order cancelled' },
  'Foydalanuvchi bloklandi': { ru: 'Пользователь заблокирован', en: 'User blocked' },
  'Foydalanuvchi blokdan chiqarildi': { ru: 'Пользователь разблокирован', en: 'User unblocked' },
  'Promo-kod yaratildi': { ru: 'Промокод создан', en: 'Promo code created' },
  'Promo-kod tahrirlandi': { ru: 'Промокод изменён', en: 'Promo code updated' },
  "Promo-kod o'chirildi": { ru: 'Промокод удалён', en: 'Promo code deleted' },
  'Kategoriya yaratildi': { ru: 'Категория создана', en: 'Category created' },
  'Kategoriya tahrirlandi': { ru: 'Категория изменена', en: 'Category updated' },
  "Kategoriya o'chirildi": { ru: 'Категория удалена', en: 'Category deleted' },
  'Mahsulot tahrirlandi': { ru: 'Товар изменён', en: 'Product updated' },
  "Mahsulot o'chirildi": { ru: 'Товар удалён', en: 'Product deleted' },
  Sabab: { ru: 'Причина', en: 'Reason' },
  Maydonlar: { ru: 'Поля', en: 'Fields' },
  Avval: { ru: 'Было', en: 'Before' },
  Keyin: { ru: 'Стало', en: 'After' },
  Nomi: { ru: 'Название', en: 'Name' },
  'Obyekt': { ru: 'Объект', en: 'Target' },
  'Tafsilotlar': { ru: 'Детали', en: 'Details' },
};

const PATTERN_RULES: Array<{
  re: RegExp;
  ru: (...m: string[]) => string;
  en: (...m: string[]) => string;
}> = [
  {
    re: /^([\d\s.,\u00A0]+)\s*so['’`ʻ]m$/i,
    ru: (_, n) => `${n.trim()} сум`,
    en: (_, n) => `${n.trim()} UZS`,
  },
  {
    re: /^([\d\s.,\u00A0]+)\s*ta mahsulot$/i,
    ru: (_, n) => `${n.trim()} товаров`,
    en: (_, n) => `${n.trim()} products`,
  },
  {
    re: /^([\d\s.,\u00A0]+)\s*ta buyurtma$/i,
    ru: (_, n) => `${n.trim()} заказов`,
    en: (_, n) => `${n.trim()} orders`,
  },
  {
    re: /^([\d\s.,\u00A0]+)\s*ta do['’`ʻ]kon$/i,
    ru: (_, n) => `${n.trim()} магазинов`,
    en: (_, n) => `${n.trim()} shops`,
  },
  {
    re: /^([\d\s.,\u00A0]+)\s*ta foydalanuvchi$/i,
    ru: (_, n) => `${n.trim()} пользователей`,
    en: (_, n) => `${n.trim()} users`,
  },
  {
    re: /^([\d\s.,\u00A0]+)\s*ta yozuv$/i,
    ru: (_, n) => `${n.trim()} записей`,
    en: (_, n) => `${n.trim()} records`,
  },
  {
    re: /^([\d\s.,\u00A0]+)\s*ta kategoriya$/i,
    ru: (_, n) => `${n.trim()} категорий`,
    en: (_, n) => `${n.trim()} categories`,
  },
  {
    re: /^([\d\s.,\u00A0]+)\s*ta promo-kod$/i,
    ru: (_, n) => `${n.trim()} промокодов`,
    en: (_, n) => `${n.trim()} promo codes`,
  },
  {
    re: /^([\d\s.,\u00A0]+)\s*ta sotuvda$/i,
    ru: (_, n) => `${n.trim()} в продаже`,
    en: (_, n) => `${n.trim()} available`,
  },
  {
    re: /^([\d\s.,\u00A0]+)\s*ta$/i,
    ru: (_, n) => `${n.trim()} шт.`,
    en: (_, n) => `${n.trim()}`,
  },
  {
    re: /^([\d\s.,\u00A0]+)\s*dona$/i,
    ru: (_, n) => `${n.trim()} шт.`,
    en: (_, n) => `${n.trim()} pcs`,
  },
  {
    re: /^Jami:\s*([\d\s.,\u00A0]+)\s*ta$/i,
    ru: (_, n) => `Всего: ${n.trim()}`,
    en: (_, n) => `Total: ${n.trim()}`,
  },
  {
    re: /^Sahifa\s+(\d+)\s*\/\s*(\d+)$/i,
    ru: (_, p, total) => `Стр. ${p} из ${total}`,
    en: (_, p, total) => `Page ${p} of ${total}`,
  },
];

export function translateString(raw: string, lang: Lang): string {
  if (lang === 'uz' || !raw) return raw;
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  const exact = EXACT_TRANSLATIONS[trimmed];
  if (exact) {
    const leading = raw.match(/^\s*/)?.[0] ?? '';
    const trailing = raw.match(/\s*$/)?.[0] ?? '';
    return `${leading}${exact[lang]}${trailing}`;
  }

  for (const rule of PATTERN_RULES) {
    const match = trimmed.match(rule.re);
    if (match) {
      const leading = raw.match(/^\s*/)?.[0] ?? '';
      const trailing = raw.match(/\s*$/)?.[0] ?? '';
      const out = lang === 'ru' ? rule.ru(...match) : rule.en(...match);
      return `${leading}${out}${trailing}`;
    }
  }

  return raw;
}

export function localizedName(
  item: { name_uz: string; name_ru?: string | null; name_en?: string | null } | null | undefined,
  lang: Lang,
): string {
  if (!item) return '';
  if (lang === 'ru' && item.name_ru?.trim()) return item.name_ru;
  if (lang === 'en' && item.name_en?.trim()) return item.name_en;
  return item.name_uz;
}

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (text: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'uz',
  setLang: () => {},
  t: (text) => text,
});

export function useI18n() {
  return useContext(I18nContext);
}

const originalTextMap = new WeakMap<Node, { uz: string; lastRendered: string }>();
const originalAttrMap = new WeakMap<Element, Record<string, { uz: string; lastRendered: string }>>();
const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label'] as const;

function applyDomTranslation(root: Node, lang: Lang) {
  if (typeof document === 'undefined') return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current: Node | null = walker.currentNode;

  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      const parentTag = current.parentElement?.tagName;
      if (parentTag !== 'SCRIPT' && parentTag !== 'STYLE' && parentTag !== 'CODE' && parentTag !== 'PRE') {
        const val = current.nodeValue ?? '';
        if (val.trim()) {
          const tracked = originalTextMap.get(current);
          const baseUz = !tracked || val !== tracked.lastRendered ? val : tracked.uz;
          const nextVal = lang === 'uz' ? baseUz : translateString(baseUz, lang);
          originalTextMap.set(current, { uz: baseUz, lastRendered: nextVal });
          if (current.nodeValue !== nextVal) {
            current.nodeValue = nextVal;
          }
        }
      }
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element;
      let attrRecord = originalAttrMap.get(el);
      for (const attr of TRANSLATABLE_ATTRS) {
        const val = el.getAttribute(attr);
        if (val && val.trim()) {
          if (!attrRecord) {
            attrRecord = {};
            originalAttrMap.set(el, attrRecord);
          }
          const tracked = attrRecord[attr];
          const baseUz = !tracked || val !== tracked.lastRendered ? val : tracked.uz;
          const nextVal = lang === 'uz' ? baseUz : translateString(baseUz, lang);
          attrRecord[attr] = { uz: baseUz, lastRendered: nextVal };
          if (val !== nextVal) {
            el.setAttribute(attr, nextVal);
          }
        }
      }
    }
    current = walker.nextNode();
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('uz');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved === 'uz' || saved === 'ru' || saved === 'en') {
        setLangState(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = next;
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return;
    document.documentElement.lang = lang;

    let rafId: number | null = null;
    const run = () => {
      rafId = null;
      applyDomTranslation(document.body, lang);
    };

    run();

    const observer = new MutationObserver(() => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(run);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [lang]);

  const t = useCallback((text: string) => translateString(text, lang), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const LANG_OPTIONS: { value: Lang; label: string; title: string }[] = [
  { value: 'uz', label: "O'z", title: "O'zbekcha" },
  { value: 'ru', label: 'Ру', title: 'Русский' },
  { value: 'en', label: 'En', title: 'English' },
];

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang } = useI18n();

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 ${className}`}
      role="group"
      aria-label="Tilni tanlash"
    >
      <Globe className="ml-1.5 mr-0.5 hidden h-3.5 w-3.5 text-slate-400 sm:inline" />
      {LANG_OPTIONS.map((opt) => {
        const active = lang === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLang(opt.value)}
            title={opt.title}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition-all ${
              active
                ? 'bg-white text-brand-700 shadow-xs ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
