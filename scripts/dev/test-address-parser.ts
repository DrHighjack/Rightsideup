import { parseAddress } from '../../lib/emailPoller';

const sampleEmailBody = `
Ticket Number: 2026-05-24-789456
Excavation Address: 3349 Willow Canyon St, Thousand Oaks, CA 91362
Work Start Date: 05/27/2026
Contractor: ABC Excavation
Status: Active
`;

console.log('═══════════════════════════════════════════════════════════════');
console.log('811 EMAIL ADDRESS PARSER TEST');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('📧 Sample Email Body:');
console.log(sampleEmailBody);
console.log('\n───────────────────────────────────────────────────────────────\n');

const result = parseAddress(sampleEmailBody);

console.log('✅ PARSE RESULTS:\n');
console.log(`Address:      ${result.address || '(not found)'}`);
console.log(`Ticket #:     ${result.ticketNumber || '(not found)'}`);
console.log(`Work Start:   ${result.workStartDate || '(not found)'}`);
console.log(`Confidence:   ${result.confidence.toUpperCase()}`);

console.log('\n───────────────────────────────────────────────────────────────\n');

// Test alternative label formats
const testCases = [
  {
    name: 'Work Location label',
    body: `Work Location: 456 Oak Ridge Road, Springfield, IL 62701\nTicket #: 2026-05-25-654321\nStart Date: 06/01/2026`,
  },
  {
    name: 'Site Address label',
    body: `Site Address: 789 Pine Valley Drive, Denver, CO 80202\nLocate Request #: 2026-05-26-111111\nScheduled Date: 06/05/2026`,
  },
  {
    name: 'Minimal format (fallback)',
    body: `Some random text with 2026-05-27-222222 and 123 Main Street, Austin, TX 78701`,
  },
];

console.log('🧪 ADDITIONAL TEST CASES:\n');

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  const testResult = parseAddress(testCase.body);
  console.log(`  Address:    ${testResult.address || '(not found)'}`);
  console.log(`  Ticket:     ${testResult.ticketNumber || '(not found)'}`);
  console.log(`  Start Date: ${testResult.workStartDate || '(not found)'}`);
  console.log(`  Confidence: ${testResult.confidence}`);
  console.log();
});

console.log('═══════════════════════════════════════════════════════════════');
console.log('✅ ALL TESTS COMPLETED');
console.log('═══════════════════════════════════════════════════════════════');
