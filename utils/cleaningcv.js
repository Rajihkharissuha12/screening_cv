const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY1 });

async function cleanCVText(rawText) {
  const cleaningPrompt = `
  Please remove the content from the following sections while keeping the rest of the CV content intact:
  - Description/Summary/About Me
  - Skills/Abilities
  - Organizational Experience
  - Journal Publications
  - Side Projects
  - Bootcamps/Certificates
  - References
  - Seminars/Workshops
  - Hobbies/Interests
  - Non-Professional Achievements

  Only keep:
  - Personal Information (Name, Contact)
  - Formal Education (University/School)
  - Professional Work Experience

  Original CV:
  ${rawText}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: cleaningPrompt,
    });

    const cleanedText =
      response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return cleanedText.replace(/```/g, "").trim(); // Clean markdown backticks
  } catch (error) {
    console.error("Error cleaning CV:", error);
    return rawText; // Return original text if error
  }
}

module.exports = { cleanCVText };
