import { WalletPdfService } from './wallet-pdf.service';

describe('WalletPdfService', () => {
  let service: WalletPdfService;

  beforeEach(() => {
    service = new WalletPdfService();
  });

  const basePet = {
    id: 'pet-1',
    publicCode: 'PET-A1B2C3',
    name: 'Thor',
    species: 'dog',
    breed: 'SRD',
    birthDate: new Date('2020-01-01'),
    photoUrl: null,
  };

  it('gera um PDF válido quando não há histórico', async () => {
    const buffer = await service.generate({
      pet: basePet,
      summary: {
        status: 'unknown',
        totalApplied: 0,
        totalPending: 0,
        totalOverdue: 0,
      },
      entries: [],
    } as unknown as Parameters<WalletPdfService['generate']>[0]);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('gera um PDF válido com entradas de vacinação e prescrição', async () => {
    const buffer = await service.generate({
      pet: basePet,
      summary: {
        status: 'pending',
        totalApplied: 1,
        totalPending: 1,
        totalOverdue: 0,
      },
      entries: [
        {
          type: 'vaccination',
          id: 'vac-1',
          vaccine: { id: 'vaccine-1', name: 'V10', manufacturer: null },
          doseNumber: 1,
          status: 'confirmed',
          appliedAt: new Date('2026-01-10'),
          batchNumber: 'LOT1',
          batchExpiry: new Date('2027-01-10'),
          nextDoseAt: new Date('2026-02-10'),
          veterinarian: { fullName: 'Dr. Ricardo', crmv: 'SP-12345' },
          clinic: { tradeName: 'PetCare', cnpj: '12345678000199' },
          certificateUrl: null,
          qrCodeToken: 'abc123',
        },
        {
          type: 'prescription',
          id: 'presc-1',
          vaccine: { id: 'vaccine-2', name: 'Antirrábica' },
          doseNumber: 2,
          status: 'pending',
          scheduledAt: new Date('2026-09-15'),
          prescribedAt: new Date('2026-07-27'),
        },
      ],
    } as unknown as Parameters<WalletPdfService['generate']>[0]);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(0);
  });
});
