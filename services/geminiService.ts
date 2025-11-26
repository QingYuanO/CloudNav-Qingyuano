import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Ensure API key is available in environment
const API_KEY = process.env.API_KEY || '';

let ai: GoogleGenAI | null = null;

if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
}

/**
 * Uses Gemini to generate a short, catchy description for a website based on its title and URL.
 */
export const generateLinkDescription = async (title: string, url: string): Promise<string> => {
  if (!ai) {
    console.warn("Gemini API Key missing.");
    return "API Key 未配置，无法生成描述。";
  }

  try {
    const prompt = `
      I have a website bookmark.
      Title: ${title}
      URL: ${url}

      Please write a very short description (max 15 words) in Chinese (Simplified) that explains what this website is for.
      Return ONLY the description text. No quotes.
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text;
    return text ? text.trim() : "无法生成描述";
  } catch (error) {
    console.error("Gemini generation error:", error);
    return "生成描述失败";
  }
};

/**
 * Suggests a category from a provided list for a new link.
 */
export const suggestCategory = async (title: string, url: string, categories: {id: string, name: string}[]): Promise<string | null> => {
    if (!ai) return null;

    try {
        const catList = categories.map(c => `${c.id}: ${c.name}`).join('\n');
        const prompt = `
            Task: Categorize this website.
            Website: "${title}" (${url})

            Available Categories:
            ${catList}

            Return ONLY the 'id' of the best matching category. If unsure, return 'common'.
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text ? response.text.trim() : null;
    } catch (e) {
        console.error(e);
        return null;
    }
}
