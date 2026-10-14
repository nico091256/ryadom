import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateCartDto } from './cart.dto';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { user_id: userId },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            logo_url: true,
            phone: true,
            address_text: true,
            is_open: true,
            is_active: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      return {
        items: [],
        total_amount: 0,
        shop: null,
      };
    }

    // Filter out deleted products if any
    const activeItems = cart.items.filter((item) => !item.product.deleted_at);
    const totalAmount = activeItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    return {
      id: cart.id,
      shop_id: cart.shop_id,
      shop: cart.shop,
      items: activeItems.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        product: item.product,
        subtotal: item.product.price * item.quantity,
      })),
      total_amount: totalAmount,
    };
  }

  async updateCart(userId: string, dto: UpdateCartDto) {
    const existingCart = await this.prisma.cart.findUnique({
      where: { user_id: userId },
    });

    // Enforce Single-Shop Cart rule (Section 4)
    if (existingCart && existingCart.shop_id !== dto.shop_id && !dto.clearOtherShop) {
      throw new ConflictException({
        code: 'CART_MULTIPLE_SHOPS',
        message: 'Your cart already contains items from another shop. Clear existing cart to continue?',
      });
    }

    // Verify shop exists and is active
    const shop = await this.prisma.shop.findUnique({
      where: { id: dto.shop_id },
    });

    if (!shop || !shop.is_active) {
      throw new BadRequestException({
        code: 'SHOP_INACTIVE',
        message: 'The selected shop is currently inactive or unavailable.',
      });
    }

    // Upsert or clear existing cart
    let cart = existingCart;
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          user_id: userId,
          shop_id: dto.shop_id,
        },
      });
    } else if (cart.shop_id !== dto.shop_id) {
      await this.prisma.cartItem.deleteMany({ where: { cart_id: cart.id } });
      cart = await this.prisma.cart.update({
        where: { id: cart.id },
        data: { shop_id: dto.shop_id },
      });
    }

    // Replace items
    await this.prisma.cartItem.deleteMany({ where: { cart_id: cart.id } });

    if (dto.items.length > 0) {
      // Validate all products belong to shop and have stock
      const productIds = dto.items.map((i) => i.product_id);
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: productIds },
          shop_id: dto.shop_id,
          deleted_at: null,
        },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));

      for (const item of dto.items) {
        const prod = productMap.get(item.product_id);
        if (!prod) {
          throw new BadRequestException(`Product ${item.product_id} not found in this shop.`);
        }
        if (!prod.is_available || prod.stock < item.quantity) {
          throw new BadRequestException({
            code: 'OUT_OF_STOCK',
            message: `Insufficient stock for product '${prod.name_uz}'. Available: ${prod.stock}`,
          });
        }
      }

      await this.prisma.cartItem.createMany({
        data: dto.items.map((item) => ({
          cart_id: cart.id,
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      });
    }

    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { user_id: userId },
    });
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cart_id: cart.id } });
      await this.prisma.cart.delete({ where: { id: cart.id } });
    }
    return { success: true };
  }
}
