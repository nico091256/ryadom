import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto, UpdateProfileDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: {
          orderBy: { created_at: 'desc' },
        },
        shops: true,
      },
    });

    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const { password_hash, ...rest } = user;
    return rest;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.language !== undefined ? { language: dto.language } : {}),
      },
    });

    const { password_hash, ...rest } = updated;
    return rest;
  }

  // Address CRUD (Customer role)
  async getAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    // If city_id is not supplied, use default Tashkent city
    let cityId = dto.city_id;
    if (!cityId) {
      const city = await this.prisma.city.findFirst({ where: { is_active: true } });
      cityId = city ? city.id : '00000000-0000-0000-0000-000000000001';
    }

    return this.prisma.address.create({
      data: {
        user_id: userId,
        city_id: cityId,
        title: dto.title,
        address_text: dto.address_text,
        lat: dto.lat,
        lng: dto.lng,
        entrance: dto.entrance,
        floor: dto.floor,
        apartment: dto.apartment,
        door_code: dto.door_code,
      },
    });
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException({ code: 'ADDRESS_NOT_FOUND', message: 'Address not found' });
    }

    if (address.user_id !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Cannot edit an address belonging to another user' });
    }

    return this.prisma.address.update({
      where: { id: addressId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.address_text !== undefined ? { address_text: dto.address_text } : {}),
        ...(dto.lat !== undefined ? { lat: dto.lat } : {}),
        ...(dto.entrance !== undefined ? { entrance: dto.entrance } : {}),
        ...(dto.floor !== undefined ? { floor: dto.floor } : {}),
        ...(dto.apartment !== undefined ? { apartment: dto.apartment } : {}),
        ...(dto.door_code !== undefined ? { door_code: dto.door_code } : {}),
        ...(dto.lng !== undefined ? { lng: dto.lng } : {}),
      },
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException({ code: 'ADDRESS_NOT_FOUND', message: 'Address not found' });
    }

    if (address.user_id !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Cannot delete an address belonging to another user' });
    }

    await this.prisma.address.delete({
      where: { id: addressId },
    });

    return { success: true };
  }
}
