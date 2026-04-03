/**
 * Program Resolver
 *
 * Dynamically resolves Glofox event names to Meridian program UUIDs.
 * Replaces the hardcoded CLASS_TYPE_MAP that was duplicated in 3 sync files.
 *
 * Loads programs from the database once per sync cycle, then matches
 * event names to programs using keyword heuristics.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ProgramMapping {
  id: string
  name: string
  glofox_id: string | null
}

// Keyword → program name mapping for heuristic matching
const PROGRAM_KEYWORDS: Record<string, string[]> = {
  'Guided Breathwork': ['guided', 'breathwork'],
  'Private Session': ['private', 'event', 'party'],
  // Default fallback is "Open Sauna" (anything not matched)
}

/**
 * Load all programs for a studio and return a resolver function.
 * Call once at the start of a sync cycle, then use the returned function repeatedly.
 */
export async function createProgramResolver(
  db: SupabaseClient,
  studioId: string,
): Promise<{
  resolve: (eventName: string, glofoxProgramId?: string | null) => string
  defaultProgramId: string
  programs: ProgramMapping[]
}> {
  const { data: programs } = await db
    .from('programs')
    .select('id, name, glofox_id')
    .eq('studio_id', studioId)
    .eq('active', true)

  const programList: ProgramMapping[] = programs ?? []

  // Build glofox_id → program_id lookup for direct mapping
  const glofoxIdMap = new Map<string, string>()
  for (const p of programList) {
    if (p.glofox_id) {
      glofoxIdMap.set(p.glofox_id, p.id)
    }
  }

  // Build name → program_id lookup for keyword matching
  const nameMap = new Map<string, string>()
  for (const p of programList) {
    nameMap.set(p.name, p.id)
  }

  // Default to "Open Sauna" or first program
  const defaultProgram = programList.find((p) => p.name === 'Open Sauna') ?? programList[0]
  const defaultProgramId = defaultProgram?.id ?? ''

  function resolve(eventName: string, glofoxProgramId?: string | null): string {
    // 1. Try direct Glofox program_id mapping first
    if (glofoxProgramId && glofoxIdMap.has(glofoxProgramId)) {
      return glofoxIdMap.get(glofoxProgramId)!
    }

    // 2. Try keyword matching on event name
    const lower = (eventName ?? '').toLowerCase()
    for (const [programName, keywords] of Object.entries(PROGRAM_KEYWORDS)) {
      if (keywords.some((kw) => lower.includes(kw))) {
        const programId = nameMap.get(programName)
        if (programId) return programId
      }
    }

    // 3. Default fallback
    return defaultProgramId
  }

  return { resolve, defaultProgramId, programs: programList }
}
