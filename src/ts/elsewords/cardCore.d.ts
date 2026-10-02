export type Card = Record<string, any>;
export interface ReviewField { id?: string; path: (string | number)[]; original: string | null; translation: string; baseline: string; draft: string }
export function clone<T>(value: T): T;
export function cardData(card: Card): any;
export function cardForElsewhereExport(card: Card): Card;
export function cardForElsewhereCreation(card: Card): any;
export function cardExportFilename(card: Card, kind: string, format: string): string;
export function collectTranslatableFields(card: Card, options?: { translateNames?: boolean; includeEmpty?: boolean }): any[];
export function createBatches(fields: any[], maxCharacters?: number): any[][];
export function parseBatchResponse(response: string, batch: any[]): any[];
export function parseGeneratedCardResponse(response: string): Card;
export function applyTranslations(card: Card, fields: any[], translations: any[]): Card;
export function createOutputReview(output: Card, original?: Card): ReviewField[];
export function applyOutputReview(output: Card, review: ReviewField[], options?: { generated?: boolean }): Card;
export function mergeCompletedCard(original: Card, generated: Card): Card;
export function extractPngCard(base64: string): { card: Card; png: string };
export function embedCardInPng(base64: string, card: Card): string;
