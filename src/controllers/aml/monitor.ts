import { Request, Response } from 'express';

import { amlRuleEngine } from '../../services/aml/ruleEngine';
import { amlCaseManager } from '../../services/aml/caseManager';
import { complianceReporter } from '../../services/aml/complianceReporter';
import { logger } from '../../utils/logger';

export const evaluateTransaction = (req: Request, res: Response): void => {
  try {
    const ctx = req.body || {};
    const alerts = amlRuleEngine.evaluate(ctx);
    const caseObj = alerts.length > 0 ? amlCaseManager.createCase({ alerts, userId: ctx.userId, bin: ctx.bin }) : null;

    res.status(200).json({
      success: true,
      data: {
        alerts,
        case: caseObj,
      },
    });
  } catch (error) {
    logger.error('AML evaluate transaction failed', { error });
    res.status(500).json({ success: false, message: 'AML evaluation failed' });
  }
};

export const listRules = (_req: Request, res: Response): void => {
  res.status(200).json({ success: true, data: amlRuleEngine.listRules() });
};

export const generateSAR = (req: Request, res: Response): void => {
  try {
    const caseId = String(req.params.caseId || '');
    const amlCase = amlCaseManager.getCase(caseId);
    if (!amlCase) {
      res.status(404).json({ success: false, message: 'Case not found' });
      return;
    }
    const sar = complianceReporter.generateSAR(amlCase);
    res.status(200).json({ success: true, data: sar });
  } catch (error) {
    logger.error('AML SAR generation failed', { error });
    res.status(500).json({ success: false, message: 'SAR generation failed' });
  }
};

