/** Cash-register vendors we document presets for; 'custom' = any system speaking the /pos API. */
export const POS_TYPES = ['regos', 'yespos', 'billz', 'moysklad', '1c', 'poster', 'iiko', 'jowi', 'custom'] as const;
export type PosType = (typeof POS_TYPES)[number];

/** Header the POS software sends its shop key in. */
export const POS_API_KEY_HEADER = 'x-api-key';

/** Keys are prefixed so a leaked value is recognisable in logs / secret scanners. */
export const POS_API_KEY_PREFIX = 'rk_pos_';

/** One sync request may carry this many products. */
export const POS_SYNC_MAX_ITEMS = 1000;

/** Webhook headers the receiving POS can use to route and verify the event. */
export const POS_WEBHOOK_EVENT_HEADER = 'x-ryadom-event';
export const POS_WEBHOOK_SIGNATURE_HEADER = 'x-ryadom-signature';
