import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type Phase = 'intro' | 'voting' | 'results'

export interface SessionState {
  id: number
  current_stage: number
  phase: Phase
}

export interface Vote {
  id: string
  stage: number
  choice: string
  created_at: string
}
