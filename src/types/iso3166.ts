/**
 * ISO 3166-1 Country data structure
 * Type definition for country mapping
 */
export interface ISO3166Country {
  iso2: string;
  iso3: string;
  name: string;
  commonNames: string[];
  currencyCode: string;
  currencyName: string;
  region: string;
  subregion: string;
  validationRules?: {
    binPrefixes?: string[];
    cardNetworks?: string[];
  };
}
