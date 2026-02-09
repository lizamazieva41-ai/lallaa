import { QueryResult } from 'pg';
import database from '../database/connection';
import { logger } from '../utils/logger';

export interface CardGateway {
  id: number;
  name: string;
  slug: string;
  docsUrl?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCard {
  id: number;
  gatewayId: number;
  brand: string;
  pan: string; // Primary Account Number (masked)
  cvc?: string;
  expiryHint?: string;
  expectedResult?: string;
  testScenario?: string;
  notes?: string;
  sourceLink?: string;
  is3dsEnrolled: boolean;
  cardType: 'credit' | 'debit' | 'prepaid';
  region?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCardWithGateway extends TestCard {
  gateway: CardGateway;
}

interface CardGatewayRow {
  id: number;
  name: string;
  slug: string;
  docs_url: string | null;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface TestCardRow {
  id: number;
  gateway_id: number;
  brand: string;
  pan: string;
  cvc: string | null;
  expiry_hint: string | null;
  expected_result: string | null;
  test_scenario: string | null;
  notes: string | null;
  source_link: string | null;
  is_3ds_enrolled: boolean;
  card_type: string;
  region: string | null;
  created_at: Date;
  updated_at: Date;
}

const mapRowToCardGateway = (row: CardGatewayRow): CardGateway => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  docsUrl: row.docs_url || undefined,
  description: row.description || undefined,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRowToTestCard = (row: TestCardRow): TestCard => ({
  id: row.id,
  gatewayId: row.gateway_id,
  brand: row.brand,
  pan: row.pan,
  cvc: row.cvc || undefined,
  expiryHint: row.expiry_hint || undefined,
  expectedResult: row.expected_result || undefined,
  testScenario: row.test_scenario || undefined,
  notes: row.notes || undefined,
  sourceLink: row.source_link || undefined,
  is3dsEnrolled: row.is_3ds_enrolled,
  cardType: row.card_type as 'credit' | 'debit' | 'prepaid',
  region: row.region || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class CardGatewayModel {
  private tableName = 'card_gateways';

  public async findAll(): Promise<CardGateway[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE is_active = true
      ORDER BY name ASC
    `;

    try {
      const result: QueryResult<CardGatewayRow> = await database.query(query);
      return result.rows.map(mapRowToCardGateway);
    } catch (error) {
      logger.error('Failed to find card gateways', { error });
      throw error;
    }
  }

  public async findBySlug(slug: string): Promise<CardGateway | null> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE slug = $1 AND is_active = true
    `;

    try {
      const result: QueryResult<CardGatewayRow> = await database.query(query, [slug]);
      if (result.rows.length === 0) {
        return null;
      }
      return mapRowToCardGateway(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find card gateway by slug', { slug, error });
      throw error;
    }
  }

  public async create(gateway: Omit<CardGateway, 'id' | 'createdAt' | 'updatedAt'>): Promise<CardGateway> {
    const query = `
      INSERT INTO ${this.tableName} (name, slug, docs_url, description, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      gateway.name,
      gateway.slug,
      gateway.docsUrl || null,
      gateway.description || null,
      gateway.isActive,
    ];

    try {
      const result: QueryResult<CardGatewayRow> = await database.query(query, values);
      return mapRowToCardGateway(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create card gateway', { name: gateway.name, error });
      throw error;
    }
  }
}

export class TestCardModel {
  private tableName = 'test_cards';

  public async findByGateway(gatewayId: number): Promise<TestCard[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE gateway_id = $1
      ORDER BY brand ASC, pan ASC
    `;

    try {
      const result: QueryResult<TestCardRow> = await database.query(query, [gatewayId]);
      return result.rows.map(mapRowToTestCard);
    } catch (error) {
      logger.error('Failed to find test cards by gateway', { gatewayId, error });
      throw error;
    }
  }

  public async search(params: {
    gatewaySlug?: string;
    brand?: string;
    expectedResult?: string;
    is3dsEnrolled?: boolean;
    cardType?: string;
    region?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ cards: TestCardWithGateway[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.gatewaySlug) {
      conditions.push(`cg.slug = $${paramIndex}`);
      values.push(params.gatewaySlug);
      paramIndex++;
    }

    if (params.brand) {
      conditions.push(`tc.brand = $${paramIndex}`);
      values.push(params.brand);
      paramIndex++;
    }

    if (params.expectedResult) {
      conditions.push(`tc.expected_result ILIKE $${paramIndex}`);
      values.push(`%${params.expectedResult}%`);
      paramIndex++;
    }

    if (params.is3dsEnrolled !== undefined) {
      conditions.push(`tc.is_3ds_enrolled = $${paramIndex}`);
      values.push(params.is3dsEnrolled);
      paramIndex++;
    }

    if (params.cardType) {
      conditions.push(`tc.card_type = $${paramIndex}`);
      values.push(params.cardType);
      paramIndex++;
    }

    if (params.region) {
      conditions.push(`tc.region = $${paramIndex}`);
      values.push(params.region);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${this.tableName} tc
      JOIN card_gateways cg ON tc.gateway_id = cg.id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT 
        tc.*,
        cg.id as gateway_id,
        cg.name as gateway_name,
        cg.slug as gateway_slug,
        cg.docs_url as gateway_docs_url,
        cg.description as gateway_description,
        cg.is_active as gateway_is_active,
        cg.created_at as gateway_created_at,
        cg.updated_at as gateway_updated_at
      FROM ${this.tableName} tc
      JOIN card_gateways cg ON tc.gateway_id = cg.id
      ${whereClause}
      ORDER BY cg.name ASC, tc.brand ASC, tc.pan ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    try {
      const limit = params.limit || 50;
      const offset = params.offset || 0;

      const [countResult, dataResult] = await Promise.all([
        database.query<{ total: string }>(countQuery, values),
        database.query(dataQuery, [...values, limit, offset]),
      ]);

      const cardsWithGateway = dataResult.rows.map((row: any) => {
        const testCard: TestCard = {
          id: row.id,
          gatewayId: row.gateway_id,
          brand: row.brand,
          pan: row.pan,
          cvc: row.cvc,
          expiryHint: row.expiry_hint,
          expectedResult: row.expected_result,
          testScenario: row.test_scenario,
          notes: row.notes,
          sourceLink: row.source_link,
          is3dsEnrolled: row.is_3ds_enrolled,
          cardType: row.card_type,
          region: row.region,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };

        const gateway: CardGateway = {
          id: row.gateway_id,
          name: row.gateway_name,
          slug: row.gateway_slug,
          docsUrl: row.gateway_docs_url,
          description: row.gateway_description,
          isActive: row.gateway_is_active,
          createdAt: row.gateway_created_at,
          updatedAt: row.gateway_updated_at,
        };

        return { ...testCard, gateway };
      });

      return {
        cards: cardsWithGateway,
        total: parseInt(countResult.rows[0].total, 10),
      };
    } catch (error) {
      logger.error('Failed to search test cards', { params, error });
      throw error;
    }
  }

  public async create(card: Omit<TestCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestCard> {
    // Log values for debugging
    logger.debug('Creating test card with values', {
      brand: card.brand,
      pan: card.pan,
      cvc: card.cvc,
      cardType: card.cardType,
      brandLength: card.brand?.length,
      panLength: card.pan?.length,
      cvcLength: card.cvc?.length,
      cardTypeLength: card.cardType?.length,
    });

    const query = `
      INSERT INTO ${this.tableName} (
        gateway_id, brand, pan, cvc, expiry_hint, expected_result,
        test_scenario, notes, source_link, is_3ds_enrolled, card_type, region
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      card.gatewayId,
      card.brand,
      card.pan,
      card.cvc || null,
      card.expiryHint || null,
      card.expectedResult || null,
      card.testScenario || null,
      card.notes || null,
      card.sourceLink || null,
      card.is3dsEnrolled,
      card.cardType,
      card.region || null,
    ];

    try {
      const result: QueryResult<TestCardRow> = await database.query(query, values);
      return mapRowToTestCard(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create test card', { pan: card.pan, error });
      throw error;
    }
  }

  public async bulkCreate(cards: Omit<TestCard, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<TestCard[]> {
    if (cards.length === 0) {
      return [];
    }

    try {
      const results: TestCard[] = [];
      for (const card of cards) {
        try {
          const createdCard = await this.create(card);
          results.push(createdCard);
        } catch (error) {
          const code = (error as { code?: string }).code;
          if (code === '23505') {
            logger.debug('Skipped duplicate test card', {
              gatewayId: card.gatewayId,
              pan: card.pan,
            });
            continue;
          }
          throw error;
        }
      }
      return results;
    } catch (error) {
      logger.error('Failed to bulk create test cards', { count: cards.length, error });
      throw error;
    }
  }

  public async getStatistics(): Promise<{
    totalCards: number;
    totalGateways: number;
    cardsByGateway: Record<string, number>;
    cardsByBrand: Record<string, number>;
    cardsByResult: Record<string, number>;
  }> {
    const totalQuery = `
      SELECT 
        COUNT(DISTINCT tc.id) as total_cards,
        COUNT(DISTINCT tc.gateway_id) as total_gateways
      FROM ${this.tableName} tc
      JOIN card_gateways cg ON tc.gateway_id = cg.id
      WHERE cg.is_active = true
    `;

    const byGatewayQuery = `
      SELECT cg.name, COUNT(tc.id) as count
      FROM ${this.tableName} tc
      JOIN card_gateways cg ON tc.gateway_id = cg.id
      WHERE cg.is_active = true
      GROUP BY cg.name
      ORDER BY count DESC
    `;

    const byBrandQuery = `
      SELECT brand, COUNT(*) as count
      FROM ${this.tableName} tc
      JOIN card_gateways cg ON tc.gateway_id = cg.id
      WHERE cg.is_active = true
      GROUP BY brand
      ORDER BY count DESC
    `;

    const byResultQuery = `
      SELECT expected_result, COUNT(*) as count
      FROM ${this.tableName} tc
      JOIN card_gateways cg ON tc.gateway_id = cg.id
      WHERE cg.is_active = true AND expected_result IS NOT NULL
      GROUP BY expected_result
      ORDER BY count DESC
    `;

    try {
      const [totalResult, gatewayResult, brandResult, resultResult] = await Promise.all([
        database.query<{ total_cards: string; total_gateways: string }>(totalQuery),
        database.query<{ name: string; count: string }>(byGatewayQuery),
        database.query<{ brand: string; count: string }>(byBrandQuery),
        database.query<{ expected_result: string; count: string }>(byResultQuery),
      ]);

      const { total_cards, total_gateways } = totalResult.rows[0];

      return {
        totalCards: parseInt(total_cards, 10),
        totalGateways: parseInt(total_gateways, 10),
        cardsByGateway: Object.fromEntries(
          gatewayResult.rows.map((row) => [row.name, parseInt(row.count, 10)])
        ),
        cardsByBrand: Object.fromEntries(
          brandResult.rows.map((row) => [row.brand, parseInt(row.count, 10)])
        ),
        cardsByResult: Object.fromEntries(
          resultResult.rows.map((row) => [row.expected_result, parseInt(row.count, 10)])
        ),
      };
    } catch (error) {
      logger.error('Failed to get test card statistics', { error });
      throw error;
    }
  }
}

export const cardGatewayModel = new CardGatewayModel();
export const testCardModel = new TestCardModel();
