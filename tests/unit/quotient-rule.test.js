/**
 * Verification test for the quotient-rule differentiation task.
 *
 * Task: "Implement quotient rule differentiation (currently TODO) —
 *        file: SLaNg/src/core/basic.js"
 *
 * Audit result: differentiateFraction() in src/core/basic.js already
 * implements the quotient rule correctly:
 *   d/dx[f/g] = (f'g - fg') / g^2
 *
 * This file provides automated coverage (not just a claim in a comment).
 * Run with: node tests/unit/quotient-rule.test.js
 */

import { differentiateFraction, evaluateFraction } from '../../src/core/basic.js';

let failures = 0;

/**
 * Evaluate both the fraction produced by differentiateFraction and the
 * expected closed-form derivative at several x values, and compare
 * numerically. This avoids relying on exact term ordering / structure,
 * and instead checks that the math itself is correct.
 */
function assertDerivativeMatches(label, fraction, expectedFn, sampleXs) {
    const result = differentiateFraction(fraction, 'x');
    let ok = true;

    for (const x of sampleXs) {
        const actual = evaluateFraction(result, { x });
        const expected = expectedFn(x);
        if (Math.abs(actual - expected) > 1e-9) {
            ok = false;
            console.error(
                `  mismatch at x=${x}: got ${actual}, expected ${expected}`
            );
        }
    }

    if (ok) {
        console.log(`PASS: ${label}`);
    } else {
        console.error(`FAIL: ${label}`);
        failures++;
    }
}

// Test 1: d/dx(1/x) = -1/x^2
assertDerivativeMatches(
    'd/dx(1/x) = -1/x^2',
    { numi: { terms: [{ coeff: 1 }] }, deno: { terms: [{ coeff: 1, var: { x: 1 } }] } },
    (x) => -1 / (x * x),
    [1, 2, 5, -3]
);

// Test 2: d/dx(x/(x+1)) = 1/(x+1)^2
assertDerivativeMatches(
    'd/dx(x/(x+1)) = 1/(x+1)^2',
    {
        numi: { terms: [{ coeff: 1, var: { x: 1 } }] },
        deno: { terms: [{ coeff: 1, var: { x: 1 } }, { coeff: 1 }] },
    },
    (x) => 1 / ((x + 1) * (x + 1)),
    [0, 2, 5, -4]
);

// Test 3: d/dx((x^2+1)/(x-1))  — polynomial-over-polynomial
// Using quotient rule: (2x(x-1) - (x^2+1)(1)) / (x-1)^2
//                     = (2x^2 - 2x - x^2 - 1) / (x-1)^2
//                     = (x^2 - 2x - 1) / (x-1)^2
assertDerivativeMatches(
    'd/dx((x^2+1)/(x-1)) = (x^2-2x-1)/(x-1)^2',
    {
        numi: { terms: [{ coeff: 1, var: { x: 2 } }, { coeff: 1 }] },
        deno: { terms: [{ coeff: 1, var: { x: 1 } }, { coeff: -1 }] },
    },
    (x) => (x * x - 2 * x - 1) / ((x - 1) * (x - 1)),
    [2, 3, 5, -2]
);

if (failures > 0) {
    console.error(`\n${failures} test(s) failed.`);
    process.exitCode = 1;
} else {
    console.log('\nAll quotient rule tests passed ✅');
}