import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateVaccineDto } from './dto/create-vaccine.dto';
import { ListVaccinesQueryDto } from './dto/list-vaccines-query.dto';
import { UpdateVaccineDto } from './dto/update-vaccine.dto';

const PROTOCOL_ORDER = { doseNumber: 'asc' } as const;

@Injectable()
export class VaccinesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVaccineDto) {
    return this.prisma.vaccine.create({
      data: {
        name: dto.name,
        manufacturer: dto.manufacturer,
        species: dto.species,
        description: dto.description,
        protocols: dto.protocols?.length
          ? { create: dto.protocols }
          : undefined,
      },
      include: { protocols: { orderBy: PROTOCOL_ORDER } },
    });
  }

  async findAll(query: ListVaccinesQueryDto) {
    const where: Prisma.VaccineWhereInput = {
      ...(query.species && { species: { has: query.species } }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };

    return this.prisma.vaccine.findMany({
      where,
      include: { protocols: { orderBy: PROTOCOL_ORDER } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const vaccine = await this.prisma.vaccine.findUnique({
      where: { id },
      include: { protocols: { orderBy: PROTOCOL_ORDER } },
    });

    if (!vaccine) {
      throw new NotFoundException('Vacina não encontrada');
    }

    return vaccine;
  }

  async update(id: string, dto: UpdateVaccineDto) {
    await this.findOne(id);

    return this.prisma.vaccine.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.manufacturer !== undefined && {
          manufacturer: dto.manufacturer,
        }),
        ...(dto.species && { species: dto.species }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { protocols: { orderBy: PROTOCOL_ORDER } },
    });
  }
}
