export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Please use POST.' });
  }

  const { imageUrl, base64Image, prompt } = req.body || {};

  // Require an image input
  if (!imageUrl && !base64Image) {
    return res.status(400).json({ error: 'Provide either imageUrl or base64Image in the request body.' });
  }

  // Format the image URL object depending on the input type
  const imageObj = imageUrl 
    ? { url: imageUrl } 
    : { url: `data:image/jpeg;base64,${base64Image}` };

  const systemPrompt = `You are a sarcastic, slightly unhinged AI fridge analyzer.
Analyze the provided image of a fridge's contents.
You must return your analysis as a pure JSON object (without any markdown formatting like \`\`\`json) with the following structure:
{
  "fridgeMood": "A 2-3 word legally questionable or wildly cursed mood for the fridge",
  "items": [
    {
      "name": "Item name, maybe with a funny descriptor (e.g. 'Eggs', 'Mystery Sludge')",
      "quantity": "Estimated quantity (e.g. '3', '1/2 jar', 'A handful', 'Too many', 'Suspicious amount')",
      "percentage": "A random confidence percentage (e.g. '94%')",
      "statusLabel": "An optional warning label in caps (e.g. 'POSSIBLY EXPIRED', 'DO NOT OPEN', 'BIOHAZARD', 'CAUTION', or null if fine)"
    }
  ],
  "recipes": [
    {
      "name": "Recipe name in CAPS (e.g. 'SCRAMBLED REGRET WITH MYSTERY CHEESE')",
      "eatRating": "A rating like 'TECHNICALLY YES', 'ABSOLUTELY NOT', 'RELUCTANTLY', 'STRONG NO', 'YES'",
      "ingredients": ["Array of ingredient names matching the items list"],
      "steps": ["Array of string steps"],
      "meta": "Time and servings in CAPS (e.g. '8 MIN ・ SERVES 1 OPTIMISTIC PERSON')"
    }
  ]
}

Instructions:
1. Identify 5-12 items in the fridge.
2. Generate 3-4 recipes using the items.
3. Make some recipes that you could genuinely make (practical and should taste good) x1.
4. Make some recipes as a complete joke (satirical/disgusting) x2.
5. If a human is in the majority of their image roast their apperence.
6. Do NOT output any markdown backticks, just the raw JSON object.`;

  try {
    const response = await fetch('https://ai.hackclub.com/proxy/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HACKCLUB_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: imageObj }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Hack Club AI API Error:', data);
      return res.status(response.status).json({ error: 'Failed to process image with AI', details: data });
    }

    let resultText = data.choices?.[0]?.message?.content || '{}';
    // Clean up potential markdown from the model just in case
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(resultText);
      return res.status(200).json({
        result: parsed,
        usage: data.usage
      });
    } catch (parseError) {
      console.error('Failed to parse AI JSON:', resultText);
      return res.status(500).json({ error: 'AI returned invalid JSON format', raw: resultText });
    }
  } catch (error) {
    console.error('Function execution error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
