import { QueryResult } from 'pg';
import database from '../database/connection';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface GeneratedCard {
  id: string;
  cardNumber: string;
  bin: string;
  expiryDate: string; // MM/YY format
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  bankName?: string;
  bankNameLocal?: string;
  countryCode?: string;
  countryName?: string;
  cardType?: string;
  cardNetwork?: string;
  generationMode: 'random' | 'sequential' | 'batch_999';
  sequenceNumber?: number;
  isSequential: boolean;
  userId?: string;
  apiKeyId?: string;
  requestId?: string;
  cardHash: string;
  generatedAt: Date;
  createdAt: Date;
  generationDate: Date;
}

export interface CreateGeneratedCardInput {
  cardNumber: string;
  bin: string;
  expiryDate: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  bankName?: string;
  bankNameLocal?: string;
  countryCode?: string;
  countryName?: string;
  cardType?: string;
  cardNetwork?: string;
  generationMode: 'random' | 'sequential' | 'batch_999';
  sequenceNumber?: number;
  isSequential?: boolean;
  userId?: string;
  apiKeyId?: string;
  requestId?: string;
}

interface GeneratedCardRow {
  id: string;
  card_number: string;
  bin: string;
  expiry_date: string;
  expiry_month: string;
  expiry_year: string;
  cvv: string;
  bank_name: string | null;
  bank_name_local: string | null;
  country_code: string | null;
  country_name: string | null;
  card_type: string | null;
  card_network: string | null;
  generation_mode: string;
  sequence_number: number | null;
  is_sequential: boolean;
  user_id: string | null;
  api_key_id: string | null;
  request_id: string | null;
  card_hash: string;
  generated_at: Date;
  created_at: Date;
  generation_date: Date;
}

const mapRowToGeneratedCard = (row: GeneratedCardRow): GeneratedCard => ({
  id: row.id,
  cardNumber: row.card_number,
  bin: row.bin,
  expiryDate: row.expiry_date,
  expiryMonth: row.expiry_month,
  expiryYear: row.expiry_year,
  cvv: row.cvv,
  bankName: row.bank_name || undefined,
  bankNameLocal: row.bank_name_local || undefined,
  countryCode: row.country_code || undefined,
  countryName: row.country_name || undefined,
  cardType: row.card_type || undefined,
  cardNetwork: row.card_network || undefined,
  generationMode: row.generation_mode as 'random' | 'sequential' | 'batch_999',
  sequenceNumber: row.sequence_number || undefined,
  isSequential: row.is_sequential,
  userId: row.user_id || undefined,
  apiKeyId: row.api_key_id || undefined,
  requestId: row.request_id || undefined,
  cardHash: row.card_hash,
  generatedAt: row.generated_at,
  createdAt: row.created_at,
  generationDate: row.generation_date,
});

/**
 * Calculate SHA-256 hash for deduplication
 */
export function calculateCardHash(cardNumber: string, expiryDate: string, cvv: string): string {
  const data = `${cardNumber}|${expiryDate}|${cvv}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

export class GeneratedCardModel {
  private tableName = 'generated_cards';

  /**
   * Create a new generated card record
   */
  public async create(input: CreateGeneratedCardInput): Promise<GeneratedCard> {
    const cardHash = calculateCardHash(input.cardNumber, input.expiryDate, input.cvv);
    const generationDate = new Date();
    generationDate.setHours(0, 0, 0, 0);

    const query = `
      INSERT INTO ${this.tableName} (
        card_number, bin, expiry_date, expiry_month, expiry_year, cvv,
        bank_name, bank_name_local, country_code, country_name,
        card_type, card_network,
        generation_mode, sequence_number, is_sequential,
        user_id, api_key_id, request_id,
        card_hash, generation_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `;

    const values = [
      input.cardNumber,
      input.bin,
      input.expiryDate,
      input.expiryMonth,
      input.expiryYear,
      input.cvv,
      input.bankName || null,
      input.bankNameLocal || null,
      input.countryCode || null,
      input.countryName || null,
      input.cardType || null,
      input.cardNetwork || null,
      input.generationMode,
      input.sequenceNumber || null,
      input.isSequential || false,
      input.userId || null,
      input.apiKeyId || null,
      input.requestId || null,
      cardHash,
      generationDate,
    ];

    try {
      const result: QueryResult<GeneratedCardRow> = await database.query(query, values);
      return mapRowToGeneratedCard(result.rows[0]);
    } catch (error: unknown) {
      const err = error as Error;
      // Handle unique constraint violation (duplicate)
      if (err.message.includes('card_hash') || err.message.includes('unique')) {
        logger.warn('Duplicate card detected', { cardHash, bin: input.bin });
        throw new Error('Card already exists (duplicate detected)');
      }
      logger.error('Failed to create generated card', { error: err.message, bin: input.bin });
      throw error;
    }
  }

  /**
   * Batch insert multiple cards (for batch_999 mode)
   * Enhanced with conflict handling for composite unique constraint
   */
  public async createBatch(inputs: CreateGeneratedCardInput[]): Promise<GeneratedCard[]> {
    if (inputs.length === 0) {
      return [];
    }

    const generationDate = new Date();
    generationDate.setHours(0, 0, 0, 0);

    const values: unknown[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const input of inputs) {
      const cardHash = calculateCardHash(input.cardNumber, input.expiryDate, input.cvv);
      const row = [
        input.cardNumber,
        input.bin,
        input.expiryDate,
        input.expiryMonth,
        input.expiryYear,
        input.cvv,
        input.bankName || null,
        input.bankNameLocal || null,
        input.countryCode || null,
        input.countryName || null,
        input.cardType || null,
        input.cardNetwork || null,
        input.generationMode,
        input.sequenceNumber || null,
        input.isSequential || false,
        input.userId || null,
        input.apiKeyId || null,
        input.requestId || null,
        cardHash,
        generationDate,
      ];

      const rowPlaceholders = row.map(() => `$${paramIndex++}`).join(', ');
      placeholders.push(`(${rowPlaceholders})`);
      values.push(...row);
    }

    const query = `
      INSERT INTO ${this.tableName} (
        card_number, bin, expiry_date, expiry_month, expiry_year, cvv,
        bank_name, bank_name_local, country_code, country_name,
        card_type, card_network,
        generation_mode, sequence_number, is_sequential,
        user_id, api_key_id, request_id,
        card_hash, generation_date
      )
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (card_hash) DO NOTHING
      ON CONFLICT (card_number, expiry_date, cvv) DO NOTHING
      RETURNING *
    `;

    try {
      const result: QueryResult<GeneratedCardRow> = await database.query(query, values);
      return result.rows.map(mapRowToGeneratedCard);
    } catch (error) {
      logger.error('Failed to batch create generated cards', { error, count: inputs.length });
      throw error;
    }
  }

  /**
   * Reserve a card hash using advisory lock (for uniqueness pool)
   */
  public async reserveCardHash(
    cardHash: string,
    reservedBy: string,
    ttlSeconds: number = 300
  ): Promise<boolean> {
    const query = `SELECT reserve_card_hash($1, $2, $3) as reserved`;
    
    try {
      const result = await database.query<{ reserved: boolean }>(query, [
        cardHash,
        reservedBy,
        ttlSeconds,
      ]);
      return result.rows[0]?.reserved || false;
    } catch (error) {
      logger.error('Failed to reserve card hash', { error, cardHash, reservedBy });
      throw error;
    }
  }

  /**
   * Release a card hash reservation
   */
  public async releaseCardHash(cardHash: string): Promise<boolean> {
    const query = `SELECT release_card_hash($1) as released`;
    
    try {
      const result = await database.query<{ released: boolean }>(query, [cardHash]);
      return result.rows[0]?.released || false;
    } catch (error) {
      logger.error('Failed to release card hash', { error, cardHash });
      throw error;
    }
  }

  /**
   * Check if card hash exists in uniqueness pool
   */
  public async existsInUniquenessPool(cardHash: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM card_uniqueness_pool
      WHERE card_hash = $1
      AND reserved_until > CURRENT_TIMESTAMP
      LIMIT 1
    `;
    
    try {
      const result = await database.query(query, [cardHash]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Failed to check uniqueness pool', { error, cardHash });
      throw error;
    }
  }

  /**
   * Check if a card hash already exists (for deduplication)
   */
  public async existsByHash(cardHash: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM ${this.tableName}
      WHERE card_hash = $1
      LIMIT 1
    `;

    try {
      const result = await database.query(query, [cardHash]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Failed to check card hash existence', { error, cardHash });
      throw error;
    }
  }

  /**
   * Find card by hash
   */
  public async findByHash(cardHash: string): Promise<GeneratedCard | null> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE card_hash = $1
      LIMIT 1
    `;

    try {
      const result: QueryResult<GeneratedCardRow> = await database.query(query, [cardHash]);
      if (result.rows.length === 0) {
        return null;
      }
      return mapRowToGeneratedCard(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find card by hash', { error, cardHash });
      throw error;
    }
  }

  /**
   * Get cards by user ID
   */
  public async findByUserId(userId: string, limit: number = 50, offset: number = 0): Promise<{
    cards: GeneratedCard[];
    total: number;
  }> {
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${this.tableName}
      WHERE user_id = $1
    `;

    const dataQuery = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1
      ORDER BY generated_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        database.query<{ total: string }>(countQuery, [userId]),
        database.query<GeneratedCardRow>(dataQuery, [userId, limit, offset]),
      ]);

      return {
        cards: dataResult.rows.map(mapRowToGeneratedCard),
        total: parseInt(countResult.rows[0].total, 10),
      };
    } catch (error) {
      logger.error('Failed to find cards by user ID', { error, userId });
      throw error;
    }
  }

  /**
   * Get cards by BIN
   */
  public async findByBin(bin: string, limit: number = 50, offset: number = 0): Promise<{
    cards: GeneratedCard[];
    total: number;
  }> {
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${this.tableName}
      WHERE bin = $1
    `;

    const dataQuery = `
      SELECT * FROM ${this.tableName}
      WHERE bin = $1
      ORDER BY generated_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        database.query<{ total: string }>(countQuery, [bin]),
        database.query<GeneratedCardRow>(dataQuery, [bin, limit, offset]),
      ]);

      return {
        cards: dataResult.rows.map(mapRowToGeneratedCard),
        total: parseInt(countResult.rows[0].total, 10),
      };
    } catch (error) {
      logger.error('Failed to find cards by BIN', { error, bin });
      throw error;
    }
  }

  /**
   * Get statistics for a date range
   */
  public async getStatisticsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalGenerated: number;
    totalUnique: number;
    totalDuplicates: number;
    byMode: Record<string, number>;
    byBin: Array<{ bin: string; count: number }>;
    byCountry: Array<{ countryCode: string; count: number }>;
  }> {
    const query = `
      SELECT
        COUNT(*) as total_generated,
        COUNT(DISTINCT card_hash) as total_unique,
        COUNT(*) - COUNT(DISTINCT card_hash) as total_duplicates,
        generation_mode,
        bin,
        country_code
      FROM ${this.tableName}
      WHERE generation_date >= $1 AND generation_date <= $2
      GROUP BY generation_mode, bin, country_code
    `;

    try {
      const result = await database.query<{
        total_generated: string;
        total_unique: string;
        total_duplicates: string;
        generation_mode: string;
        bin: string;
        country_code: string | null;
      }>(query, [startDate, endDate]);

      let totalGenerated = 0;
      let totalUnique = 0;
      let totalDuplicates = 0;
      const byMode: Record<string, number> = {};
      const byBinMap: Record<string, number> = {};
      const byCountryMap: Record<string, number> = {};

      for (const row of result.rows) {
        totalGenerated += parseInt(row.total_generated, 10);
        totalUnique += parseInt(row.total_unique, 10);
        totalDuplicates += parseInt(row.total_duplicates, 10);

        byMode[row.generation_mode] = (byMode[row.generation_mode] || 0) + parseInt(row.total_generated, 10);
        byBinMap[row.bin] = (byBinMap[row.bin] || 0) + parseInt(row.total_generated, 10);
        
        if (row.country_code) {
          byCountryMap[row.country_code] = (byCountryMap[row.country_code] || 0) + parseInt(row.total_generated, 10);
        }
      }

      const byBin = Object.entries(byBinMap)
        .map(([bin, count]) => ({ bin, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const byCountry = Object.entries(byCountryMap)
        .map(([countryCode, count]) => ({ countryCode, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalGenerated,
        totalUnique,
        totalDuplicates,
        byMode,
        byBin,
        byCountry,
      };
    } catch (error) {
      logger.error('Failed to get statistics by date range', { error, startDate, endDate });
      throw error;
    }
  }
}

export const generatedCardModel = new GeneratedCardModel();
