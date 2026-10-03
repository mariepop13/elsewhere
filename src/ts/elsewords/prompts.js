import { finalResponseText } from './responseText.js';
import { collectTranslatableFields, normalizeGeneratedCardPlaceholders } from './cardCore.js';
// Preserves Elsewords prompt behavior; only explicit staged input is supplied.
const roleGuidance = `Keep a real character name in data.name. In reusable character prose and dialogue speaker labels, use literal {{char}} for the main character and literal {{user}} for the user role. These role macros are valid content, not unfinished placeholders. Preserve each distinct existing {{...}} macro in its staged field, including its spelling and spacing. Rewriting may change how often a macro is used; keep each required role at least once in that field; never expand macros to profile or character names. Use the same literal role macros in newly written prose. Do not replace unrelated people's names or names the brief explicitly asks to keep literally.`;
export function translationTextMap(batch) { return Object.fromEntries(batch.map(({ id, text }) => [id, text])); }
export function buildTranslationPrompt(batch, options, target) {
    const source = options.sourceMode === 'auto' ? 'automatically' : `as ${options.sourceLanguage}`;
    return `You are translating character-card text. Detect the source language ${source}. Translate into ${target}. Style: ${options.style}. Preserve original tone: ${options.tone ? 'yes' : 'no'}. ${options.instructions ? `Additional instructions: ${options.instructions}` : ''}\n\nReturn only one valid JSON object mapping every requested field ID to its translated text, for example {"f0":"...","f1":"..."}. Return every ID exactly once and do not add or remove fields. Keep all ⟦EWn⟧ tokens exactly once, unchanged. Preserve symbols, emojis, variables, macros, Markdown, HTML, line breaks, formatting, and intimacy level.\n\n${JSON.stringify(translationTextMap(batch))}`;
  }

export function buildTranslationRecoveryPrompt(response, batch) {
    return `Start immediately with {. Reformat the previous model output into exactly one valid JSON object mapping every requested field ID to its translated text, for example {"f0":"...","f1":"..."}. Include every requested ID exactly once. Do not output analysis, reasoning, <Thoughts>, Markdown, explanation, or extra keys. Keep all ⟦EWn⟧ tokens exactly once, unchanged.\n\nRequested fields:\n${JSON.stringify(translationTextMap(batch))}\n\nPrevious model output:\n${finalResponseText(response)}`;
  }

export function buildGenerationPrompt(instructions, mode = 'create', card = null) {
    const source = mode === 'complete' ? `Rewrite and complete this staged character card according to the instructions:\n${JSON.stringify(normalizeGeneratedCardPlaceholders(card))}` : 'Create one complete character card from the user description.';
    return `Start immediately with { and return one strict JSON CCv3-compatible character card: {"spec":"chara_card_v3","spec_version":"3.0","data":{"name":"Real character name","description":"Full description","personality":"Full personality","scenario":"Full scenario","first_mes":"Full opening message","mes_example":"Full example dialogue"}}. Do not output analysis, reasoning, <Thoughts>, Markdown, or explanation. data requires fully written name, description, personality, scenario, first_mes, and mes_example strings. Never use ellipses (… or ...), placeholders, TBD, null, or empty values. Write every character-card prose field in the same language as the user-written brief${mode === 'complete' ? ', unless the user explicitly requests a language change; otherwise preserve the staged card language' : ''}. Use the user-written brief as the creative seed and invent the required character details from it${mode === 'complete' ? ', while respecting the explicitly staged card' : ''}; never use chat history, a persona, profile, active chat, or unprovided Elsewhere state. ${roleGuidance}\n\n${source}\n\nUser-written instructions:\n${instructions}`;
  }

export function buildGenerationRecoveryPrompt(response, instructions, mode = 'create', card = null) {
    const finalText = finalResponseText(response);
    const requiredMacros = mode === 'complete' && card ? collectTranslatableFields(normalizeGeneratedCardPlaceholders(card), { includeEmpty: true }).map(({ path, text }) => ({ field: path.join('.'), macros: [...new Set(text.match(/\{\{[^{}]*\}\}/g) || [])] })).filter(({ macros }) => macros.length) : [];
    const syntax = `Use this JSON structure with double quotes around EVERY key and string: {\"spec\":\"chara_card_v3\",\"spec_version\":\"3.0\",\"data\":{\"name\":\"Real name\",\"description\":\"Description\",\"personality\":\"Personality\",\"scenario\":\"Scenario\",\"first_mes\":\"Opening message\",\"mes_example\":\"Example dialogue\"}}. Correct malformed key quoting; escape quotes and line breaks inside strings. Required distinct macros per staged field (each at least once, repetition count may change): ${JSON.stringify(requiredMacros)}.`;
    const partialCard = finalText ? `\n\nPartial card to complete (preserve useful fields and complete the six required strings):\n${finalText}` : '';
    return `${mode === 'complete' ? `Complete the explicitly staged card without changing lorebook identity: ${JSON.stringify(normalizeGeneratedCardPlaceholders(card))}. ` : ''}${roleGuidance} ${syntax} Start immediately with {. Return one complete strict JSON CCv3 character card for this brief: ${instructions}. Write every character-card prose field in the same language as this brief, unless it explicitly requests another language. Invent the required character details from the brief. Do not output analysis, reasoning, <Thoughts>, Markdown, or explanation. The data must include meaningful name, description, personality, scenario, first_mes, and mes_example strings; never use ... , …, TBD, null, or placeholders.${partialCard}`;
  }

// Provider reasoning is not card content and must never seed the recovery prompt.
export function isThoughtOnlyResponse(response) {
    return typeof response === 'string' && /<(?:thoughts|think)\b/i.test(response) && !finalResponseText(response);
}

export function buildPortraitPrompt(instructions) {
    return `Create a character portrait from the user instructions below. Do not add any text, letters, captions, labels, signatures, logos, watermarks, or typography unless the user explicitly requests them. If text is explicitly requested, include only the requested text. The user instructions describe the desired visual; they are not a caption or text to render. Never quote, transcribe, engrave or reproduce those instructions on a plaque, sign, label or signature unless the user explicitly requests those exact words in the image. Treat signs, books, clothing and backgrounds as unlettered unless lettering is explicitly requested. When a reference image is provided, use it for visual appearance only; remove or omit any reference lettering, labels, logos and watermarks unless the user explicitly requests that text.\n\nUser portrait instructions:\n${instructions}`;
}

export function responseProblemHint(response) {
    if (!response.trim()) return 'The model returned no final text. Check its output-token and reasoning settings, or try another configured model.';
    const finalText = finalResponseText(response);
    if (!finalText) return 'The model returned reasoning without a final card. Check its output-token and reasoning settings, or try another configured model.';
    return 'The model output was incomplete or did not match the requested JSON fields. Inspect the two session-only response diagnostics below; check the configured model and its output-token settings before trying again.';
}
