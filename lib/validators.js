import { z } from 'zod';
import { compileRule } from './moderation-core.mjs';

// Admin-entered regex: must compile and stay short.
export const patternField = z.string().trim().min(1).max(300).refine((p) => {
  try { compileRule(p); return true; } catch { return false; }
}, 'Pattern is not a valid regular expression');
