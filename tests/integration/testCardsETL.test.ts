/**
 * Integration Tests for Test Cards ETL
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import database from '../../src/database/connection';
import { TestCardsETL } from '../../src/services/testCardsETL';

describe('Test Cards ETL Integration', () => {
  const gatewaySlug = 'integration-gateway';
  let tempDir = '';

  beforeAll(async () => {
    await database.connect();

    await database.query(`
      CREATE TABLE IF NOT EXISTS card_gateways (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(50) NOT NULL UNIQUE,
        docs_url TEXT,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await database.query(`
      CREATE TABLE IF NOT EXISTS test_cards (
        id SERIAL PRIMARY KEY,
        gateway_id INTEGER REFERENCES card_gateways(id) ON DELETE CASCADE,
        brand VARCHAR(50) NOT NULL,
        pan VARCHAR(19) NOT NULL,
        cvc VARCHAR(4),
        expiry_hint VARCHAR(50),
        expected_result VARCHAR(100),
        test_scenario VARCHAR(100),
        notes TEXT,
        source_link TEXT,
        is_3ds_enrolled BOOLEAN DEFAULT false,
        card_type VARCHAR(20) DEFAULT 'credit',
        region VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(gateway_id, pan)
      )
    `);
  });

  afterAll(async () => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    await database.disconnect();
  });

  beforeEach(async () => {
    await database.query(
      `DELETE FROM test_cards WHERE gateway_id IN (SELECT id FROM card_gateways WHERE slug = $1)`,
      [gatewaySlug]
    );
    await database.query(`DELETE FROM card_gateways WHERE slug = $1`, [gatewaySlug]);
  });

  it('should load test cards and mask PANs, idempotently', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-cards-etl-'));
    const readmePath = path.join(tempDir, 'readme.md');
    const markdown = `
### Integration Gateway
[docs](https://example.com/docs)
| Card Type | Card Number | CVC |
| --- | --- | --- |
| Visa | 4242 4242 4242 4242 | 123 |
| MasterCard | 5555 5555 5555 4444 | 321 |
`;
    fs.writeFileSync(readmePath, markdown);

    const etl = new TestCardsETL(tempDir);
    const parsedCards = (etl as any).parseMarkdown(markdown) as Array<any>;
    await (etl as any).loadToDatabase(parsedCards);

    const gatewayResult = await database.query(
      `SELECT id FROM card_gateways WHERE slug = $1`,
      [gatewaySlug]
    );
    expect(gatewayResult.rows.length).toBe(1);

    const gatewayId = gatewayResult.rows[0].id;
    const cardsResult = await database.query(
      `SELECT pan, brand FROM test_cards WHERE gateway_id = $1 ORDER BY pan`,
      [gatewayId]
    );
    expect(cardsResult.rows.length).toBe(2);
    expect(cardsResult.rows[0].pan).toBe('424242******4242');
    expect(cardsResult.rows[1].pan).toBe('555555******4444');

    await (etl as any).loadToDatabase(parsedCards);
    const cardsAfterSecondRun = await database.query(
      `SELECT COUNT(*) as count FROM test_cards WHERE gateway_id = $1`,
      [gatewayId]
    );
    expect(parseInt(cardsAfterSecondRun.rows[0].count, 10)).toBe(2);
  });
});
