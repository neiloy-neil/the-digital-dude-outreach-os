import { GoogleGenAI } from '@google/genai';

interface PersonalizeParams {
  apiKey: string;
  lead: {
    first_name?: string | null;
    last_name?: string | null;
    company?: string | null;
    solution?: string | null;
    email: string;
    variables?: Record<string, any>;
  };
  promptInstructions: string;
}

export async function generateAIPersonalization({
  apiKey,
  lead,
  promptInstructions,
}: PersonalizeParams): Promise<string> {
  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    let personalizedPrompt = promptInstructions
      .replace(/\{\{first_name\}\}/g, lead.first_name || 'there')
      .replace(/\{\{last_name\}\}/g, lead.last_name || '')
      .replace(/\{\{company\}\}/g, lead.company || 'your company')
      .replace(/\{\{solution\}\}/g, lead.solution || '')
      .replace(/\{\{email\}\}/g, lead.email);

    if (lead.variables) {
      Object.entries(lead.variables).forEach(([key, val]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        personalizedPrompt = personalizedPrompt.replace(regex, String(val || ''));
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are personalizing a cold outreach email. Create a short, highly-personalized, natural-sounding phrase or sentence based on the following instructions. Do NOT include greeting or sign-off, just output the sentence itself. Do not use quotes around the output.
              
Instructions: ${personalizedPrompt}`
            }
          ]
        }
      ],
    });

    const text = response.text || '';
    return text.trim().replace(/^"|"$/g, '');
  } catch (error: any) {
    console.error('Error generating Gemini personalization:', error);
    throw new Error(`Gemini Error: ${error.message || error}`);
  }
}

interface DetailedPersonalizeParams {
  apiKey: string;
  lead: Record<string, any>;
  sequenceTemplate: {
    subject: string;
    body: string;
  };
  customInstructions: string;
}

export interface PersonalizationResult {
  strategy: string;
  subject: string;
  body: string;
}

export async function generateDetailedPersonalization({
  apiKey,
  lead,
  sequenceTemplate,
  customInstructions,
}: DetailedPersonalizeParams): Promise<PersonalizationResult> {
  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Format lead data as a clean readable block
    const leadDataBlock = Object.entries(lead)
      .filter(([_, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
      .join('\n');

    const prompt = `You are a world-class B2B cold outreach expert. 
Your task is to analyze all data for a specific lead and write a personalized email outreach strategy, subject line, and email body.

---
LEAD DATA:
${leadDataBlock}

---
GENERIC SEQUENCE STEP 1 TEMPLATE:
Subject: ${sequenceTemplate.subject}
Body:
${sequenceTemplate.body}

---
CUSTOM PERSONALIZATION INSTRUCTIONS / GOALS:
${customInstructions}

---
TASK DIRECTIONS:
1. "strategy": Formulate a 1-2 sentence outreach strategy based on their tech stack, priority, pain points, size, or solution fit score. Explain why you are tailoring it this way.
2. "subject": Write a personalized, short subject line. It can build upon the template but should feel custom (no brackets, no generic tokens).
3. "body": Draft a highly-personalized, conversational, and natural email body. Replace variables like {{first_name}}, {{company}}, etc. with actual data. Customize the opening or reference their pain points and trigger event if available. Do not sound robotic. Maintain a professional, helpful tone.

Respond ONLY with a valid JSON object matching this structure:
{
  "strategy": "...",
  "subject": "...",
  "body": "..."
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const responseText = response.text || '{}';
    const parsed: PersonalizationResult = JSON.parse(responseText);

    return {
      strategy: parsed.strategy || 'Direct outreach based on company profile.',
      subject: parsed.subject || sequenceTemplate.subject,
      body: parsed.body || sequenceTemplate.body,
    };
  } catch (error: any) {
    console.error('Error generating detailed Gemini personalization:', error);
    throw new Error(`Gemini Detailed Error: ${error.message || error}`);
  }
}
