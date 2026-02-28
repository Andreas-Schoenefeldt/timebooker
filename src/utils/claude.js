export async function summarizeGermanText(text, API_KEY) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
            "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
            model: "claude-haiku-4-5",  // Cheapest model [web:2]
            max_tokens: 1024,
            messages: [{
                role: "user",
                content: `Fasse diesen deutschen Text in maximal 10 Wörtern zusammen: "${text}"`
            }]
        })
    });

    const data = await response.json();
    console.log(data.content[0].text);

    return data.content[0].text;
}