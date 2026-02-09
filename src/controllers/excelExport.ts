import { Request, Response } from 'express';
import Joi from 'joi';
import { CardGenerationService, BINCardGenerationOptions } from '../services/cardGeneration';
import { ExcelExportService } from '../services/excelExport';
import { logger } from '../utils/logger';
import { ValidationError } from '../middleware/error';

// Validation schema
const exportCardsSchema = Joi.object({
  bin: Joi.string()
    .pattern(/^\d{6,8}$/)
    .required()
    .messages({
      'string.pattern.base': 'BIN must be 6-8 digits',
      'any.required': 'BIN is required',
    }),
  cardCount: Joi.number().integer().min(1).max(1000).default(10),
  expiryMonths: Joi.number().integer().min(1).max(120).default(12),
  sequential: Joi.boolean().default(false),
});

export class ExcelExportController {
  /**
   * Export cards to Excel format
   * POST /api/v1/excel/export
   */
  public async exportCards(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = exportCardsSchema.validate(req.body);

      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const { bin, cardCount, expiryMonths, sequential } = value;

      logger.info('Starting Excel export', {
        bin,
        cardCount,
        expiryMonths,
        sequential,
        requestId: req.requestId,
      });

      // Generate cards from BIN
      const cards = await CardGenerationService.generateMultipleFromBIN({
        bin,
        count: cardCount,
        expiryMonths,
        sequential,
      });

      // Export to Excel
      const excelBuffer = await ExcelExportService.exportCardsToExcel({ cards });

      // Set response headers
      const filename = `cards_${bin}_${Date.now()}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', Buffer.byteLength(excelBuffer).toString());

      // Send Excel file
      res.send(excelBuffer);

      logger.info('Excel export completed successfully', {
        bin,
        cardCount: cards.length,
        filename,
        requestId: req.requestId,
      });
    } catch (error) {
      logger.error('Failed to export cards to Excel', {
        error,
        requestId: req.requestId,
      });

      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: {
            code: error.code || 'VALIDATION_ERROR',
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'EXPORT_FAILED',
          message: 'Failed to export cards to Excel',
        },
      });
    }
  }
}

export const excelExportController = new ExcelExportController();
