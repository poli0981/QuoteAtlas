/**
 * QuoteAtlas error base class + code registry (docs/02 §6).
 *
 * Lives in `lib/` (not `app/`) so pure-domain modules — which are barred from
 * importing `app/` — can still throw typed errors. Codes map 1:1 to i18n keys
 * and the dialog copy table (docs/06 §9).
 */

export type QaErrorCode =
  | 'E_DATA_LOAD'
  | 'E_MEDIA_QUOTA'
  | 'E_MEDIA_OVERSIZE'
  | 'E_MEDIA_UNCOMPRESSIBLE'
  | 'E_UPDATE_OFFLINE'
  | 'E_UPDATE_RATELIMIT'
  | 'E_UPDATE_NO_RELEASE'
  | 'E_UPDATE_SERVER'
  | 'E_UPDATE_403'
  | 'E_UPDATE_BADSIG';

export class QaError extends Error {
  readonly code: QaErrorCode;

  constructor(code: QaErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'QaError';
    this.code = code;
  }
}
