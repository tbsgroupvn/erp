import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GeneralLedgerService } from './general-ledger.service';
import { PrismaService } from '@core/database/prisma.service';

describe('GeneralLedgerService', () => {
  let service: GeneralLedgerService;
  let prisma: PrismaService;

  const mockPrisma = {
    chartOfAccount: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    closedPeriod: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    journalEntry: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    journalEntryLine: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((queries: any[]) => Promise.all(queries)),
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneralLedgerService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<GeneralLedgerService>(GeneralLedgerService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createJournalEntry', () => {
    const validDto = {
      date: '2025-06-15',
      description: 'Record customer payment',
      reference: 'INV-202506-0001',
      entries: [
        { accountCode: '1111', debit: 1000000, credit: 0, description: 'Cash in' },
        { accountCode: '1311', debit: 0, credit: 1000000, description: 'AR reduced' },
      ],
    };

    it('should create a balanced journal entry with valid accounts and open period', async () => {
      // Arrange
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([
        { code: '1111', isActive: true },
        { code: '1311', isActive: true },
      ]);
      mockPrisma.closedPeriod.findUnique.mockResolvedValue(null); // period open
      mockPrisma.journalEntry.findFirst.mockResolvedValue(null); // no existing code
      mockPrisma.journalEntry.create.mockResolvedValue({
        id: 'je-1',
        code: 'JE-202506-0001',
        date: new Date('2025-06-15'),
        description: validDto.description,
        reference: validDto.reference,
        lines: [
          { accountCode: '1111', debit: 1000000, credit: 0, account: { code: '1111', name: 'Cash', type: 'ASSET' } },
          { accountCode: '1311', debit: 0, credit: 1000000, account: { code: '1311', name: 'AR', type: 'ASSET' } },
        ],
      });

      // Act
      const result = await service.createJournalEntry(validDto, 'user-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.code).toBe('JE-202506-0001');
      expect(result.lines).toHaveLength(2);
      expect(mockPrisma.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: validDto.description,
            isPosted: true,
            createdBy: 'user-1',
          }),
        }),
      );
    });

    it('should throw BadRequestException for unbalanced entry', async () => {
      // Arrange - debit != credit
      const unbalancedDto = {
        ...validDto,
        entries: [
          { accountCode: '1111', debit: 1000000, credit: 0 },
          { accountCode: '1311', debit: 0, credit: 500000 },
        ],
      };

      // Act & Assert
      await expect(
        service.createJournalEntry(unbalancedDto, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.createJournalEntry(unbalancedDto, 'user-1');
      } catch (e) {
        expect(e.message).toContain('unbalanced');
      }
    });

    it('should throw BadRequestException for less than 2 lines', async () => {
      // Arrange
      const singleLineDto = {
        ...validDto,
        entries: [{ accountCode: '1111', debit: 1000000, credit: 0 }],
      };

      // Act & Assert -- unbalanced check fires first for 1-line (debit != credit)
      // so we make it "balanced" with a single line debit=credit=0 scenario
      const fewLinesDto = {
        ...validDto,
        entries: [{ accountCode: '1111', debit: 500, credit: 500 }],
      };

      await expect(
        service.createJournalEntry(fewLinesDto, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.createJournalEntry(fewLinesDto, 'user-1');
      } catch (e) {
        expect(e.message).toContain('at least 2 lines');
      }
    });

    it('should throw BadRequestException for line with both debit and credit as zero', async () => {
      // Arrange - entry with both values zero
      const zeroLineDto = {
        ...validDto,
        entries: [
          { accountCode: '1111', debit: 1000000, credit: 0 },
          { accountCode: '1311', debit: 0, credit: 1000000 },
          { accountCode: '1411', debit: 0, credit: 0 },
        ],
      };

      // Act & Assert
      await expect(
        service.createJournalEntry(zeroLineDto, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.createJournalEntry(zeroLineDto, 'user-1');
      } catch (e) {
        expect(e.message).toContain('both debit and credit as zero');
      }
    });

    it('should throw NotFoundException for invalid account code', async () => {
      // Arrange - findMany returns fewer accounts than requested
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([
        { code: '1111', isActive: true },
        // '1311' is missing
      ]);

      // Act & Assert
      await expect(
        service.createJournalEntry(validDto, 'user-1'),
      ).rejects.toThrow(NotFoundException);

      try {
        await service.createJournalEntry(validDto, 'user-1');
      } catch (e) {
        expect(e.message).toContain('1311');
      }
    });

    it('should throw BadRequestException for inactive account', async () => {
      // Arrange - one account is inactive
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([
        { code: '1111', isActive: true },
        { code: '1311', isActive: false },
      ]);

      // Act & Assert
      await expect(
        service.createJournalEntry(validDto, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.createJournalEntry(validDto, 'user-1');
      } catch (e) {
        expect(e.message).toContain('inactive');
      }
    });

    it('should throw BadRequestException for closed period', async () => {
      // Arrange
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([
        { code: '1111', isActive: true },
        { code: '1311', isActive: true },
      ]);
      mockPrisma.closedPeriod.findUnique.mockResolvedValue({
        id: 'cp-1',
        year: 2025,
        month: 6,
        closedBy: 'admin',
        closedAt: new Date(),
      });

      // Act & Assert
      await expect(
        service.createJournalEntry(validDto, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.createJournalEntry(validDto, 'user-1');
      } catch (e) {
        expect(e.message).toContain('closed');
      }
    });
  });

  describe('closePeriod', () => {
    it('should close an open period successfully', async () => {
      // Arrange
      mockPrisma.closedPeriod.findUnique.mockResolvedValue(null);
      mockPrisma.closedPeriod.create.mockResolvedValue({
        id: 'cp-1',
        year: 2025,
        month: 6,
        closedBy: 'user-1',
        closedAt: new Date(),
      });

      // Act
      const result = await service.closePeriod(2025, 6, 'user-1');

      // Assert
      expect(result).toBeDefined();
      expect(result.year).toBe(2025);
      expect(result.month).toBe(6);
      expect(mockPrisma.closedPeriod.create).toHaveBeenCalledWith({
        data: { year: 2025, month: 6, closedBy: 'user-1' },
      });
    });

    it('should throw BadRequestException for already closed period', async () => {
      // Arrange
      mockPrisma.closedPeriod.findUnique.mockResolvedValue({
        id: 'cp-1',
        year: 2025,
        month: 6,
        closedBy: 'admin',
        closedAt: new Date(),
      });

      // Act & Assert
      await expect(
        service.closePeriod(2025, 6, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.closePeriod(2025, 6, 'user-1');
      } catch (e) {
        expect(e.message).toContain('already closed');
      }
    });
  });
});
