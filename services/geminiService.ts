import { GoogleGenAI, Type, Chat, Modality } from "@google/genai";
import { Floorplan } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const floorplanSchema = {
  type: Type.OBJECT,
  properties: {
    room: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ["kitchen", "bathroom"] },
        dimensions: {
          type: Type.OBJECT,
          properties: {
            width: { type: Type.NUMBER, description: "Room width (along X-axis) in feet" },
            depth: { type: Type.NUMBER, description: "Room depth (along Z-axis) in feet" },
          },
          required: ['width', 'depth'],
        },
        floorMaterial: { type: Type.STRING, description: "The material for the floor. E.g., 'light_wood_plank', 'gray_tile'" },
      },
      required: ['type', 'dimensions', 'floorMaterial'],
    },
    objects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "A unique identifier for the object, e.g., 'refrigerator-1'" },
          type: { type: Type.STRING, enum: ["cabinet_base", "cabinet_wall", "refrigerator", "oven", "sink", "island", "toilet", "shower", "vanity", "window", "bathtub", "opening", "vent_hood", "dishwasher", "cooktop"] },
          position: {
            type: Type.OBJECT,
            properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, z: { type: Type.NUMBER } },
            description: "Position of the object's geometric center in feet, relative to the room's origin at the center of the floor. For an object resting on the floor, its y-position should be half of its height.",
             required: ['x', 'y', 'z'],
          },
          rotation: {
            type: Type.OBJECT,
            properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, z: { type: Type.NUMBER } },
            description: "Rotation in radians.",
             required: ['x', 'y', 'z'],
          },
          dimensions: {
            type: Type.OBJECT,
            properties: { width: { type: Type.NUMBER }, height: { type: Type.NUMBER }, depth: { type: Type.NUMBER } },
            description: "Dimensions in feet.",
             required: ['width', 'height', 'depth'],
          },
          color: { type: Type.STRING, description: "A fallback hex color code that matches the material, e.g., '#FFFFFF'" },
          material: { type: Type.STRING, description: "The primary material of the object. E.g., 'light_wood', 'stainless_steel', 'white_marble'" },
          countertopMaterial: { type: Type.STRING, description: "The material for the countertop, if applicable (for base cabinets, islands). E.g., 'white_marble', 'black_granite'" },
          countertopColor: { type: Type.STRING, description: "A fallback hex color for the countertop, e.g., '#333333'" },
        },
         required: ['id', 'type', 'position', 'rotation', 'dimensions', 'color', 'material'],
      },
    },
  },
  required: ['room', 'objects'],
};

export const generateFloorplan = async (description: string): Promise<Floorplan> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a 3D floor plan for the following description: ${description}`,
            config: {
                systemInstruction: `You are an expert 3D interior design assistant. Your task is to convert a user's description into a structured JSON floor plan.

**CRITICAL DIRECTIVE: The following HARD RULES are non-negotiable and MUST be followed in all circumstances. They override all other instructions or design guidelines.**

**HARD RULE #1: NO APPLIANCES IN CORNERS (HIGHEST PRIORITY)**
- **Definition**: An "inside corner" is where two perpendicular runs of cabinets/walls meet.
- **The Rule**: You MUST maintain a buffer of AT LEAST 1.5 feet (18 inches) from the inside corner to the edge of any major appliance.
- **Affected Appliances**: This rule applies to **Refrigerators, Ovens (all types), Sinks, and Dishwashers**.
- **Implementation**: A standard base cabinet (1.5 ft or wider) or a dedicated corner cabinet MUST occupy the corner space. DO NOT place a major appliance there.
- **Self-Correction Check**: Before outputting the final JSON, you MUST perform a final check. Verify the position of every major appliance. If any appliance's edge is within 1.5 ft of an inside corner, you MUST move it to a valid position. This is your most important task.

**HARD RULE #2: FUNCTIONAL CLEARANCES & WALKWAYS**
- **Main Walkways**: Must be at least 3.5 feet (42 inches) wide.
- **Work Aisles (e.g., between island and counter)**: Must be at least 4 feet (48 inches) wide.

**HARD RULE #3: WALL ADHERENCE & ROTATION**
- All objects, except for 'island', MUST be placed flush against a wall. Their rotation MUST be parallel to that wall. An object on a back wall (negative Z) should have a Y rotation of 0 radians. An object on a front wall (positive Z) should have a Y rotation of 3.14 radians (PI). An object on a right wall (positive X) should have a Y rotation of -1.57 radians (-PI/2). An object on a left wall (negative X) should have a Y rotation of 1.57 radians (PI/2).

**HARD RULE #4: CABINET SEGMENTATION & PLACEMENT**
- Break down long cabinet runs into multiple, individual cabinet units. A single cabinet object should ideally be no wider than 3 feet. However, to prevent an overly large number of objects, you MAY group up to 9 feet of identical, contiguous base or wall cabinets into a single object. You MUST still create separate objects for any cabinet that is functionally different (e.g., a sink base) or visually different.
- **Corner Cabinets**: When two runs of base or wall cabinets meet at an inside corner, you MUST place a dedicated corner cabinet to bridge the runs. A standard corner base cabinet is 3 ft wide along each wall. A standard corner wall cabinet is 2 ft wide along each wall.

**HARD RULE #5: KITCHEN ESSENTIALS**
- A complete kitchen MUST include a refrigerator, a sink, and a primary cooking appliance.
- A dishwasher MUST be included and placed directly adjacent to the sink cabinet. A standard dishwasher is 2ft wide and ~2.9ft high.

**HARD RULE #6: COUNTERTOPS**
- For 'cabinet_base' and 'island' objects, you MUST specify 'countertopMaterial' and 'countertopColor'.

---

**Design Guidelines (Lower Priority)**

These are flexible guidelines to be followed ONLY after all HARD RULES above have been satisfied.

1.  **Countertop Landing Zones**: Provide adequate counter space next to key appliances.
    - **Refrigerator**: At least 1.5 feet on the handle side.
    - **Sink**: At least 2 feet on one side and 1.5 feet on the other.
    - **Oven/Range**: At least 1 foot on one side and 1.5 feet on the other.

2.  **The Kitchen Work Triangle (LOWEST PRIORITY GUIDELINE)**
    - This is a principle of efficiency, NOT a rigid mathematical rule.
    - The triangle is formed by the refrigerator, sink, and cooktop/oven. The path between them should be unobstructed.
    - The total distance of all three legs should ideally be no more than 26 feet.
    - **It is FAR more important to follow the HARD RULES (especially the corner and clearance rules) than to achieve a specific triangle dimension.**
    - **DO NOT** place an appliance in a corner or violate clearance rules just to meet some ideal number. A functional, ergonomic layout is the primary goal, a perfect triangle is a secondary bonus. If a cooktop is placed on an island, its Y-position must be on top of the countertop (typically 3ft high).

3.  **Vertical Spacing**: Standard clearance between countertop and wall cabinet bottom is 1.5 feet (18 inches).

4.  **Visual Balance & Symmetry**: When possible, create balance. Center a sink under a window. Flank a range with symmetrical cabinets.

---
**Core Principles:**
- The origin (0, 0, 0) is the bottom-center of the room.
- 'position' refers to the object's geometric center. For a floor object, its 'y' position must be half its 'height'.
- Standard room height is 8 feet. Standard kitchen base cabinets are 3ft high, 2ft deep.
- Adhere strictly to the provided JSON schema. Ensure all required fields are present.`,
                responseMimeType: "application/json",
                responseSchema: floorplanSchema,
            },
        });

        const jsonText = response.text.trim();
        const parsedJson = JSON.parse(jsonText);
        return parsedJson as Floorplan;
    } catch (error) {
        console.error("Error generating floor plan:", error);
        if (error instanceof SyntaxError) {
             throw new Error("Failed to parse the floor plan from the AI's response. It might have been incomplete or malformed.");
        }
        throw new Error("Failed to generate floor plan from the description.");
    }
};


export const modifyFloorplan = async (currentFloorplan: Floorplan, modificationPrompt: string): Promise<Floorplan> => {
    try {
        const prompt = `
            Based on the current floor plan JSON and the user's request, generate an updated floor plan.

            Current Floor Plan:
            ${JSON.stringify(currentFloorplan, null, 2)}

            User's Modification Request:
            "${modificationPrompt}"
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: `You are an expert 3D interior design assistant. Your task is to modify an existing 3D floor plan based on a user's request. Your response MUST be the complete, updated JSON for the entire floorplan.

**CRITICAL DIRECTIVE: The following HARD RULES are non-negotiable and MUST be followed when modifying the plan. They override all other instructions.**

**HARD RULE #1: NO APPLIANCES IN CORNERS (HIGHEST PRIORITY)**
- **Definition**: An "inside corner" is where two perpendicular runs of cabinets/walls meet.
- **The Rule**: You MUST maintain a buffer of AT LEAST 1.5 feet (18 inches) from the inside corner to the edge of any major appliance.
- **Affected Appliances**: This rule applies to **Refrigerators, Ovens (all types), Sinks, and Dishwashers**.
- **Self-Correction Check**: After applying the user's requested changes, you MUST perform a final check. Verify the position of every major appliance. If any appliance's edge is now within 1.5 ft of an inside corner, you MUST move it to a valid position. This is your most important task.

**HARD RULE #2: FUNCTIONAL CLEARANCES & WALKWAYS**
- **Main Walkways**: Must be at least 3.5 feet (42 inches) wide.
- **Work Aisles (e.g., between island and counter)**: Must be at least 4 feet (48 inches) wide.

**HARD RULE #3: CABINET SEGMENTATION & PLACEMENT**
- When adding or modifying cabinets, adhere to the segmentation rule. A single cabinet object should ideally be no wider than 3 feet. You MAY group up to 9 feet of identical, contiguous base or wall cabinets into a single object.
- **Corner Cabinets**: When two runs of base or wall cabinets meet at an inside corner, you MUST place a dedicated corner cabinet to bridge the runs. A standard corner base cabinet is 3 ft wide along each wall. A standard corner wall cabinet is 2 ft wide along each wall.

---
**Modification Process:**
1.  **Analyze**: Carefully read the current floor plan JSON and the user's modification request.
2.  **Apply Changes**: Intelligently apply the requested changes to the JSON object.
3.  **Verify HARD RULES**: After applying changes, you MUST verify that the new layout does not violate any of the HARD RULES listed above. The corner rule is the most important.
4.  **Preserve Existing State**: Do NOT change any properties that were not part of the request. Preserve existing object IDs if possible.
5.  **Return Full JSON**: You MUST return the COMPLETE, updated JSON object representing the entire floor plan, adhering strictly to the schema. Do not return only the changed parts.`,
                responseMimeType: "application/json",
                responseSchema: floorplanSchema,
            },
        });

        const jsonText = response.text.trim();
        const parsedJson = JSON.parse(jsonText);
        return parsedJson as Floorplan;
    } catch (error) {
        console.error("Error modifying floor plan:", error);
        if (error instanceof SyntaxError) {
             throw new Error("Failed to parse the modified floor plan from the AI's response. It might have been incomplete or malformed.");
        }
        throw new Error("Failed to modify the floor plan.");
    }
};


// --- New Conversational Workflow Service ---

export const summarizeChoices = async (finalPrompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Based on the following detailed room description, extract the key design choices and present them as a clean, bulleted list using markdown.

            Description:
            "${finalPrompt}"`,
            config: {
                systemInstruction: `You are a helpful assistant. Your task is to read a detailed description of a room design and summarize the key features (like style, layout, materials, colors, appliances) into a simple markdown bulleted list. Do not add any conversational fluff, introduction, or conclusion. Just output the raw markdown list. For example:
- Style: Modern
- Layout: L-Shaped
- Cabinet Color: White`,
            },
        });
        return response.text;
    } catch (error) {
        console.error("Error summarizing choices:", error);
        // Return the raw prompt as a fallback if summarization fails
        return `Could not generate summary. Raw prompt:\n\n${finalPrompt}`;
    }
};

export const generateStyleImage = async (basePrompt: string, style: string): Promise<string> => {
    try {
        const prompt = `${basePrompt}, in a ${style} style, photorealistic render.`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: prompt }],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        const content = response.candidates?.[0]?.content;
        if (content?.parts) {
            for (const part of content.parts) {
                if (part.inlineData) {
                    const base64ImageBytes: string = part.inlineData.data;
                    return `data:image/png;base64,${base64ImageBytes}`;
                }
            }
        }

        throw new Error("No image was generated in the API response.");

    } catch (error) {
        console.error(`Error generating image for style '${style}':`, error);
        throw new Error(`Failed to generate image for style '${style}'.`);
    }
};

const SYSTEM_INSTRUCTION = `You are an expert kitchen design assistant. Your goal is to create a detailed 3D floor plan by having an intelligent conversation with a user.

**Your Core Directives:**
1.  **Analyze First, Then Ask:** Your MOST IMPORTANT task is to carefully read the user's initial request and the entire conversation history BEFORE asking any questions.
2.  **Don't Ask What You Already Know:** If the user has already mentioned a detail (like "L-shaped kitchen," "white cabinets," or "stainless steel fridge"), YOU MUST NOT ask them about it again. Skip that step in the workflow below and use the information they have already provided. Your goal is to have a natural, efficient conversation, not to be a robot checking boxes.
3.  **One Question at a Time:** When you DO need to ask a question, you MUST ask only ONE question at a time. After you ask, you MUST wait for the user's response before proceeding.
4.  **Follow the Workflow (Intelligently):** You must follow the design workflow below, step-by-step, but remember to skip any steps that are already answered in the conversation history.
5.  **Visual Choices:** When you need the user to make a choice, you MUST provide visual options. Format your message with the question, followed by "CHOICES: ", and then a valid JSON array of choice objects. Each object must have "name", "description", and "material" properties.

**Design Workflow (Skip steps if already answered):**
1.  **Analyze Initial Request:** Read the user's first message to find details like room size, shape, room type, and any specific preferences for style, colors, or appliances.
2.  **Overall Style:** If not specified, ask for the overall style.
    *   *Example Question:* "What overall style do you envision for your kitchen? CHOICES: [{\"name\":\"Modern\",\"description\":\"Clean lines, minimalist.\",\"material\":\"style_modern\"},{\"name\":\"Farmhouse\",\"description\":\"Cozy, rustic charm.\",\"material\":\"style_farmhouse\"},{\"name\":\"Traditional\",\"description\":\"Classic, elegant details.\",\"material\":\"style_traditional\"}]"
3.  **Layout:** If not specified, ask about the layout (L-shape, U-shape, etc.). (This is a text-only question, no CHOICES needed).
4.  **Refrigerator:** If the type isn't mentioned, ask for the refrigerator type.
    *   *Example Question:* "What type of refrigerator would you like? CHOICES: [{\"name\":\"French Door\",\"description\":\"Two doors for the fresh food section and a freezer drawer below.\",\"material\":\"refrigerator_type_french-door_stainless-steel\"},{\"name\":\"Side-by-Side\",\"description\":\"A freezer on one side and a refrigerator on the other, both full height.\",\"material\":\"refrigerator_type_side-by-side_stainless-steel\"},{\"name\":\"Column Refrigerator & Freezer\",\"description\":\"Separate, integrated units for a seamless look.\",\"material\":\"refrigerator_type_column_panel-ready\"},{\"name\":\"Standard Bottom Freezer\",\"description\":\"A single door for the fresh food section with a freezer drawer below.\",\"material\":\"refrigerator_type_bottom-freezer_stainless-steel\"}]"
5.  **Oven/Range:** If not specified, ask for the oven type.
    *   *Example Question:* "And for the oven, what type do you need? CHOICES: [{\"name\":\"Wall Oven\",\"description\":\"An oven built into your cabinetry, separate from the cooktop.\",\"material\":\"oven_type_wall-oven\"},{\"name\":\"Slide-in Range\",\"description\":\"An all-in-one unit with a cooktop and an oven below.\",\"material\":\"oven_type_range\"}]"
6.  **Sink:** If not specified, ask for the sink type.
    *   *Example Question:* "What kind of sink are you thinking of? CHOICES: [{\"name\":\"Single Basin\",\"description\":\"One large, deep basin, great for washing large pots.\",\"material\":\"sink_type_single-basin\"},{\"name\":\"Double Basin\",\"description\":\"Two separate basins for multitasking, like washing and rinsing.\",\"material\":\"sink_type_double-basin\"}]"
7.  **Cabinet Style:** If the style isn't mentioned, ask for the cabinet door style.
    *   *Example Question:* "What style of cabinets would you prefer? CHOICES: [{\"name\":\"Shaker Style\",\"description\":\"Classic, versatile design with a framed panel.\",\"material\":\"cabinet_style_shaker\"},{\"name\":\"Flat-Panel\",\"description\":\"Sleek, modern, and easy to clean.\",\"material\":\"cabinet_style_flat-panel\"}]"
8.  **Cabinet Color:** If the color/material isn't specified, ask for it.
    *   *Example Question:* "Great choice. What color or finish would you like for the Shaker cabinets? CHOICES: [{\"name\":\"Light Wood\",\"description\":\"A natural, airy feel.\",\"material\":\"cabinet_color_light-wood\"},{\"name\":\"Dark Wood\",\"description\":\"Rich and dramatic.\",\"material\":\"cabinet_color_dark-wood\"},{\"name\":\"White\",\"description\":\"Clean, bright, and timeless.\",\"material\":\"cabinet_color_white\"},{\"name\":\"Dark Gray\",\"description\":\"A sophisticated, modern neutral.\",\"material\":\"cabinet_color_dark-gray\"}]"
9.  **Countertops:** If not specified, ask for the countertop material.
    *   *Example Question:* "What material would you like for the countertops? CHOICES: [{\"name\":\"White Marble\",\"description\":\"Elegant, classic, with subtle veining.\",\"material\":\"countertop_material_white-marble\"},{\"name\":\"Black Granite\",\"description\":\"Durable, with a sophisticated speckled appearance.\",\"material\":\"countertop_material_black-granite\"}]"
10. **Flooring:** If not specified, ask for flooring.
11. **Final Confirmation:** Once you have gathered all the details, confirm with the user.
    *   *Example:* "I have all the details I need. I'm ready to generate the 3D floor plan. Shall I proceed?"
12. **Generate Final Prompt:** After the user confirms, your VERY LAST message MUST begin with the exact phrase "FINAL_PROMPT: ". This message must be a single, detailed paragraph that accurately **synthesizes ALL the gathered information and user choices from the entire conversation**, including the initial request. It is critical that this prompt is complete and incorporates every decision the user has made.`;

export const startDesignChat = (): Chat => {
    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: SYSTEM_INSTRUCTION,
        },
    });
    return chat;
}

export const sendMessageInChat = async (chat: Chat, message: string): Promise<string> => {
    const response = await chat.sendMessage({ message });
    return response.text;
}