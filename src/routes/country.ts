import { Router } from 'express';
import { countryModel } from '../models/country';
import { authenticate } from '../middleware/auth';
import { rateLimiterMiddleware } from '../middleware/rateLimit';
import { sendSuccess } from '../middleware/error';
import { getRequestParam } from '../utils/requestParams';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/countries
 * @description Get all supported countries
 * @access Private
 */
router.get(
  '/',
  rateLimiterMiddleware(),
  async (req, res, _next) => {
    const countries = await countryModel.getAll();
    sendSuccess(res, { countries }, req.requestId, req.rateLimit);
  }
);

/**
 * @route GET /api/v1/countries/:code
 * @description Get country by code
 * @access Private
 */
router.get(
  '/:code',
  rateLimiterMiddleware(),
  async (req, res, _next) => {
    const codeParam = getRequestParam(req.params.code);
    const code = codeParam ? codeParam.toUpperCase() : undefined;
    if (!code) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Country code is required',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    }
    const country = await countryModel.findByCode(code);

    if (!country) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COUNTRY_NOT_FOUND',
          message: `Country ${code} not found`,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    }

    sendSuccess(res, { country }, req.requestId, req.rateLimit);
  }
);

/**
 * @route GET /api/v1/countries/continent/list
 * @description Get list of continents
 * @access Private
 */
router.get(
  '/continent/list',
  rateLimiterMiddleware(),
  async (req, res, _next) => {
    const continents = await countryModel.getContinentList();
    sendSuccess(res, { continents }, req.requestId, req.rateLimit);
  }
);

/**
 * @route GET /api/v1/countries/continent/:continent
 * @description Get countries by continent
 * @access Private
 */
router.get(
  '/continent/:continent',
  rateLimiterMiddleware(),
  async (req, res, _next) => {
    const continent = getRequestParam(req.params.continent) || '';
    const countries = await countryModel.getByContinent(continent);

    sendSuccess(
      res,
      {
        continent,
        count: countries.length,
        countries,
      },
      req.requestId,
      req.rateLimit
    );
  }
);

/**
 * @route GET /api/v1/countries/sepa
 * @description Get SEPA countries
 * @access Private
 */
router.get(
  '/sepa',
  rateLimiterMiddleware(),
  async (req, res, _next) => {
    const countries = await countryModel.getSEPACountries();
    sendSuccess(
      res,
      {
        sepa: true,
        count: countries.length,
        countries,
      },
      req.requestId,
      req.rateLimit
    );
  }
);

/**
 * @route GET /api/v1/countries/currencies
 * @description Get list of currencies
 * @access Private
 */
router.get(
  '/currencies',
  rateLimiterMiddleware(),
  async (req, res, _next) => {
    const currencies = await countryModel.getCurrencyList();
    sendSuccess(res, { currencies }, req.requestId, req.rateLimit);
  }
);

/**
 * @route GET /api/v1/countries/search
 * @description Search countries by name or code
 * @access Private
 */
router.get(
  '/search',
  rateLimiterMiddleware(),
  async (req, res, _next) => {
    const { q, limit } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Search query is required',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    }

    const countries = await countryModel.search(q, limit ? parseInt(limit as string, 10) : 50);
    sendSuccess(res, { countries }, req.requestId, req.rateLimit);
  }
);

export default router;
