/**
 * Unit Tests for Excel Export Service
 */

import { ExcelExportService } from '../../../src/services/excelExport';
import { GeneratedCardFromBIN } from '../../../src/services/cardGeneration';

describe('ExcelExportService', () => {
  describe('exportCardsToExcel', () => {
    it('should export 1 card successfully', async () => {
      const cards: GeneratedCardFromBIN[] = [
        {
          bin: '411111',
          cardNumber: '4111111111111111',
          expiryDate: '12/25',
          expiryMonth: 12,
          expiryYear: 2025,
          cvv: '123',
          bank: { name: 'Test Bank', nameLocal: 'Ngân hàng Test' },
          country: { code: 'US', name: 'United States' },
          card: { type: 'Credit', network: 'Visa' },
        },
      ];

      const buffer = await ExcelExportService.exportCardsToExcel({ cards });
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should export 10 cards successfully', async () => {
      const cards: GeneratedCardFromBIN[] = Array.from({ length: 10 }, (_, i) => ({
        bin: '411111',
        cardNumber: `411111111111${String(i).padStart(4, '0')}`,
        expiryDate: '12/25',
        expiryMonth: 12,
        expiryYear: 2025,
        cvv: '123',
        bank: { name: 'Test Bank', nameLocal: 'Ngân hàng Test' },
        country: { code: 'US', name: 'United States' },
        card: { type: 'Credit', network: 'Visa' },
      }));

      const buffer = await ExcelExportService.exportCardsToExcel({ cards });
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should export 100 cards successfully', async () => {
      const cards: GeneratedCardFromBIN[] = Array.from({ length: 100 }, (_, i) => ({
        bin: '411111',
        cardNumber: `411111111111${String(i).padStart(4, '0')}`,
        expiryDate: '12/25',
        expiryMonth: 12,
        expiryYear: 2025,
        cvv: '123',
        bank: { name: 'Test Bank', nameLocal: 'Ngân hàng Test' },
        country: { code: 'US', name: 'United States' },
        card: { type: 'Credit', network: 'Visa' },
      }));

      const buffer = await ExcelExportService.exportCardsToExcel({ cards });
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should export 1000 cards successfully', async () => {
      const cards: GeneratedCardFromBIN[] = Array.from({ length: 1000 }, (_, i) => ({
        bin: '411111',
        cardNumber: `411111111111${String(i % 10000).padStart(4, '0')}`,
        expiryDate: '12/25',
        expiryMonth: 12,
        expiryYear: 2025,
        cvv: '123',
        bank: { name: 'Test Bank', nameLocal: 'Ngân hàng Test' },
        country: { code: 'US', name: 'United States' },
        card: { type: 'Credit', network: 'Visa' },
      }));

      const buffer = await ExcelExportService.exportCardsToExcel({ cards });
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should throw error when no cards provided', async () => {
      await expect(
        ExcelExportService.exportCardsToExcel({ cards: [] })
      ).rejects.toThrow('No cards provided for export');
    });

    it('should handle missing optional fields gracefully', async () => {
      const cards: GeneratedCardFromBIN[] = [
        {
          bin: '411111',
          cardNumber: '4111111111111111',
          expiryDate: '12/25',
          expiryMonth: 12,
          expiryYear: 2025,
          cvv: '123',
        } as GeneratedCardFromBIN,
      ];

      const buffer = await ExcelExportService.exportCardsToExcel({ cards });
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
