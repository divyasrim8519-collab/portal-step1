import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateText } from '../moderation-core.mjs';
import { RULES } from '../default-rules.mjs';

const rules = RULES.map((r, i) => ({ ...r, id: String(i), isEnabled: true }));
const cats = (t) => evaluateText(t, rules).matches.map((m) => m.rule.category);

const HELD = [
  ['phone number', 'Call me on 98765 43210 tomorrow'],
  ['phone with dashes', 'my number is +91-98765-43210'],
  ['spelled digits', 'nine eight seven six five four three two one zero'],
  ['email', 'Send it to john.doe@example.com'],
  ['email obfuscated at/dot', 'reach me at john at gmail dot com'],
  ['email bracket style', 'john [at] gmail [dot] com'],
  ['social handle', 'my insta is @john_doe'],
  ['external link', 'see https://example.com/portfolio'],
  ['off-platform', 'can you pay me directly instead?'],
  ['whatsapp', "let's continue on WhatsApp"],
  ['abuse', 'you are an idiot'],
];
for (const [name, text] of HELD) {
  test(`HELD: ${name}`, () => assert.equal(evaluateText(text, rules).hold, true, text));
}

test('FLAG ONLY: pricing is flagged but not held', () => {
  const r = evaluateText('What is the price for the extra page?', rules);
  assert.equal(r.hold, false);
  assert.ok(r.matches.some((m) => m.rule.category === 'COMMERCIAL'));
});

test('FLAG ONLY: amounts in rupees', () => {
  const r = evaluateText('We can do it for ₹5000', rules);
  assert.equal(r.hold, false);
  assert.ok(cats('We can do it for ₹5000').includes('COMMERCIAL'));
});

for (const text of [
  'Can you send the homepage mockup by Friday?',
  "Let's meet at 5 pm to review the wireframes",
  'The footer needs one more column and two icons',
]) {
  test(`CLEAN: ${text}`, () => assert.equal(evaluateText(text, rules).matches.length, 0));
}

test('Contact sharing holds even if admin set ALLOW_AND_FLAG', () => {
  const loose = rules.map((r) => ({ ...r, action: 'ALLOW_AND_FLAG' }));
  assert.equal(evaluateText('mail me at a@b.com', loose).hold, true);
});

test('Invalid admin regex does not crash evaluation', () => {
  const bad = [...rules, { id: 'x', name: 'bad', category: 'ABUSE', pattern: '([', action: 'HOLD', severity: 'LOW', isEnabled: true }];
  assert.doesNotThrow(() => evaluateText('hello', bad));
});

test('Disabled rules are ignored', () => {
  const off = rules.map((r) => ({ ...r, isEnabled: false }));
  assert.equal(evaluateText('call 9876543210', off).matches.length, 0);
});
