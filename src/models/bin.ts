import { QueryResult } from 'pg';
import database from '../database/connection';
import { BIN, BINLookupResult, CardType, CardNetwork } from '../types';
import { logger } from '../utils/logger';

interface BINRow {
  bin: string;
  bank_name: string;
  bank_name_local: string | null;
  country_code: string;
  country_name: string;
  card_type: CardType;
  card_network: CardNetwork;
  is_active: boolean;
  bank_code: string | null;
  branch_code: string | null;
  program_type: string | null;
  regulatory_type: string | null;
  bin_range_start: string | null;
  bin_range_end: string | null;
  length: number | null;
  luhn: boolean | null;
  scheme: string | null;
  brand: string | null;
  issuer: string | null;
  country: string | null;
  url: string | null;
  phone: string | null;
  city: string | null;
  // Provenance fields
  source: string;
  source_version: string | null;
  import_date: Date | null;
  last_updated: Date | null;
  raw: Record<string, unknown> | null;
  confidence_score: number | string | null;
  created_at: Date;
  updated_at: Date;
}

const mapRowToBIN = (row: BINRow): BIN => ({
  bin: row.bin,
  bankName: row.bank_name,
  bankNameLocal: row.bank_name_local || undefined,
  countryCode: row.country_code,
  countryName: row.country_name,
  cardType: row.card_type,
  cardNetwork: row.card_network,
  isActive: row.is_active,
  bankCode: row.bank_code || undefined,
  branchCode: row.branch_code || undefined,
  programType: row.program_type || undefined,
  regulatoryType: row.regulatory_type || undefined,
  binRangeStart: row.bin_range_start || undefined,
  binRangeEnd: row.bin_range_end || undefined,
  length: row.length ?? undefined,
  luhn: row.luhn ?? undefined,
  scheme: row.scheme || undefined,
  brand: row.brand || undefined,
  issuer: row.issuer || undefined,
  country: row.country || undefined,
  url: row.url || undefined,
  phone: row.phone || undefined,
  city: row.city || undefined,
  // Provenance fields
  source: row.source,
  sourceVersion: row.source_version || undefined,
  importDate: row.import_date ?? undefined,
  lastUpdated: row.last_updated ?? undefined,
  raw: row.raw || undefined,
  confidenceScore:
    row.confidence_score === null || row.confidence_score === undefined
      ? undefined
      : Number(row.confidence_score),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapBINToLookupResult = (bin: BIN): BINLookupResult => ({
  bin: bin.bin,
  bank: {
    name: bin.bankName,
    nameLocal: bin.bankNameLocal,
    code: bin.bankCode,
  },
  country: {
    code: bin.countryCode,
    name: bin.countryName,
  },
  card: {
    type: bin.cardType,
    network: bin.cardNetwork,
  },
  metadata: {
    binRange: bin.binRangeStart
      ? `${bin.binRangeStart}-${bin.binRangeEnd}`
      : undefined,
  },
});

export class BINModel {
  private tableName = 'bins';

  public async findByBIN(bin: string): Promise<BIN | null> {
    // Normalize BIN (remove spaces, ensure 6-8 digits)
    const normalizedBin = bin.replace(/\s/g, '').substring(0, 8);

    // Optimized query using index on bin column
    // Using prepared statement pattern for better performance
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE bin = $1
      LIMIT 1
    `;

    try {
      const result: QueryResult<BINRow> = await database.query(query, [
        normalizedBin,
      ]);

      if (result.rows.length === 0) {
        return null;
      }

      return mapRowToBIN(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find BIN', { bin: normalizedBin, error });
      throw error;
    }
  }

  public async lookup(bin: string): Promise<BINLookupResult | null> {
    const binData = await this.findByBIN(bin);
    if (!binData) {
      return null;
    }
    return mapBINToLookupResult(binData);
  }

  public async search(params: {
    countryCode?: string;
    cardType?: CardType;
    cardNetwork?: CardNetwork;
    bankName?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ bins: BIN[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.countryCode) {
      conditions.push(`country_code = $${paramIndex}`);
      values.push(params.countryCode.toUpperCase());
      paramIndex++;
    }

    if (params.cardType) {
      conditions.push(`card_type = $${paramIndex}`);
      values.push(params.cardType);
      paramIndex++;
    }

    if (params.cardNetwork) {
      conditions.push(`card_network = $${paramIndex}`);
      values.push(params.cardNetwork);
      paramIndex++;
    }

    if (params.bankName) {
      conditions.push(`(bank_name ILIKE $${paramIndex} OR bank_name_local ILIKE $${paramIndex})`);
      values.push(`%${params.bankName}%`);
      paramIndex++;
    }

    if (params.isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex}`);
      values.push(params.isActive);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${this.tableName}
      ${whereClause}
    `;

    const dataQuery = `
      SELECT *
      FROM ${this.tableName}
      ${whereClause}
      ORDER BY bin ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    try {
      const limit = params.limit || 50;
      const offset = params.offset || 0;

      const [countResult, dataResult] = await Promise.all([
        database.query<{ total: string }>(countQuery, values),
        database.query<BINRow>(dataQuery, [...values, limit, offset]),
      ]);

      return {
        bins: dataResult.rows.map(mapRowToBIN),
        total: parseInt(countResult.rows[0].total, 10),
      };
    } catch (error) {
      logger.error('Failed to search BINs', { params, error });
      throw error;
    }
  }

  public async getByCountry(countryCode: string): Promise<BIN[]> {
    const query = `
      SELECT *
      FROM ${this.tableName}
      WHERE country_code = $1 AND is_active = true
      ORDER BY bank_name ASC
    `;

    try {
      const result: QueryResult<BINRow> = await database.query(query, [
        countryCode.toUpperCase(),
      ]);
      return result.rows.map(mapRowToBIN);
    } catch (error) {
      logger.error('Failed to get BINs by country', { countryCode, error });
      throw error;
    }
  }

  public async getByBank(bankCode: string): Promise<BIN[]> {
    const query = `
      SELECT *
      FROM ${this.tableName}
      WHERE bank_code = $1 AND is_active = true
      ORDER BY bin ASC
    `;

    try {
      const result: QueryResult<BINRow> = await database.query(query, [bankCode]);
      return result.rows.map(mapRowToBIN);
    } catch (error) {
      logger.error('Failed to get BINs by bank', { bankCode, error });
      throw error;
    }
  }

  public async create(binData: Omit<BIN, 'createdAt' | 'updatedAt'>): Promise<BIN> {
    const query = `
      INSERT INTO bins (
        bin, bank_name, bank_name_local, country_code, country_name,
        card_type, card_network, is_active, bank_code, branch_code,
        program_type, regulatory_type, bin_range_start, bin_range_end,
        length, luhn, scheme, brand, issuer, country,
        url, phone, city,
        source, source_version, import_date, last_updated, raw, confidence_score
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
        $28, $29
      )
      RETURNING *
    `;

    const values = [
      binData.bin,
      binData.bankName,
      binData.bankNameLocal || null,
      binData.countryCode,
      binData.countryName,
      binData.cardType,
      binData.cardNetwork,
      binData.isActive,
      binData.bankCode || null,
      binData.branchCode || null,
      binData.programType || null,
      binData.regulatoryType || null,
      binData.binRangeStart || null,
      binData.binRangeEnd || null,
      binData.length ?? null,
      binData.luhn ?? null,
      binData.scheme || null,
      binData.brand || null,
      binData.issuer || null,
      binData.country || null,
      binData.url || null,
      binData.phone || null,
      binData.city || null,
      binData.source,
      binData.sourceVersion || null,
      binData.importDate ?? new Date(),
      binData.lastUpdated || null,
      binData.raw || null,
      binData.confidenceScore ?? 1.0,
    ];

    try {
      const result: QueryResult<BINRow> = await database.query(query, values);
      return mapRowToBIN(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create BIN', { bin: binData.bin, error });
      throw error;
    }
  }

  public async update(
    bin: string,
    data: Partial<Omit<BIN, 'bin' | 'createdAt' | 'updatedAt'>>
  ): Promise<BIN | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fieldMapping: Record<string, string> = {
      bankName: 'bank_name',
      bankNameLocal: 'bank_name_local',
      countryCode: 'country_code',
      countryName: 'country_name',
      cardType: 'card_type',
      cardNetwork: 'card_network',
      isActive: 'is_active',
      bankCode: 'bank_code',
      branchCode: 'branch_code',
      programType: 'program_type',
      regulatoryType: 'regulatory_type',
      binRangeStart: 'bin_range_start',
      binRangeEnd: 'bin_range_end',
      length: 'length',
      luhn: 'luhn',
      scheme: 'scheme',
      brand: 'brand',
      issuer: 'issuer',
      country: 'country',
      url: 'url',
      phone: 'phone',
      city: 'city',
      source: 'source',
      sourceVersion: 'source_version',
      importDate: 'import_date',
      lastUpdated: 'last_updated',
      raw: 'raw',
      confidenceScore: 'confidence_score',
    };

    for (const [key, value] of Object.entries(data)) {
      const dbField = fieldMapping[key] || key;
      updates.push(`${dbField} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.findByBIN(bin);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(bin);

    const query = `
      UPDATE ${this.tableName}
      SET ${updates.join(', ')}
      WHERE bin = $${paramIndex}
      RETURNING *
    `;

    try {
      const result: QueryResult<BINRow> = await database.query(query, values);
      if (result.rows.length === 0) {
        return null;
      }
      return mapRowToBIN(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update BIN', { bin, error });
      throw error;
    }
  }

  public async delete(bin: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE bin = $1`;

    try {
      const result = await database.query(query, [bin]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error('Failed to delete BIN', { bin, error });
      throw error;
    }
  }

  public async getStatistics(): Promise<{
    totalBINs: number;
    activeBINs: number;
    byCountry: Record<string, number>;
    byCardType: Record<string, number>;
    byNetwork: Record<string, number>;
  }> {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE is_active = false) as inactive
      FROM ${this.tableName}
    `;

    const countryQuery = `
      SELECT country_code, COUNT(*) as count
      FROM ${this.tableName}
      GROUP BY country_code
      ORDER BY count DESC
      LIMIT 20
    `;

    try {
      const [totalResult, countryResult] = await Promise.all([
        database.query<{ total: string; active: string; inactive: string }>(query),
        database.query<{ country_code: string; count: string }>(countryQuery),
      ]);

      const { total, active } = totalResult.rows[0];

      return {
        totalBINs: parseInt(total, 10),
        activeBINs: parseInt(active, 10),
        byCountry: Object.fromEntries(
          countryResult.rows.map((row) => [row.country_code, parseInt(row.count, 10)])
        ),
        byCardType: {},
        byNetwork: {},
      };
    } catch (error) {
      logger.error('Failed to get BIN statistics', { error });
      throw error;
    }
  }

  public async getBySource(source: string): Promise<BIN[]> {
    const query = `
      SELECT *
      FROM ${this.tableName}
      WHERE source = $1 AND is_active = true
      ORDER BY bin ASC
    `;

    try {
      const result: QueryResult<BINRow> = await database.query(query, [source]);
      return result.rows.map(mapRowToBIN);
    } catch (error) {
      logger.error('Failed to get BINs by source', { source, error });
      throw error;
    }
  }

  public async getSourceQualityReport(): Promise<Record<string, {
    totalBINs: number;
    activeBINs: number;
    lastImport: Date | null;
    completeness: number;
  }>> {
    const query = `
      SELECT
        source,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        MAX(import_date) as last_import,
        ROUND(
          (COUNT(*) FILTER (WHERE bank_name IS NOT NULL AND bank_name <> '') * 100.0 / NULLIF(COUNT(*), 0)
        ) as completeness
      FROM ${this.tableName}
      WHERE source IS NOT NULL
      GROUP BY source
      ORDER BY total DESC
    `;

    try {
      const result = await database.query<{
        source: string;
        total: string;
        active: string;
        last_import: Date;
        completeness: string;
      }>(query);

      const report: Record<string, {
        totalBINs: number;
        activeBINs: number;
        lastImport: Date | null;
        completeness: number;
      }> = {};

      for (const row of result.rows) {
        report[row.source] = {
          totalBINs: parseInt(row.total, 10),
          activeBINs: parseInt(row.active, 10),
          lastImport: row.last_import,
          completeness: parseFloat(row.completeness) || 0,
        };
      }

      return report;
    } catch (error) {
      logger.error('Failed to get source quality report', { error });
      throw error;
    }
  }

  public async getETLRunHistory(limit: number): Promise<Array<{
    id: string;
    source: string;
    version: string;
    recordCount: number;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
  }>> {
    // This would typically query an etl_runs table
    // For now, we'll derive it from the bins table
    const query = `
      SELECT
        source,
        source_version as version,
        COUNT(*) as record_count,
        MIN(import_date) as started_at,
        MAX(import_date) as completed_at
      FROM ${this.tableName}
      WHERE source IS NOT NULL AND import_date IS NOT NULL
      GROUP BY source, source_version
      ORDER BY started_at DESC
      LIMIT $1
    `;

    try {
      const result = await database.query<{
        source: string;
        version: string;
        record_count: string;
        started_at: Date;
        completed_at: Date;
      }>(query, [limit]);

      return result.rows.map((row) => ({
        id: `${row.source}-${row.version}`,
        source: row.source,
        version: row.version,
        recordCount: parseInt(row.record_count, 10),
        status: 'completed',
        startedAt: row.started_at,
        completedAt: row.completed_at,
      }));
    } catch (error) {
      logger.error('Failed to get ETL run history', { error });
      throw error;
    }
  }
}

export const binModel = new BINModel();
