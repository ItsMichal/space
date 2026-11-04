import { CodeDemo } from './code-demo'

// AskawAI's question generator, from ItsMichal/askawAI pages/api/requestQuestions.ts: an excerpt, every line as written.
const LINES = [
  'const response = await openai.createCompletion("text-curie-001", {',
  '    prompt: "Write 8 questions on " + topic,',
  '    temperature: 0.4,',
  '    max_tokens: 200,',
  '    top_p: 1.0,',
  '    frequency_penalty: 0.4,',
  '    presence_penalty: 0.4,',
  '    n: 1,',
  '    stream: false,',
  '});',
  '',
  'let questions : string[] = response.data.choices[0].text.split("\\n");',
  '',
  'questions = questions.filter(question => question !== "");',
]

export default function Askawai() {
  return <CodeDemo file="pages/api/requestQuestions.ts" lines={LINES} />
}
