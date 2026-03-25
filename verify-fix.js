const normPhone = (s) => (s || '').replace(/\D/g, '');

const testData = [
    { input: '+91 88789 23337', expected: '918878923337' },
    { input: '8878923337', expected: '8878923337' },
    { input: '+91-88789-23337', expected: '918878923337' },
    { input: ' (91) 88789 23337 ', expected: '918878923337' },
    { input: '', expected: '' },
    { input: null, expected: '' }
];

console.log("--- Testing normPhone ---");
let allPassed = true;
testData.forEach(({ input, expected }, i) => {
    const result = normPhone(input);
    const passed = result === expected;
    console.log(`Test ${i + 1}: Input="${input}", Expected="${expected}", Result="${result}" - ${passed ? "✅" : "❌"}`);
    if (!passed) allPassed = false;
});

if (allPassed) {
    console.log("\n✅ All normalization tests passed!");
} else {
    console.log("\n❌ Some normalization tests failed!");
    process.exit(1);
}

// Check if server.js requires all dependencies
try {
    require('dotenv').config();
    console.log("✅ dotenv loaded");
} catch (e) {
    console.log("⚠️ dotenv not found or failed (expected if run in isolation)");
}
