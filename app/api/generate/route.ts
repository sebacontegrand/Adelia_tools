import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Construct the prompt for the LLM
    const systemPrompt = `You are an elite creative technologist and high-performance advertising director. 
Your job is to generate three (3) distinct, high-impact HTML5 ad creative variations based on provided inputs and uploaded images.

Hard requirements:
- Output MUST be valid JSON only. No markdown, no commentary.
- The JSON MUST be an array containing 3 distinct creative objects.
- Each creative must have its own "id", "meta", "files", and "manifest".
- The HTML must be self-contained and reference local assets under "./assets/".
- If a provided asset name is missing, use high-quality placeholders.
- Designs must be "WOW" level: modern, vibrant, and perfectly matched to the color palette and style of the uploaded images.
- FOR GAMIFIED ADS: Create a real mini-game experience. Include a proper game loop (requestAnimationFrame), collision detection, score, and a clear "Win/Play Again" screen. Use <canvas> or high-performance DOM manipulation.
- FOR INTERACTIVE/QUIZ ADS: Create multiple steps or slides. Include state transitions, animations between questions, and a customized result based on user choices.
- THE BACKGROUND IMAGE (if provided via Vision) IS YOUR PRIMARY INSPIRATION: its colors, lighting, composition, and mood must dictate the entire creative direction of the ad.
- YOU MUST ANALYZE THE UPLOADED IMAGES TO EXTRACT COLOR PALETTES, TYPOGRAPHY STYLE, AND BRAND VIBE.
- Variations should differ in layout and animation, but all must feel like a natural extension of the uploaded background.
- Keep the JS minimal and safe.
- Ensure the creative is responsive within the given width/height.`;

    const userTemplate = `Generate an HTML5 advertisement creative and a ZIP package plan using the inputs below.

Return a JSON ARRAY of 3 objects, each matching this schema:

{
  "id": string (unique slug like "v1-minimalist"),
  "meta": {
    "creativeName": string,
    "dimensions": { "width": number, "height": number },
    "clickTagVariable": string,
    "notes": string[]
  },
  "files": [
    { "path": string, "type": "text" | "binary", "content": string }
  ],
  "manifest": {
    "version": "1.0",
    "createdAt": string,
    "assets": { "images": string[], "audio": string[], "video": string[] },
    "entry": string
  }
}

Rules for "files":
- Include at minimum:
  - "index.html" (type "text")
  - "styles.css" (type "text")
  - "script.js" (type "text")
  - "README.txt" (type "text") explaining how to test locally
- Any uploaded assets must be referenced under "./assets/..."
- For binary files, set "content" to the literal filename only (no base64), since binaries are already provided by the build pipeline.
- Use "clickTagVariable" exactly as provided below (e.g., "clickTag").

Inputs:
1) Ad objective: ${body.objective}
2) Brand name: ${body.brandName}
3) Brand voice (choose and apply): ${body.brandVoice}
4) Target audience: ${body.audience}
5) Key message: ${body.keyMessage}
6) CTA text: ${body.ctaText}
7) Mandatory disclaimer text (if any): ${body.disclaimer}
8) Dimensions: ${body.width}x${body.height}
9) Assets provided (local files, already uploaded):
   - Background image: ${body.bgImageName}
   - Logo image: ${body.logoImageName}
   - Product image(s): ${body.productImageNames}
   - Audio/logo sting: ${body.audioName}
   - YouTube video URL: ${body.youtubeUrl}
10) Color palette (optional): ${body.palette}
11) Typography preference (optional): ${body.typography}
12) Animation preference: ${body.animationStyle}
13) Creative Format: ${body.creativeFormat} (IMPORTANT: If "Gamified", the output MUST be a playable mini-game using simple JS/Canvas, not just a banner)
14) Compliance constraints: ${body.complianceConstraints}
15) clickTag variable name: ${body.clickTagVar}
16) Custom Ideas / Creative Instructions: ${body.customIdeas || "None provided. Use your creative expertise."}
17) Background Image Data (Base64): ${body.bgImageData ? "Provided (starts with " + body.bgImageData.substring(0, 30) + "...)" : "Not provided"}

Deliverables:
- 3 distinct variations that "WOW" the user. 
- Use premium color palettes and modern layout techniques (flexbox, grid).
- Variated headlines and CTAs across the 3 options.
- FORMAT-SPECIFIC INSTRUCTIONS:
  - If "Gamified": Each variation must have a different mechanic (e.g., v1: catching items falling, v2: simple shooter, v3: memory game). The code MUST handle the game logic, rendering, and interaction.
  - If "Interactive": Each variation must have a different flow (e.g., v1: yes/no quiz, v2: personality test, v3: click-to-reveal details). Transition should be smooth.
- Ensure each variation works perfectly as a standalone preview.`;

    console.log("System Prompt:", systemPrompt);
    console.log("User Prompt:", userTemplate);

    // Verify API Key
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Missing GEMINI_API_KEY environment variable.' }, { status: 500 });
    }

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      // Prepare multi-modal parts
      const promptParts: any[] = [systemPrompt, userTemplate];

      // Helper to convert base64 to parts
      const assetToPart = (base64Data: string) => {
        if (!base64Data || !base64Data.includes(';base64,')) return null;
        const [mimeTypePart, data] = base64Data.split(';base64,');
        const mimeType = mimeTypePart.split(':')[1];
        return {
          inlineData: {
            data: data,
            mimeType: mimeType
          }
        };
      };

      if (body.bgImageData) {
        const part = assetToPart(body.bgImageData);
        if (part) promptParts.push(part);
      }

      if (body.logoImageData) {
        const part = assetToPart(body.logoImageData);
        if (part) promptParts.push(part);
      }

      // If there are multiple product image datas, they could be sent as well
      if (body.productImageDatas && Array.isArray(body.productImageDatas)) {
        body.productImageDatas.forEach((data: string) => {
          const part = assetToPart(data);
          if (part) promptParts.push(part);
        });
      }

      let result;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          result = await model.generateContent(promptParts);
          break; // Success, exit loop
        } catch (callError: any) {
          if (callError.message?.includes('429') || callError.status === 429) {
            retryCount++;
            if (retryCount >= maxRetries) throw callError;

            console.log(`Rate limit hit. Retrying attempt ${retryCount}/${maxRetries} in 10 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s between retries
          } else {
            throw callError; // Re-throw non-429 errors immediately
          }
        }
      }

      const responseText = result!.response.text();

      console.log("Gemini Response:", responseText);

      if (!responseText) {
        throw new Error('Gemini returned empty content.');
      }

      let parsedContent;
      try {
        parsedContent = JSON.parse(responseText);
      } catch (e) {
        console.error('JSON Parse Error:', e);
        throw new Error('Failed to parse Gemini response as JSON.');
      }

      return NextResponse.json(parsedContent);

    } catch (error: any) {
      console.error('Error calling Gemini:', error);

      if (error.message?.includes('429') || error.status === 429) {
        return NextResponse.json({ error: 'Gemini API Rate Limit Exceeded. Please try again in 30 seconds.' }, { status: 429 });
      }

      return NextResponse.json({ error: error.message || 'Failed to generate creative via API' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

