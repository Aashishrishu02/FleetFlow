import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePartnerDto } from './dto/create-partner.dto.js';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import { ShipmentStatus, PartnerType, VehicleType, PartnerStatus } from '../generated/prisma/enums.js';

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // 1. CREATE DELIVERY PARTNER
  // ============================================================================
  async createPartner(organizationId: string, dto: CreatePartnerDto) {
    const existing = await this.prisma.deliveryPartner.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code: dto.code.toUpperCase(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Delivery partner with code '${dto.code}' already exists`);
    }

    const partnerType = dto.partnerType || PartnerType.CARRIER_3PL;
    const serviceableRegions = dto.serviceableRegions || ['Global', 'North America'];
    const maxActiveShipments = dto.maxActiveShipments || dto.activeCapacity || 50;

    return this.prisma.deliveryPartner.create({
      data: {
        organizationId,
        name: dto.name,
        code: dto.code.toUpperCase(),
        partnerType,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        serviceableRegions,
        maxActiveShipments,
        status: 'ACTIVE',
      },
      include: {
        vehicles: true,
      },
    });
  }

  // ============================================================================
  // 2. LIST DELIVERY PARTNERS
  // ============================================================================
  async findAll(organizationId: string) {
    return this.prisma.deliveryPartner.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        vehicles: true,
        _count: {
          select: {
            shipments: {
              where: {
                status: {
                  in: [
                    ShipmentStatus.READY_FOR_PICKUP,
                    ShipmentStatus.PICKED_UP,
                    ShipmentStatus.IN_TRANSIT,
                    ShipmentStatus.OUT_FOR_DELIVERY,
                  ],
                },
              },
            },
          },
        },
      },
    });
  }

  // ============================================================================
  // 3. GET PARTNER DETAILS
  // ============================================================================
  async findOne(organizationId: string, id: string) {
    const partner = await this.prisma.deliveryPartner.findFirst({
      where: { id, organizationId },
      include: {
        vehicles: true,
        shipments: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!partner) {
      throw new NotFoundException('Delivery partner not found');
    }

    return partner;
  }

  // ============================================================================
  // 4. ADD VEHICLE TO PARTNER
  // ============================================================================
  async addVehicle(organizationId: string, partnerId: string, dto: CreateVehicleDto) {
    const partner = await this.findOne(organizationId, partnerId);

    const vehicleNumber = dto.vehicleNumber || dto.licensePlate || `VEH-${Date.now().toString().slice(-4)}`;
    const weightKg = dto.maxWeightCapacityKg || dto.capacityKg || 15000;
    
    // Map string types if needed
    let vehicleType: VehicleType = VehicleType.TRAILER_53FT;
    if (dto.vehicleType && Object.values(VehicleType).includes(dto.vehicleType as VehicleType)) {
      vehicleType = dto.vehicleType as VehicleType;
    }

    const vehicle = await this.prisma.vehicle.create({
      data: {
        deliveryPartnerId: partner.id,
        vehicleNumber,
        vehicleType,
        maxWeightCapacityKg: new Prisma.Decimal(weightKg),
        maxVolumeCubicMeters: dto.maxVolumeCubicMeters
          ? new Prisma.Decimal(dto.maxVolumeCubicMeters)
          : null,
        status: 'AVAILABLE',
        currentLocation: dto.currentLocation,
      },
    });

    return vehicle;
  }

  // ============================================================================
  // 5. GET DISPATCH CONSOLE METRICS
  // ============================================================================
  async getDispatchOverview(organizationId: string) {
    const [totalActiveDispatches, partnerFleet, readyShipments, inTransitShipments] =
      await Promise.all([
        this.prisma.shipment.count({
          where: {
            organizationId,
            status: { in: [ShipmentStatus.READY_FOR_PICKUP, ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT, ShipmentStatus.OUT_FOR_DELIVERY] },
          },
        }),
        this.prisma.deliveryPartner.findMany({
          where: { organizationId, status: 'ACTIVE' },
          include: {
            vehicles: true,
            _count: {
              select: {
                shipments: {
                  where: {
                    status: {
                      in: [
                        ShipmentStatus.READY_FOR_PICKUP,
                        ShipmentStatus.PICKED_UP,
                        ShipmentStatus.IN_TRANSIT,
                        ShipmentStatus.OUT_FOR_DELIVERY,
                      ],
                    },
                  },
                },
              },
            },
          },
        }),
        this.prisma.shipment.findMany({
          where: { organizationId, status: ShipmentStatus.READY_FOR_PICKUP },
          take: 5,
          include: { warehouse: true, deliveryPartner: true },
        }),
        this.prisma.shipment.findMany({
          where: { organizationId, status: ShipmentStatus.IN_TRANSIT },
          take: 5,
          include: { warehouse: true, deliveryPartner: true },
        }),
      ]);

    const totalFleetCapacity = partnerFleet.reduce((acc, p) => acc + p.maxActiveShipments, 0);
    const capacityUtilization =
      totalFleetCapacity > 0 ? (totalActiveDispatches / totalFleetCapacity) * 100 : 0;

    return {
      totalActiveDispatches,
      fleetCapacityUtilization: Number(capacityUtilization.toFixed(1)),
      dispatchExceptionsCount: 0,
      averageTurnaroundMin: 28.4,
      partnerFleet: partnerFleet.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        activeShipments: p._count.shipments,
        capacity: p.maxActiveShipments,
        onTimeRate: Number(p.onTimeRate),
        vehicleCount: p.vehicles.length,
      })),
      pendingPickup: readyShipments,
      inTransit: inTransitShipments,
    };
  }

  // ============================================================================
  // 6. DELETE PARTNER (Admin / Owner privilege)
  // ============================================================================
  async deletePartner(organizationId: string, id: string) {
    const partner = await this.prisma.deliveryPartner.findFirst({
      where: { id, organizationId },
      include: {
        shipments: {
          where: {
            status: {
              in: [
                ShipmentStatus.READY_FOR_PICKUP,
                ShipmentStatus.PICKED_UP,
                ShipmentStatus.IN_TRANSIT,
                ShipmentStatus.OUT_FOR_DELIVERY,
              ],
            },
          },
        },
      },
    });

    if (!partner) {
      throw new NotFoundException('Delivery partner not found');
    }

    if (partner.shipments && partner.shipments.length > 0) {
      throw new BadRequestException('Cannot delete carrier with active assigned consignments in transit');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.vehicle.deleteMany({ where: { deliveryPartnerId: id } });
      await tx.deliveryPartner.delete({ where: { id } });
    });

    return { success: true, message: `Delivery partner ${partner.name} deleted successfully` };
  }

  // ============================================================================
  // 7. DELETE FLEET VEHICLE (Admin / Owner privilege)
  // ============================================================================
  async deleteVehicle(organizationId: string, partnerId: string, vehicleId: string) {
    const partner = await this.prisma.deliveryPartner.findFirst({
      where: { id: partnerId, organizationId },
    });

    if (!partner) {
      throw new NotFoundException('Delivery partner not found');
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, deliveryPartnerId: partnerId },
    });

    if (!vehicle) {
      throw new NotFoundException('Fleet vehicle not found in specified carrier');
    }

    await this.prisma.vehicle.delete({ where: { id: vehicleId } });
    return { success: true, message: `Vehicle ${vehicle.vehicleNumber} deleted successfully` };
  }

  // ============================================================================
  // 8. UPDATE DELIVERY PARTNER
  // ============================================================================
  async updatePartner(
    organizationId: string,
    id: string,
    dto: {
      name?: string;
      contactEmail?: string;
      contactPhone?: string;
      partnerType?: PartnerType;
      serviceableRegions?: string[];
      maxActiveShipments?: number;
      status?: PartnerStatus;
    },
  ) {
    const partner = await this.prisma.deliveryPartner.findFirst({
      where: { id, organizationId },
    });

    if (!partner) {
      throw new NotFoundException('Delivery partner not found');
    }

    return this.prisma.deliveryPartner.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.contactEmail !== undefined ? { contactEmail: dto.contactEmail } : {}),
        ...(dto.contactPhone !== undefined ? { contactPhone: dto.contactPhone } : {}),
        ...(dto.partnerType ? { partnerType: dto.partnerType } : {}),
        ...(dto.serviceableRegions ? { serviceableRegions: dto.serviceableRegions } : {}),
        ...(dto.maxActiveShipments !== undefined ? { maxActiveShipments: dto.maxActiveShipments } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: {
        vehicles: true,
      },
    });
  }
}

