import { test } from 'vitest'
import { ElsewordsSession } from './session.svelte'
import { runSessionCases } from './tests/sessionCases.js'
test('native card session preserves global review, confirmation, cancellation, source conflicts and preferences', async () => { await runSessionCases(ElsewordsSession) })
