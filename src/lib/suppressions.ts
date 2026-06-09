import 'server-only';

import { checkSuppression } from '@/lib/suppression/check-suppression';

export async function getSuppressionForEmail(userId: string, email: string) {
  return checkSuppression(userId, email);
}
