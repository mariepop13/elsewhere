// Preserves Elsewords prompt behavior; only explicit staged input is supplied.
const USER_PLACEHOLDER_TOKEN = '__ELS_USER_PLACEHOLDER__';
const CHARACTER_PLACEHOLDER_TOKEN = '__ELS_CHAR_PLACEHOLDER__';
const roleGuidance = `Keep a real character name in data.name. In reusable character prose and dialogue speaker labels, use literal ${CHARACTER_PLACEHOLDER_TOKEN} for the main character and ${USER_PLACEHOLDER_TOKEN} for the user role. These role macros are valid content, not unfinished placeholders. Do not replace unrelated people's names or names the brief explicitly asks to keep literally. Preserve all existing {{...}} macros exactly in a staged card; never expand them to profile or character names.`;
export function translationTextMap(batch) { return Object.fromEntries(batch.map(({ id, text }) => [id, text])); }
export function buildTranslationPrompt(batch, options, target) {
    const source = options.sourceMode === 'auto' ? 'automatically' : `as ${options.sourceLanguage}`;
    return `You are translating character-card text. Detect the source language ${source}. Translate into ${target}. Style: ${options.style}. Preserve original tone: ${options.tone ? 'yes' : 'no'}. ${options.instructions ? `Additional instructions: ${options.instructions}` : ''}\n\nReturn only one valid JSON object mapping every requested field ID to its translated text, for example {"f0":"...","f1":"..."}. Return every ID exactly once and do not add or remove fields. Keep all ⟦EWn⟧ tokens exactly once, unchanged. Preserve symbols, emojis, variables, macros, Markdown, HTML, line breaks, formatting, and intimacy level.\n\n${JSON.stringify(translationTextMap(batch))}`;
  }

export function buildTranslationRecoveryPrompt(response, batch) {
    return `Start immediately with {. Reformat the previous model output into exactly one valid JSON object mapping every requested field ID to its translated text, for example {"f0":"...","f1":"..."}. Include every requested ID exactly once. Do not output analysis, reasoning, <Thoughts>, Markdown, explanation, or extra keys. Keep all ⟦EWn⟧ tokens exactly once, unchanged.\n\nRequested fields:\n${JSON.stringify(translationTextMap(batch))}\n\nPrevious model output:\n${response}`;
  }

export function buildGenerationPrompt(instructions, mode = 'create', card = null) {
    const source = mode === 'complete' ? `Rewrite and complete this staged character card according to the instructions:\n${JSON.stringify(card)}` : 'Create one complete character card from the user description.';
    return `Start immediately with { and return one strict JSON CCv3-compatible character card: {"spec":"chara_card_v3","spec_version":"3.0","data":{"name":"Real character name","description":"Full description","personality":"Full personality","scenario":"Full scenario","first_mes":"Full opening message","mes_example":"Full example dialogue"}}. Do not output analysis, reasoning, <Thoughts>, Markdown, or explanation. data requires fully written name, description, personality, scenario, first_mes, and mes_example strings. Never use ellipses (… or ...), placeholders, TBD, null, or empty values. Write every character-card prose field in the same language as the user-written brief${mode === 'complete' ? ', unless the user explicitly requests a language change; otherwise preserve the staged card language' : ''}. Use the user-written brief as the creative seed and invent the required character details from it${mode === 'complete' ? ', while respecting the explicitly staged card' : ''}; never use chat history, a persona, profile, active chat, or unprovided Elsewhere state. ${roleGuidance}\n\n${source}\n\nUser-written instructions:\n${instructions}`;
  }

export function buildGenerationRecoveryPrompt(response, instructions, mode = 'create', card = null) {
    const partialCard = isThoughtOnlyResponse(response) ? '' : `\n\nPartial card to complete (preserve useful fields and replace every blank):\n${response}`;
    return `${mode === 'complete' ? `Complete the explicitly staged card without changing lorebook identity: ${JSON.stringify(card)}. ` : ''}${roleGuidance} Start immediately with {. Return one complete strict JSON CCv3 character card for this brief: ${instructions}. Write every character-card prose field in the same language as this brief, unless it explicitly requests another language. Invent the required character details from the brief. Do not output analysis, reasoning, <Thoughts>, Markdown, or explanation. The data must include meaningful name, description, personality, scenario, first_mes, and mes_example strings; never use ... , …, TBD, null, or placeholders.${partialCard}`;
  }

export function isThoughtOnlyResponse(response) {
    return typeof response === 'string' && /<(?:thoughts|think)>/i.test(response) && !/"(?:spec|translations|f\d+)"\s*:/i.test(response);
  }

export function buildPortraitPrompt(instructions) {
    return `Create a character portrait from the user instructions below. Do not add any text, letters, captions, labels, signatures, logos, watermarks, or typography unless the user explicitly requests them. If text is explicitly requested, include only the requested text. The user instructions describe the desired visual; they are not a caption or text to render. Never quote, transcribe, engrave or reproduce those instructions on a plaque, sign, label or signature unless the user explicitly requests those exact words in the image. Treat signs, books, clothing and backgrounds as unlettered unless lettering is explicitly requested. When a reference image is provided, use it for visual appearance only; remove or omit any reference lettering, labels, logos and watermarks unless the user explicitly requests that text.\n\nUser portrait instructions:\n${instructions}`;
}

export function responseProblemHint(response) {
    if (!response.trim()) return 'The model returned no final text. Check its output-token and reasoning settings, or try another configured model.';
    const finalText = response.replace(/<(?:thoughts|think)\b[^>]*>[\s\S]*?<\/(?:thoughts|think)>/gi, '').trim();
    if (!finalText || /^<(?:thoughts|think)\b/i.test(finalText) && !finalText.includes('</')) return 'The model returned reasoning without a final card. Check its output-token and reasoning settings, or try another configured model.';
    return 'The model output was incomplete or did not match the requested JSON fields. Inspect the two session-only response diagnostics below; check the configured model and its output-token settings before trying again.';
}
