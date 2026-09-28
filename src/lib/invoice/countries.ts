/** ISO 3166-1 alpha-2 codes offered for clients; names come from Intl.DisplayNames (built into browsers). */
export const COUNTRY_CODES = (
  'AE AR AT AU BD BE BH BR CA CH CL CN CO CZ DE DK EE EG ES FI FR GB GR HK HU ID IE IL IN IT JP KE KR KW LK LT LU ' +
  'LV MU MX MY NG NL NO NP NZ OM PH PK PL PT QA RO SA SE SG TH TR TW UA US VN ZA'
).split(' ');

let displayNames: Intl.DisplayNames | undefined;

export function countryName(code: string): string {
  try {
    displayNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}
