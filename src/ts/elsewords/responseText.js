// Discard tagged provider reasoning before extraction or recovery. Never infer a final
// answer from an unclosed reasoning block.
export function finalResponseText(response) {
  if (typeof response !== 'string') return '';
  return response.replace(/<(thoughts|think)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<(?:thoughts|think)\b[^>]*>[\s\S]*$/i, '').trim();
}
