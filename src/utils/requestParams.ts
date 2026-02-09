/**
 * Utility functions for Express request parameter handling
 */

/**
 * Extract string value from Express route parameter (handles both string and string array cases)
 */
export function getRequestParam(param: string | string[] | undefined): string | undefined {
  if (!param) {
    return undefined;
  }
  return Array.isArray(param) ? param[0] : param;
}

/**
 * Extract string value from Express query parameter (handles both string and string array cases)
 */
export function getQueryParam(param: string | string[] | undefined): string | undefined {
  if (!param) {
    return undefined;
  }
  return Array.isArray(param) ? param[0] : param;
}