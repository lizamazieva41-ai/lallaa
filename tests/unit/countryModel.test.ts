import database from '../../src/database/connection';
import { countryModel } from '../../src/models/country';

jest.mock('../../src/database/connection', () => ({
  getPool: jest.fn(),
  query: jest.fn(),
}));

jest.mock('../../src/database/seeds/001_seed_countries', () => ({
  DEFAULT_COUNTRIES: [
    {
      country_code: 'US',
      country_name: 'United States',
      continent: 'North America',
      currency_code: 'USD',
      currency_name: 'US Dollar',
      iban_length: 22,
      bank_code_length: 8,
      account_number_length: 10,
      example_iban: 'US00TEST00000000000000',
      iban_regex: 'US\\d{20}',
      is_sepa: false
    }
  ]
}));

const mockDb = database as jest.Mocked<typeof database>;

const buildCountryRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  country_code: 'DE',
  country_name: 'Germany',
  continent: 'Europe',
  currency_code: 'EUR',
  currency_name: 'Euro',
  iban_length: 22,
  bank_code_length: 8,
  account_number_length: 10,
  example_iban: 'DE89370400440532013000',
  iban_regex: 'DE\\d{20}',
  is_sepa: true,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('CountryModel', () => {
  const mockPool = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (mockDb.getPool as jest.Mock).mockReturnValue(mockPool as any);
    countryModel.pool = mockPool as any;
  });

  it('should find country by code', async () => {
    const row = buildCountryRow();
    mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);

    const result = await countryModel.findByCode('de');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE country_code = $1'),
      ['DE']
    );
    expect(result?.countryCode).toBe('DE');
    expect(result?.countryName).toBe('Germany');
  });

  it('should return null when country not found', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
    const result = await countryModel.findByCode('ZZ');
    expect(result).toBeNull();
  });

  it('should get all countries', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [buildCountryRow()] } as any);
    const result = await countryModel.getAll();
    expect(result).toHaveLength(1);
  });

  it('should get countries by continent', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [buildCountryRow()] } as any);
    const result = await countryModel.getByContinent('Europe');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE continent = $1'),
      ['Europe']
    );
    expect(result).toHaveLength(1);
  });

  it('should get SEPA countries', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [buildCountryRow()] } as any);
    const result = await countryModel.getSEPACountries();
    expect(result).toHaveLength(1);
    expect(result[0].isSEPA).toBe(true);
  });

  it('should search countries', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [buildCountryRow()] } as any);
    const result = await countryModel.search('ger', 10);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE country_name ILIKE $1'),
      ['%ger%', 10]
    );
    expect(result).toHaveLength(1);
  });

  it('should create a country', async () => {
    const row = buildCountryRow({ country_code: 'US', country_name: 'United States' });
    mockDb.query.mockResolvedValueOnce({ rows: [row] } as any);

    const result = await countryModel.create({
      countryCode: 'us',
      countryName: 'United States',
      continent: 'North America',
      currencyCode: 'USD',
      currencyName: 'US Dollar',
      ibanLength: 22,
      bankCodeLength: 8,
      accountNumberLength: 10,
      exampleIban: 'US00TEST00000000000000',
      ibanRegex: 'US\\d{20}',
      isSEPA: false
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO countries'),
      expect.arrayContaining(['US', 'United States'])
    );
    expect(result.countryCode).toBe('US');
  });

  it('should update country or return null', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
    const result = await countryModel.update('DE', { countryName: 'Updated' });
    expect(result).toBeNull();
  });

  it('should return existing country when no updates provided', async () => {
    const row = buildCountryRow();
    const spy = jest.spyOn(countryModel, 'findByCode').mockResolvedValue({
      countryCode: row.country_code,
      countryName: row.country_name,
      continent: row.continent,
      currencyCode: row.currency_code,
      currencyName: row.currency_name,
      ibanLength: row.iban_length,
      bankCodeLength: row.bank_code_length,
      accountNumberLength: row.account_number_length,
      exampleIban: row.example_iban,
      ibanRegex: row.iban_regex,
      isSEPA: row.is_sepa,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });

    const result = await countryModel.update('DE', {});
    expect(spy).toHaveBeenCalledWith('DE');
    expect(result?.countryCode).toBe('DE');
  });

  it('should get continent list and currency list', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{ continent: 'Europe' }],
    } as any);

    const continents = await countryModel.getContinentList();
    expect(continents).toEqual(['Europe']);

    mockDb.query.mockResolvedValueOnce({
      rows: [{ currency_code: 'EUR', currency_name: 'Euro' }],
    } as any);

    const currencies = await countryModel.getCurrencyList();
    expect(currencies).toEqual([{ code: 'EUR', name: 'Euro' }]);
  });

  it('should skip seeding when countries already exist', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });

    await countryModel.seedDefaultCountries(false);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  it('should seed default countries when forced', async () => {
    mockPool.query.mockResolvedValue({ rows: [{ count: '0' }] });

    await countryModel.seedDefaultCountries(true);
    expect(mockPool.query).toHaveBeenCalled();
  });
});
