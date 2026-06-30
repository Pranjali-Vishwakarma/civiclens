export interface GeminiGenerateOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiAnalysis {
  category: 'pothole' | 'streetlight' | 'water_leak' | 'garbage' | 'road_damage' | 'other';
  severity: 1 | 2 | 3 | 4 | 5;
  title: string;
  description: string;
  suggested_department: string;
  confidence: number;
  is_infrastructure_issue: boolean;
}

export class GeminiAnalysisError extends Error {
  constructor(message: string, public rawResponse?: string) {
    super(message);
    this.name = 'GeminiAnalysisError';
  }
}

/**
 * Lightweight, dependency-free wrapper for the Gemini API.
 * Uses fetch to send prompt requests to the Gemini API endpoint.
 */
export async function generateContent(
  prompt: string,
  options: GeminiGenerateOptions = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in the environment variables.');
  }

  const model = options.model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxOutputTokens,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API request failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Could not extract text from Gemini API response. The response might have been blocked or format changed.');
  }

  return text;
}

/**
 * Sends a base64 encoded photo and location hints to the Gemini 1.5 Flash API
 * to semantically classify the civic issue and return structured analytical details.
 */
export async function analyzeIssuePhoto(
  imageBase64: string,
  mimeType: string,
  locationHint: string
): Promise<GeminiAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiAnalysisError('GEMINI_API_KEY environment variable is not defined.');
  }

  const model = 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Strip out any data URL scheme prefix if present
  const cleanBase64 = imageBase64.includes(';base64,')
    ? imageBase64.split(';base64,')[1]
    : imageBase64;

  const systemPrompt = `You are a civic issue classifier for a smart city platform.
Analyze this photo and return ONLY a valid JSON object with these fields:
{
  category: one of [pothole, streetlight, water_leak, garbage, road_damage, other],
  severity: integer 1-5 (1=minor cosmetic, 5=immediate danger),
  title: short 5-8 word title describing the issue,
  description: 2-3 sentence description suitable for a municipal complaint,
  suggested_department: e.g. PWD, Municipal Corporation, Electricity Board,
  confidence: float 0.0-1.0,
  is_infrastructure_issue: boolean
}
Return ONLY the JSON. No markdown, no explanation.`;

  const requestPayload = {
    contents: [
      {
        parts: [
          {
            text: `${systemPrompt}\n\nLocation context/hint: ${locationHint}`
          },
          {
            inlineData: {
              mimeType,
              data: cleanBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  const executeApiCall = async (payload: typeof requestPayload): Promise<string> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new GeminiAnalysisError(`Gemini API request failed: ${response.status} ${response.statusText}. Details: ${errorText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new GeminiAnalysisError('Failed to retrieve classification response from Gemini candidates.');
    }
    return text.trim();
  };

  let resultText = '';
  try {
    resultText = await executeApiCall(requestPayload);
    const cleanedText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedText) as GeminiAnalysis;
  } catch (initialError) {
    const errorMsg = initialError instanceof Error ? initialError.message : String(initialError);
    console.warn('First attempt to parse Gemini API response failed. Retrying with stricter constraints. Error:', errorMsg);
    
    try {
      // Stricter request payload retry
      const retryPayload = {
        ...requestPayload,
        contents: [
          {
            parts: [
              {
                text: `${systemPrompt}\n\nLocation context/hint: ${locationHint}\n\nCRITICAL: Your previous response was not valid JSON. Ensure you return ONLY the valid raw JSON object. Do not include markdown code block characters (\`\`\`json) or external descriptions.`
              },
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64
                }
              }
            ]
          }
        ]
      };

      resultText = await executeApiCall(retryPayload);
      const cleanedText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanedText) as GeminiAnalysis;
    } catch (retryError) {
      const errorMsg = retryError instanceof Error ? retryError.message : String(retryError);
      throw new GeminiAnalysisError(
        `Failed to parse Gemini response as JSON after a retry attempt: ${errorMsg}`,
        resultText
      );
    }
  }
}

export interface PredictiveInsight {
  hotspot_wards: { ward: string; risk_level: 'high' | 'medium' | 'low'; reason: string }[];
  prediction: string;
  recommended_action: string;
}

/**
 * Invokes Gemini 1.5 Flash to analyze historical ward issue data and return
 * structured predictive insights regarding potential hotspots and recommended actions.
 */
export async function generatePredictiveInsight(wardData: {
  ward_name: string;
  issue_counts_by_week: number[];
  top_categories: string[];
  avg_severity: number;
}): Promise<PredictiveInsight> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in the environment variables.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const systemInstruction = `You are a civic data analyst for a smart city platform.
Given historical issue report data, generate a brief predictive insight.
Return ONLY a valid JSON object. No markdown, no explanation, no code fences.`;

  const userMessage = `Here is the last 30 days of civic issue data for Pune:
{
  "ward_name": "${wardData.ward_name}",
  "issue_counts_by_week": ${JSON.stringify(wardData.issue_counts_by_week)},
  "top_categories": ${JSON.stringify(wardData.top_categories)},
  "avg_severity": ${wardData.avg_severity}
}`;

  const requestPayload = {
    contents: [
      {
        parts: [
          {
            text: userMessage
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: systemInstruction
        }
      ]
    },
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  const executeApiCall = async (payload: typeof requestPayload): Promise<string> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new GeminiAnalysisError(`Gemini API request failed: ${response.status} ${response.statusText}. Details: ${errorText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new GeminiAnalysisError('Failed to retrieve predictive insight response from Gemini candidates.');
    }
    return text.trim();
  };

  let resultText = '';
  try {
    resultText = await executeApiCall(requestPayload);
    const cleanedText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedText) as PredictiveInsight;
  } catch (initialError) {
    const errorMsg = initialError instanceof Error ? initialError.message : String(initialError);
    console.warn('First attempt to parse predictive insight response failed. Retrying with stricter constraints. Error:', errorMsg);
    
    try {
      const retryPayload = {
        ...requestPayload,
        contents: [
          {
            parts: [
              {
                text: `${userMessage}\n\nCRITICAL: Your previous response was not valid JSON. Ensure you return ONLY the valid raw JSON object. Do not include markdown code block characters (\`\`\`json) or external descriptions.`
              }
            ]
          }
        ]
      };

      resultText = await executeApiCall(retryPayload);
      const cleanedText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanedText) as PredictiveInsight;
    } catch (retryError) {
      const errorMsg = retryError instanceof Error ? retryError.message : String(retryError);
      throw new GeminiAnalysisError(
        `Failed to parse Gemini predictive response as JSON after a retry attempt: ${errorMsg}`,
        resultText
      );
    }
  }
}

/**
 * Resizes an image file to a maximum of 800px on the longest side
 * using the HTML5 Canvas API, and returns its raw base64 data and mime type.
 * Note: This runs client-side in the browser before invoking the API.
 */
export function compressImageToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxSideLength = 800;

        if (width > maxSideLength || height > maxSideLength) {
          if (width > height) {
            height = Math.round((height * maxSideLength) / width);
            width = maxSideLength;
          } else {
            width = Math.round((width * maxSideLength) / height);
            height = maxSideLength;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Could not retrieve Canvas 2D render context.'));
          return;
        }

        context.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL(file.type);
        
        // Strip data:image/...;base64, prefix
        const base64Parts = dataUrl.split(';base64,');
        const base64Data = base64Parts[1] || base64Parts[0];

        resolve({
          base64: base64Data,
          mimeType: file.type,
        });
      };
      
      img.onerror = (error) => reject(error);
      img.src = event.target?.result as string;
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}
