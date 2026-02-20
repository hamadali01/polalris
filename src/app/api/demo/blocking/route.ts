// POST localhost:3000/api/demo/blocking
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function POST() {
    const respose = await generateText({
        model: google('gemini-2.5-flash'),
        prompt: 'Write a vegetarian lasagna recipe for 4 people.',
        experimental_telemetry: {
            isEnabled: true,
            recordInputs: true,
            recordOutputs: true,
          },
    });

    return Response.json({ respose });
}