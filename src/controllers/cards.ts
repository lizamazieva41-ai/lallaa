import { Request, Response } from 'express';
import { CardGenerationService, BINCardGenerationOptions } from '../services/cardGeneration';
import { cardGatewayModel, testCardModel } from '../models/testCard';
import { logger } from '../utils/logger';
import { getRequestParam } from '../utils/requestParams';
import { cardGenerationQueueService } from '../services/cardGenerationQueue';

export class CardController {
  // Credit Card Generation endpoints
  public async generateCards(req: Request, res: Response): Promise<void> {
    try {
      const { vendor, count = 1 } = req.query;

      if (!vendor || typeof vendor !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_VENDOR',
            message: 'Vendor parameter is required',
            supportedVendors: CardGenerationService.getSupportedVendors(),
          },
        });
        return;
      }

      const countNum = parseInt(count as string, 10);
      if (isNaN(countNum) || countNum < 1 || countNum > 100) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_COUNT',
            message: 'Count must be between 1 and 100',
          },
        });
        return;
      }

      const cards = countNum === 1 
        ? [CardGenerationService.generateSingle({ vendor })]
        : CardGenerationService.generateMultiple({ vendor, count: countNum });

      res.json({
        success: true,
        data: {
          cards,
          vendor,
          count: cards.length,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to generate cards', { error, requestId: req.requestId });
      
      if (error instanceof Error && error.message.includes('Unsupported vendor')) {
        res.status(400).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_VENDOR',
            message: error.message,
            supportedVendors: CardGenerationService.getSupportedVendors(),
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: 'Failed to generate credit cards',
        },
      });
    }
  }

  public async getSupportedVendors(req: Request, res: Response): Promise<void> {
    try {
      const vendors = CardGenerationService.getSupportedVendors();

      res.json({
        success: true,
        data: {
          vendors,
          count: vendors.length,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to get supported vendors', { error, requestId: req.requestId });
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch supported vendors',
        },
      });
    }
  }

  // Test Payment Cards endpoints
  public async getGateways(req: Request, res: Response): Promise<void> {
    try {
      const gateways = await cardGatewayModel.findAll();

      res.json({
        success: true,
        data: {
          gateways,
          count: gateways.length,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to get gateways', { error, requestId: req.requestId });
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch payment gateways',
        },
      });
    }
  }

  public async getGatewayBySlug(req: Request, res: Response): Promise<void> {
    try {
      const slug = getRequestParam(req.params.slug);

      if (!slug) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SLUG',
            message: 'Gateway slug is required',
          },
        });
        return;
      }

      const gateway = await cardGatewayModel.findBySlug(slug);

      if (!gateway) {
        res.status(404).json({
          success: false,
          error: {
            code: 'GATEWAY_NOT_FOUND',
            message: `Gateway '${slug}' not found`,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          gateway,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to get gateway', { error, requestId: req.requestId });
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch gateway',
        },
      });
    }
  }

  public async getTestCards(req: Request, res: Response): Promise<void> {
    try {
      const {
        gatewaySlug,
        brand,
        expectedResult,
        is3dsEnrolled,
        cardType,
        region,
        limit = 50,
        offset = 0,
      } = req.query;

      const searchParams: any = {};

      if (gatewaySlug && typeof gatewaySlug === 'string') {
        searchParams.gatewaySlug = gatewaySlug;
      }
      if (brand && typeof brand === 'string') {
        searchParams.brand = brand;
      }
      if (expectedResult && typeof expectedResult === 'string') {
        searchParams.expectedResult = expectedResult;
      }
      if (is3dsEnrolled !== undefined) {
        searchParams.is3dsEnrolled = is3dsEnrolled === 'true';
      }
      if (cardType && typeof cardType === 'string') {
        searchParams.cardType = cardType;
      }
      if (region && typeof region === 'string') {
        searchParams.region = region;
      }

      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);

      if (!isNaN(limitNum) && limitNum > 0) {
        searchParams.limit = Math.min(limitNum, 100); // Cap at 100
      }
      if (!isNaN(offsetNum) && offsetNum >= 0) {
        searchParams.offset = offsetNum;
      }

      const result = await testCardModel.search(searchParams);

      res.json({
        success: true,
        data: {
          cards: result.cards,
          pagination: {
            total: result.total,
            limit: searchParams.limit || 50,
            offset: searchParams.offset || 0,
            hasMore: result.total > (searchParams.offset || 0) + (searchParams.limit || 50),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to search test cards', { error, requestId: req.requestId });
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: 'Failed to search test cards',
        },
      });
    }
  }

  public async getTestCardsByGateway(req: Request, res: Response): Promise<void> {
    try {
      const slug = getRequestParam(req.params.slug);
      const { limit = 50, offset = 0 } = req.query;

      if (!slug) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SLUG',
            message: 'Gateway slug is required',
          },
        });
        return;
      }

      const gateway = await cardGatewayModel.findBySlug(slug);
      if (!gateway) {
        res.status(404).json({
          success: false,
          error: {
            code: 'GATEWAY_NOT_FOUND',
            message: `Gateway '${slug}' not found`,
          },
        });
        return;
      }

      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);

      const result = await testCardModel.search({
        gatewaySlug: slug,
        limit: !isNaN(limitNum) && limitNum > 0 ? Math.min(limitNum, 100) : 50,
        offset: !isNaN(offsetNum) && offsetNum >= 0 ? offsetNum : 0,
      });

      res.json({
        success: true,
        data: {
          gateway,
          cards: result.cards,
          pagination: {
            total: result.total,
            limit: !isNaN(limitNum) && limitNum > 0 ? Math.min(limitNum, 100) : 50,
            offset: !isNaN(offsetNum) && offsetNum >= 0 ? offsetNum : 0,
            hasMore: result.total > (!isNaN(offsetNum) && offsetNum >= 0 ? offsetNum : 0) + 
                    (!isNaN(limitNum) && limitNum > 0 ? Math.min(limitNum, 100) : 50),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to get test cards by gateway', { error, requestId: req.requestId });
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch test cards for gateway',
        },
      });
    }
  }

  public async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const [cardStats, testCardStats] = await Promise.all([
        // Get card generation stats
        Promise.resolve({
          supportedVendors: CardGenerationService.getSupportedVendors(),
          vendorCount: CardGenerationService.getSupportedVendors().length,
        }),
        // Get test card stats
        testCardModel.getStatistics(),
      ]);

      res.json({
        success: true,
        data: {
          cardGeneration: cardStats,
          testCards: testCardStats,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to get statistics', { error, requestId: req.requestId });
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_FAILED',
          message: 'Failed to fetch statistics',
        },
      });
    }
  }

  // Generate card from BIN endpoint
  public async generateCardFromBIN(req: Request, res: Response): Promise<void> {
    try {
      const { bin, expiryMonths, count, sequential, startSequence, cvv, generate999 } = req.body;

      if (!bin || typeof bin !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_BIN',
            message: 'BIN parameter is required',
          },
        });
        return;
      }

      // Validate BIN format
      const normalizedBin = bin.replace(/\s/g, '').replace(/-/g, '');
      if (!/^\d{6,8}$/.test(normalizedBin)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_BIN',
            message: 'BIN must be 6-8 digits',
          },
        });
        return;
      }

      // Validate expiryMonths if provided
      if (expiryMonths !== undefined) {
        const expiryMonthsNum = parseInt(expiryMonths as string, 10);
        if (isNaN(expiryMonthsNum) || expiryMonthsNum < 1 || expiryMonthsNum > 120) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_EXPIRY_MONTHS',
              message: 'Expiry months must be between 1 and 120',
            },
          });
          return;
        }
      }

      // Validate CVV if provided
      if (cvv !== undefined) {
        if (typeof cvv !== 'string' || !/^\d{3,4}$/.test(cvv)) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_CVV',
              message: 'CVV must be 3 or 4 digits',
            },
          });
          return;
        }
      }

      // Get user context for audit logging
      const userId = req.user?.userId || req.userId;
      const apiKeyId = req.apiKeyId;
      const requestId = req.requestId;

      // Special case: Generate 999 cards with CVV 001-999
      if (generate999 === true) {
        const cards = await CardGenerationService.generateAndSave999CardsWithCVV({
          bin: normalizedBin,
          expiryMonths: expiryMonths ? parseInt(expiryMonths as string, 10) : undefined,
          userId,
          apiKeyId,
          requestId,
        });

        res.json({
          success: true,
          data: {
            cards,
            count: cards.length,
            note: `Generated ${cards.length} cards with CVV from 001 to ${cards.length.toString().padStart(3, '0')}`,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
        return;
      }

      // Generate card(s) with storage and deduplication
      const options: BINCardGenerationOptions = {
        bin: normalizedBin,
        expiryMonths: expiryMonths ? parseInt(expiryMonths as string, 10) : undefined,
        sequential: sequential === true,
        startSequence: startSequence !== undefined ? parseInt(startSequence as string, 10) : undefined,
        cvv: cvv as string | undefined,
      };

      let cards;
      if (count && parseInt(count as string, 10) > 1) {
        const countNum = Math.min(parseInt(count as string, 10), 10);
        cards = await CardGenerationService.generateAndSaveMultipleFromBIN({
          ...options,
          count: countNum,
          userId,
          apiKeyId,
          requestId,
        });
      } else {
        const card = await CardGenerationService.generateAndSaveFromBIN({
          ...options,
          userId,
          apiKeyId,
          requestId,
        });
        cards = [card];
      }

      res.json({
        success: true,
        data: {
          cards,
          count: cards.length,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to generate card from BIN', { error, requestId: req.requestId });
      
      if (error instanceof Error) {
        if (error.message.includes('Invalid BIN') || error.message.includes('too long') || error.message.includes('Invalid CVV')) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: error.message,
            },
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: 'Failed to generate card from BIN',
        },
      });
    }
  }

  // Async Job Endpoints
  public async generateCardsAsync(req: Request, res: Response): Promise<void> {
    try {
      const {
        bin,
        count = 1,
        expiryMonths = 12,
        sequential = false,
        startSequence = 0,
        generate999 = false,
      } = req.body;

      if (!bin || typeof bin !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_BIN',
            message: 'BIN parameter is required',
          },
        });
        return;
      }

      const countNum = parseInt(count as string, 10);
      if (isNaN(countNum) || countNum < 1) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_COUNT',
            message: 'Count must be a positive integer',
          },
        });
        return;
      }

      // Determine generation mode
      let generationMode: 'random' | 'sequential' | 'batch_999' = 'random';
      if (generate999) {
        generationMode = 'batch_999';
      } else if (sequential) {
        generationMode = 'sequential';
      }

      // Create async job
      const job = await cardGenerationQueueService.createGenerationJob({
        bin,
        count: generate999 ? 999 : countNum,
        expiryMonths: parseInt(expiryMonths as string, 10) || 12,
        sequential: sequential === true,
        startSequence: parseInt(startSequence as string, 10) || 0,
        userId: req.userId,
        apiKeyId: req.apiKeyId,
        requestId: req.requestId,
        generationMode,
      });

      res.status(202).json({
        success: true,
        data: {
          jobId: job.jobId,
          status: job.status,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to create async generation job', {
        error,
        requestId: req.requestId,
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'JOB_CREATION_FAILED',
          message: 'Failed to create card generation job',
        },
      });
    }
  }

  public async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const jobId = getRequestParam(req.params.jobId);

      if (!jobId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_JOB_ID',
            message: 'Job ID is required',
          },
        });
        return;
      }

      const status = await cardGenerationQueueService.getJobStatus(jobId);

      if (!status) {
        res.status(404).json({
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          jobId: status.jobId,
          status: status.status,
          progress: status.progress,
          createdAt: status.createdAt,
          processedAt: status.processedAt,
          finishedAt: status.finishedAt,
          error: status.error,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to get job status', { error, requestId: req.requestId });
      res.status(500).json({
        success: false,
        error: {
          code: 'STATUS_FETCH_FAILED',
          message: 'Failed to get job status',
        },
      });
    }
  }

  public async getJobResult(req: Request, res: Response): Promise<void> {
    try {
      const jobId = getRequestParam(req.params.jobId);

      if (!jobId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_JOB_ID',
            message: 'Job ID is required',
          },
        });
        return;
      }

      const result = await cardGenerationQueueService.getJobResult(jobId);

      res.json({
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      logger.error('Failed to get job result', { error, requestId: req.requestId });
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: error.message,
          },
        });
        return;
      }

      if (error instanceof Error && error.message.includes('not completed')) {
        res.status(400).json({
          success: false,
          error: {
            code: 'JOB_NOT_COMPLETED',
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'RESULT_FETCH_FAILED',
          message: 'Failed to get job result',
        },
      });
    }
  }
}

export const cardController = new CardController();
