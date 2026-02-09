# Baseline Accuracy Measurement Report

Generated: 2026-01-28T13:30:33.842Z

## Summary

- **Overall Accuracy**: 0.00%
- **Total Comparisons**: 19980
- **Correct Comparisons**: 0

## Field-Specific Accuracies

### Country
- **Accuracy**: 0.00%
- **Total**: 5000
- **Correct**: 0
- **Mismatches**: 93

### Network
- **Accuracy**: 0.00%
- **Total**: 5000
- **Correct**: 0
- **Mismatches**: 6

### Issuer
- **Accuracy**: 0.00%
- **Total**: 4980
- **Correct**: 0
- **Mismatches**: 1509
- **Normalized Similarity**: 0.00%

### Type
- **Accuracy**: 0.00%
- **Total**: 5000
- **Correct**: 0
- **Mismatches**: 2

## Accuracy Gaps


### country
- **Current**: 0.00%
- **Target**: 99%
- **Gap**: 99.00%
- **Recommendation**: Review and fix 93 mismatch patterns


### network
- **Current**: 0.00%
- **Target**: 99%
- **Gap**: 99.00%
- **Recommendation**: Review and fix 6 mismatch patterns


### issuer
- **Current**: 0.00%
- **Target**: 95%
- **Gap**: 95.00%
- **Recommendation**: Improve issuer name normalization (current similarity: 0.00%)


### type
- **Current**: 0.00%
- **Target**: 95%
- **Gap**: 95.00%
- **Recommendation**: Review and fix 2 mismatch patterns


## Recommendations

1. Review and fix 93 mismatch patterns
2. Review and fix 6 mismatch patterns
3. Improve issuer name normalization (current similarity: 0.00%)
4. Review and fix 2 mismatch patterns
5. Review 93 mismatch patterns for country field
6. Review 6 mismatch patterns for network field
7. Improve issuer name normalization (similarity: 0.00%)
8. Review 2 mismatch patterns for type field

## Mismatch Patterns


### country: DK → LOOKUP_FAILED
- **Frequency**: 1875
- **Examples**: 457105, 457108, 457120, 457121, 457124


### country: US → LOOKUP_FAILED
- **Frequency**: 1642
- **Examples**: 341142, 342562, 370266, 371240, 371241


### country: BR → LOOKUP_FAILED
- **Frequency**: 259
- **Examples**: 375135, 375138, 376437, 376439, 376442


### country: MX → LOOKUP_FAILED
- **Frequency**: 151
- **Examples**: 376660, 376662, 376669, 376689, 376706


### country: MY → LOOKUP_FAILED
- **Frequency**: 138
- **Examples**: 402506, 402814, 402988, 403149, 403265


### country: GB → LOOKUP_FAILED
- **Frequency**: 82
- **Examples**: 371782, 374614, 376013, 376014, 376469


### country: AU → LOOKUP_FAILED
- **Frequency**: 78
- **Examples**: 375415, 376064, 376066, 376073, 377747


### country: CA → LOOKUP_FAILED
- **Frequency**: 73
- **Examples**: 373320, 373391, 373394, 450003, 450065


### country: FR → LOOKUP_FAILED
- **Frequency**: 58
- **Examples**: 453301, 453370, 453374, 455670, 455671


### country: DE → LOOKUP_FAILED
- **Frequency**: 57
- **Examples**: 375001, 375080, 375081, 414912, 415932


### network: visa → LOOKUP_FAILED
- **Frequency**: 3654
- **Examples**: 400022, 400163, 400177, 400178, 400185


### network: mastercard → LOOKUP_FAILED
- **Frequency**: 1085
- **Examples**: 510008, 510021, 510070, 510147, 510152


### network: amex → LOOKUP_FAILED
- **Frequency**: 243
- **Examples**: 341142, 342562, 370245, 370266, 371240


### network: discover → LOOKUP_FAILED
- **Frequency**: 11
- **Examples**: 601100, 601110, 601120, 601129, 601136


### network: unionpay → LOOKUP_FAILED
- **Frequency**: 4
- **Examples**: 621483, 622202, 622305, 622698


### network: diners → LOOKUP_FAILED
- **Frequency**: 3
- **Examples**: 360218, 360324, 361766


### issuer: Nordea → LOOKUP_FAILED
- **Frequency**: 899
- **Examples**: 453903, 453904, 457120, 457121, 457124


### issuer: Danske Bank → LOOKUP_FAILED
- **Frequency**: 723
- **Examples**: 557385, 45710200, 45710216, 45710220, 45710222


### issuer: AMERICAN EXPRESS → LOOKUP_FAILED
- **Frequency**: 194
- **Examples**: 341142, 342562, 370266, 371240, 371241


### issuer: BANK OF AMERICA → LOOKUP_FAILED
- **Frequency**: 98
- **Examples**: 374322, 374632, 374720, 402400, 403647

