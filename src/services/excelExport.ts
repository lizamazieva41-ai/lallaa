import ExcelJS from 'exceljs';
import { GeneratedCardFromBIN } from './cardGeneration';
import { logger } from '../utils/logger';
import { metricsService } from './metrics';

export interface ExcelExportOptions {
  cards: GeneratedCardFromBIN[];
  outputPath?: string; // Optional: if provided, save to file; otherwise return buffer
}

export class ExcelExportService {
  /**
   * Export cards to Excel format
   * Creates an Excel file with all required columns and proper formatting
   */
  public static async exportCardsToExcel(
    options: ExcelExportOptions
  ): Promise<Buffer> {
    const exportStart = Date.now();
    try {
      const { cards } = options;

      if (!cards || cards.length === 0) {
        throw new Error('No cards provided for export');
      }

      // Create a new workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Cards');

      // Define columns
      worksheet.columns = [
        { header: 'BIN', key: 'bin', width: 10 },
        { header: 'Card Number', key: 'cardNumber', width: 20 },
        { header: 'Expiry Date', key: 'expiryDate', width: 12 },
        { header: 'Expiry Month', key: 'expiryMonth', width: 12 },
        { header: 'Expiry Year', key: 'expiryYear', width: 12 },
        { header: 'CVV', key: 'cvv', width: 8 },
        { header: 'Bank Name', key: 'bankName', width: 30 },
        { header: 'Bank Name Local', key: 'bankNameLocal', width: 30 },
        { header: 'Country Code', key: 'countryCode', width: 12 },
        { header: 'Country Name', key: 'countryName', width: 25 },
        { header: 'Card Type', key: 'cardType', width: 15 },
        { header: 'Card Network', key: 'cardNetwork', width: 15 },
        { header: 'Bank Issuer Link', key: 'bankIssuerLink', width: 50 },
      ];

      // Style the header row
      worksheet.getRow(1).font = { bold: true, size: 12 };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // Add data rows
      cards.forEach((card) => {
        worksheet.addRow({
          bin: card.bin,
          cardNumber: card.cardNumber,
          expiryDate: card.expiryDate,
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          cvv: card.cvv,
          bankName: card.bank?.name || '',
          bankNameLocal: card.bank?.nameLocal || '',
          countryCode: card.country?.code || '',
          countryName: card.country?.name || '',
          cardType: card.card?.type || '',
          cardNetwork: card.card?.network || '',
          bankIssuerLink: '', // This would come from BIN lookup if available
        });
      });

      // Freeze header row
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      // Auto-fit columns (with max width limit)
      worksheet.columns.forEach((column) => {
        if (column.width && column.width > 50) {
          column.width = 50;
        }
      });

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      
      const exportDuration = (Date.now() - exportStart) / 1000;
      metricsService.recordExcelExportDuration(exportDuration);

      logger.info(`Successfully exported ${cards.length} cards to Excel format in ${exportDuration.toFixed(2)}s`);

      return Buffer.from(buffer as ArrayBuffer);
    } catch (error) {
      logger.error('Error exporting cards to Excel:', error);
      throw new Error(`Failed to export cards to Excel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export cards to Excel and save to file
   */
  public static async exportCardsToExcelFile(
    options: ExcelExportOptions & { outputPath: string }
  ): Promise<string> {
    const buffer = await this.exportCardsToExcel(options);
    const fs = await import('fs/promises');
    await fs.writeFile(options.outputPath, buffer as Buffer);
    logger.info(`Excel file saved to: ${options.outputPath}`);
    return options.outputPath;
  }
}
