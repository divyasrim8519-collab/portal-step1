// Pure functions (no database, no framework) so they can be unit tested.
const DIGITS = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };

export function normalise(text) {
  let t = String(text).toLowerCase().replace(/\s+/g, ' ').trim();
  // "name [at] mail [dot] com", "name at gmail dot com"
  t = t.replace(/\s*[\[(]\s*at\s*[\])]\s*/g, '@').replace(/\s*[\[(]\s*dot\s*[\])]\s*/g, '.');
  t = t.replace(/(\w)\s+at\s+([\w-]+)\s+dot\s+(\w{2,})/g, '$1@$2.$3');
  t = t.replace(/(\w)\s+dot\s+(com|net|org|in|io|co|edu|me|info)\b/g, '$1.$2');
  // spelled-out digits, then strip separators between digits ("98 76-54")
  t = t.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => DIGITS[w]);
  t = t.replace(/(?<=\d)[\s\-.()]+(?=\d)/g, '');
  return t;
}

export function compileRule(pattern) {
  return new RegExp(pattern, 'i');
}

// Tests the original and normalised text against every enabled rule.
export function evaluateText(text, rules) {
  const variants = [String(text).toLowerCase().replace(/\s+/g, ' '), normalise(text)];
  const matches = [];
  for (const rule of rules) {
    if (!rule.isEnabled) continue;
    let re;
    try { re = compileRule(rule.pattern); } catch { continue; } // a bad admin pattern must not break sending
    for (const v of variants) {
      const m = re.exec(v);
      if (m) { matches.push({ rule, matchedText: m[0].slice(0, 50) }); break; }
    }
  }
  // Contact sharing ALWAYS holds, regardless of the configured action.
  const hold = matches.some((x) => x.rule.action === 'HOLD' || x.rule.category === 'CONTACT_SHARING');
  return { matches, hold };
}
