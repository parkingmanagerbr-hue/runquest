/**
 * Normaliza um email para comparação/lookup: trim + minúsculas — a MESMA
 * transformação que o Email value object aplica ao GRAVAR (`raw.trim().toLowerCase()`).
 *
 * Sem isto, os webhooks de pagamento (Hotmart/Cakto) que recuperam o usuário por
 * email faziam `where: { email }` com o valor CRU do provedor. Um comprador que
 * digita "Ana@RunQuest.com" (maiúsculas/espaços) não casava com o "ana@runquest.com"
 * gravado — e um cliente PAGANTE não virava Premium.
 */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}
