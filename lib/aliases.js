const BASE = { CLIENT: 'Client', EMPLOYEE: 'Project Specialist' };
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Aliases are unique within one project and independent across projects.
export function nextAlias(memberRole, usedAliases) {
  const used = new Set(usedAliases);
  for (const l of LETTERS) {
    const alias = `${BASE[memberRole]} ${l}`;
    if (!used.has(alias)) return alias;
  }
  throw new Error('No aliases left for this project');
}
