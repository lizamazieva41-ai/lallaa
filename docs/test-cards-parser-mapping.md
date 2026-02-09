# Test Cards Markdown Parser Mapping

Source: `src/services/testCardsETL.ts`

## Gateway detection
- A gateway section is a markdown heading line that starts with `### `.
- The slug is derived by lowercasing the heading text and replacing whitespace with `-`.
- Headings containing `Further Resources` or `License` are ignored.

## Docs link extraction
- The parser scans the next 10 lines after a gateway heading for `[docs]`, `[documentation]`, or `[Testing Guide]`.
- The first markdown link found is used as `sourceLink` for complex-format rows.

## Table row detection
- A row is considered a data row if it contains `|` and is not a header or separator.
- Rows containing `Card Type`, `Card Number`, `---`, or `:---` are skipped.

## Format mapping

### Simple format (2 columns)
`Card Type | Card Number`
- Mapped fields: `brand`, `pan`, `cardType`.
- Missing fields: `cvc`, `expectedResult`, `testScenario`, `sourceLink`.

### Medium format (3 columns)
`Card Type | Card Number | CVC`
- Mapped fields: `brand`, `pan`, `cvc`, `cardType`.
- Missing fields: `expectedResult`, `testScenario`, `sourceLink`.

### Complex format (>=4 columns)
`Card Type | Card Number | ...`
- `cvc`: set if column 3 is 3-4 digits.
- `expectedResult`: set if any column contains `success`, `decline`, `approved`, or `failed`.
- `testScenario`: set to the last column value.
- `sourceLink`: set from extracted docs link.
- `is3dsEnrolled`: true if any column contains `3ds`, `3d secure`, `verified by visa`, or `securecode`.

## PAN normalization and masking
- PAN is normalized to digits only during parsing.
- PAN masking happens during load (first 6 + last 4, middle masked).

## Card type inference
- `debit` if the card type text contains `debit`.
- `prepaid` if the text contains `prepaid` or `gift`.
- Otherwise defaults to `credit`.

## Known limitations
- Only the first PAN in a cell is used when multiple numbers are listed.
- `expiryHint`, `notes`, and `region` are not parsed from markdown.
- CVC detection only handles pure digits (3-4 characters).
- Expected result detection is keyword-based and may miss custom wording.
