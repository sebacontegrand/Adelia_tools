import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Construct the prompt for the LLM
    const systemPrompt = `You are an expert creative technologist and performance advertiser. 
Your job is to generate a complete HTML5 ad creative specification and the HTML/CSS/JS content based on provided inputs.

Hard requirements:
- Output MUST be valid JSON only. No markdown, no commentary.
- The JSON MUST match the schema provided.
- The HTML must be self-contained and reference local assets only (relative paths like "./assets/bg.jpg").
- Do NOT fetch external resources (no CDN scripts, no remote images, no Google fonts).
- Keep the JS minimal and safe (no eval, no inline third-party tracking).
- The ad must include accessible text alternatives and a clear call-to-action.
- If a YouTube video is provided, embed it in a way suitable for ad environments: use a click-to-open fallback if autoplay is not allowed.
- Ensure the creative is responsive within the given width/height.
- Respect the brand voice and compliance constraints provided.`;

    const userTemplate = `Generate an HTML5 advertisement creative and a ZIP package plan using the inputs below.

Return JSON matching this schema exactly:

{
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
16) Background Image Data (Base64): ${body.bgImageData ? "Provided (starts with " + body.bgImageData.substring(0, 30) + "...)" : "Not provided"}

Deliverables:
- Write persuasive ad copy (headline + subhead + CTA) aligned with objective and audience.
- Build a clean layout with logo, message, and CTA.
- If video is provided: show a video preview block with a play button and a fallback link that opens the video in a new tab on click.
- If audio is provided: do NOT autoplay; provide a small “sound” toggle button to play/pause.
- Include a basic impression-safe animation (CSS transitions) unless animationStyle = none.
- If "Gamified": Create a simple click-interaction game (e.g. catch the falling object, click target to reveal offer). Use vanilla JS or Canvas.
- Ensure the creative works without any external dependencies.`;

    console.log("System Prompt:", systemPrompt);
    console.log("User Prompt:", userTemplate);

    // Verify API Key
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Missing GEMINI_API_KEY environment variable.' }, { status: 500 });
    }

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-lite-preview-02-05",
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      let result;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          result = await model.generateContent([systemPrompt, userTemplate]);
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

