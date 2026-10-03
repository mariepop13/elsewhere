/**
 * @typedef {Object} Preferences
 * @property {'auto' | 'manual'} sourceMode
 * @property {string} sourceLanguage
 * @property {string} target
 * @property {string} customTarget
 * @property {'natural' | 'faithful' | 'close'} style
 * @property {string} instructions
 * @property {boolean} tone
 * @property {boolean} names
 */
/** @type {Readonly<Preferences>} */
export const defaultPreferences = Object.freeze({ sourceMode: 'auto', sourceLanguage: '', target: '', customTarget: '', style: 'natural', instructions: '', tone: true, names: true });
export const preferenceKey = 'elsewhere_elsewords_preferences_v1';
/** @param {unknown} value
 * @returns {Preferences}
 */
export function validatePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('No recognizable Elsewords preferences were found.');
  const keys = Object.keys(defaultPreferences);
  if (Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => typeof value[key] !== typeof defaultPreferences[key])) throw new Error('The legacy settings are ambiguous. They have not been changed.');
  if ((value.sourceMode !== 'auto' && value.sourceMode !== 'manual') || (value.style !== 'natural' && value.style !== 'faithful' && value.style !== 'close')) throw new Error('The stored language mode or style is unsupported. The original settings are retained.');
  const targets = ['', 'English', 'French', 'Spanish', 'German', 'Italian', 'Portuguese', 'Japanese', 'Korean', 'Chinese (Simplified)', 'Arabic', 'Russian', 'Other'];
  if (!targets.includes(value.target)) throw new Error('The stored target choice is unsupported. The original settings are retained.');
  return {
    sourceMode: value.sourceMode, sourceLanguage: value.sourceLanguage,
    target: value.target, customTarget: value.customTarget, style: value.style,
    instructions: value.instructions, tone: value.tone, names: value.names,
  };
}
/** @param {Storage} storage
 * @returns {{ values: Preferences, imported: boolean, exists: boolean }}
 */
export function loadPreferences(storage) {
  const raw = storage.getItem(preferenceKey);
  if (raw === null) return { values: { ...defaultPreferences }, imported: false, exists: false };
  const saved = JSON.parse(raw);
  if (saved.version !== 1) throw new Error('The saved Elsewords preferences use an unsupported version.');
  return { values: validatePreferences(saved.values), imported: saved.imported === true, exists: true };
}
/** @param {Storage} storage
 * @param {Preferences} values
 * @param {boolean} [imported]
 */
export function persistPreferences(storage, values, imported = false) {
  storage.setItem(preferenceKey, JSON.stringify({ version: 1, values: validatePreferences(values), imported }));
}
