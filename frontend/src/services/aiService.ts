// aiService.ts
// frontend/src/services/aiService.ts


// Configuration (Uniquement utilisé en mode serverless)
const API_KEY = import.meta.env.VITE_AI_API_KEY;
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";


/**
 * Nettoie la réponse brute d'un LLM pour extraire le JSON.
 */
const cleanJsonOutput = (text: string): string => {
  return text.replace(/```json|```/g, "").trim();
};

export const generateStructuredData = async <T>(
  userPrompt: string,
  systemContext: string,
  jsonStructureExample: string,
): Promise<T> => {

  const fullPrompt = `
    RÔLE: Tu es un assistant structuré.
    TACHE: ${systemContext}
    INPUT UTILISATEUR: "${userPrompt}"
    
    FORMAT DE SORTIE OBLIGATOIRE:
    - JSON Strict.
    - Pas de markdown.
    - Pas de texte avant ou après.
    - Structure exacte : ${jsonStructureExample}
  `;

  try {
    let rawText = "";

    
    // --- MODE SERVERLESS (Direct) ---
    if (!API_KEY) throw new Error("Clé API IA manquante");
    
    const response = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
      }),
    });

    if (!response.ok) throw new Error(`Erreur API IA: ${response.statusText}`);

    const data = await response.json();
    rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    

    if (!rawText) throw new Error("Réponse IA vide ou malformée");
    const cleanJson = cleanJsonOutput(rawText);
    return JSON.parse(cleanJson) as T;

  } catch (error) {
    console.error("AI Service Error:", error);
    throw error;
  }
};

export const generateQuoteProjectDescription = async (payload: {
  platform: string;
  language: string;
  clientName: string;
  website: string;
  goals: string;
}): Promise<string> => {
  const result = await generateStructuredData<{ description: string }>(
    JSON.stringify(payload),
    `Rédige une description de projet pour un devis web.
    La réponse doit être professionnelle, concise et directement exploitable dans un devis.
    Respecte la langue "${payload.language}".
    Mets en avant les objectifs business, le périmètre et le bénéfice client.`,
    '{"description":"string"}',
  );

  return result.description;
};

export const generateQuoteEmailDraft = async (payload: {
  language: string;
  clientName: string;
  quoteRef: string;
  projectSummary: string;
  totalWithVat: number;
}): Promise<{ subject: string; body: string }> => {
  return generateStructuredData<{ subject: string; body: string }>(
    JSON.stringify(payload),
    `Rédige un email d'envoi de devis dans la langue "${payload.language}".
    Ton: professionnel, chaleureux, direct.
    Donne un objet d'email et un corps d'email court, avec appel à validation ou questions.`,
    '{"subject":"string","body":"string"}',
  );
};
