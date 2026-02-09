import { Request, Response } from 'express';
import Joi from 'joi';
import { workflowOrchestrator, WorkflowOptions, WorkflowResult } from '../services/workflowOrchestrator';
import { logger } from '../utils/logger';
import { ValidationError } from '../middleware/error';

// Validation schema
const startWorkflowSchema = Joi.object({
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

export class IntegrationController {
  /**
   * Start a new workflow
   * POST /api/v1/integration/workflow/start
   */
  public async startWorkflow(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = startWorkflowSchema.validate(req.body);

      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const { bin, cardCount, expiryMonths, sequential } = value;

      logger.info('Starting workflow', {
        bin,
        cardCount,
        expiryMonths,
        sequential,
        userId: req.userId,
        requestId: req.requestId,
      });

      // Execute workflow asynchronously (don't wait for completion)
      const workflowOptions: WorkflowOptions = {
        bin,
        cardCount,
        expiryMonths,
        sequential,
        onProgress: (progress) => {
          logger.info('Workflow progress', { ...progress });
        },
      };

      // Start workflow (non-blocking)
      const workflowPromise = workflowOrchestrator.executeFullWorkflow(workflowOptions);

      // For now, we'll wait for the workflow to complete
      // In production, you might want to return immediately and poll for status
      const result = await workflowPromise;

      if (result.status === 'failed') {
        res.status(500).json({
          success: false,
          error: {
            code: 'WORKFLOW_FAILED',
            message: result.errorMessage || 'Workflow execution failed',
          },
          data: {
            workflowId: result.workflowId,
            status: result.status,
          },
        });
        return;
      }

      // Return Excel file if available
      if (result.excelFileBuffer) {
        const filename = `verified_cards_${bin}_${Date.now()}.xlsx`;
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', result.excelFileBuffer.length.toString());
        res.send(result.excelFileBuffer);
      } else {
        res.json({
          success: true,
          data: {
            workflowId: result.workflowId,
            status: result.status,
            processId: result.processId,
            totalCards: result.totalCards,
            verifiedCards: result.verifiedCards,
            failedCards: result.failedCards,
            completedAt: result.completedAt,
          },
        });
      }
    } catch (error) {
      logger.error('Failed to start workflow', {
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
          code: 'WORKFLOW_START_FAILED',
          message: 'Failed to start workflow',
        },
      });
    }
  }

  /**
   * Get workflow status
   * GET /api/v1/integration/workflow/:workflowId/status
   */
  public async getWorkflowStatus(req: Request, res: Response): Promise<void> {
    try {
      const workflowIdParam = req.params.workflowId;
      const workflowId = Array.isArray(workflowIdParam) ? workflowIdParam[0] : workflowIdParam;

      if (!workflowId) {
        throw new ValidationError('Workflow ID is required');
      }

      const progress = workflowOrchestrator.getWorkflowProgress(workflowId);

      if (!progress) {
        res.status(404).json({
          success: false,
          error: {
            code: 'WORKFLOW_NOT_FOUND',
            message: 'Workflow not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: progress,
      });
    } catch (error) {
      logger.error('Failed to get workflow status', {
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
          code: 'STATUS_FETCH_FAILED',
          message: 'Failed to get workflow status',
        },
      });
    }
  }

  /**
   * Get workflow result
   * GET /api/v1/integration/workflow/:workflowId/result
   */
  public async getWorkflowResult(req: Request, res: Response): Promise<void> {
    try {
      const { workflowId } = req.params;

      if (!workflowId) {
        throw new ValidationError('Workflow ID is required');
      }

      // In a real implementation, this would query the database
      // For now, we'll return an error indicating the result is not available
      // This should be implemented with proper database storage
      res.status(501).json({
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Workflow result retrieval requires database integration',
        },
      });
    } catch (error) {
      logger.error('Failed to get workflow result', {
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
          code: 'RESULT_FETCH_FAILED',
          message: 'Failed to get workflow result',
        },
      });
    }
  }
}

export const integrationController = new IntegrationController();
