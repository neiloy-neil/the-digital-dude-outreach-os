/**
 * Mailgun API utility for sending outreach emails with tracking.
 */
interface SendEmailParams {
  apiKey: string;
  domain: string;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  text: string;
  campaignId: string;
  leadId: string;
  outboxId: string;
}

export async function sendOutreachEmail({
  apiKey,
  domain,
  fromName,
  fromEmail,
  to,
  subject,
  text,
  campaignId,
  leadId,
  outboxId,
}: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const mailgunUrl = `https://api.mailgun.net/v3/${domain}/messages`;
    const authHeader = 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64');

    const formData = new URLSearchParams();
    formData.append('from', `${fromName} <${fromEmail}>`);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('text', text);
    
    // Enable tracking
    formData.append('o:tracking', 'yes');
    formData.append('o:tracking-clicks', 'yes');
    formData.append('o:tracking-opens', 'yes');
    
    // Add custom metadata tracking variables
    formData.append('v:campaign-id', campaignId);
    formData.append('v:lead-id', leadId);
    formData.append('v:outbox-id', outboxId);

    const response = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `Mailgun API returned status ${response.status}`,
      };
    }

    // Mailgun response typically contains id (e.g. "<20111114174239.25659.5817@samples.mailgun.org>")
    return {
      success: true,
      messageId: data.id,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown network error sending via Mailgun',
    };
  }
}

/**
 * Verifies the signature of Mailgun webhooks to ensure requests are authentic.
 */
export async function verifyMailgunSignature(
  apiKey: string,
  timestamp: string,
  token: string,
  signature: string
): Promise<boolean> {
  if (!apiKey || !timestamp || !token || !signature) return false;
  
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiKey);
    
    // In Web Crypto API, we import the secret key first
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Signature value is hmac.new(key=apiKey, msg=timestamp + token, digestmod=hashlib.sha256).hexdigest()
    const msgData = encoder.encode(timestamp + token);
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return expectedSignature === signature;
  } catch (e) {
    console.error('Error verifying Mailgun webhook signature:', e);
    return false;
  }
}
