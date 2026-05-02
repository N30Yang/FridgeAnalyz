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

  // Use the provided prompt or a default one
  const textPrompt = prompt || "What's in this image?";
  
  // Format the image URL object depending on the input type
  const imageObj = imageUrl 
    ? { url: imageUrl } 
    : { url: `data:image/jpeg;base64,${base64Image}` };

  try {
    const response = await fetch('https://ai.hackclub.com/proxy/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HACKCLUB_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash', // Using a vision-capable model
        messages: [
          {
            role: 'system',
            content: 'List off everything you see in the fridge. Provide a consistent list separated by newlines, with NO markdown formatting, asterisks, or dashes. Only output the plain text items.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: textPrompt },
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

    // Return the text output from the AI
    return res.status(200).json({
      result: data.choices?.[0]?.message?.content || '',
      usage: data.usage
    });
  } catch (error) {
    console.error('Function execution error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
