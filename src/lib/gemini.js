import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("Gemini API key is missing. AI features will be disabled.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "dummy_key");

export const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
