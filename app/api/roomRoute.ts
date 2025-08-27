//--src/app/api/rooms/route.ts
import { NextResponse } from 'next/server'

export const runtime = 'edge'

const customSecretMappings: Record<string, string> = {
  "secret_cmcb7gbz30000356n3sxdmhrd": "AIzaSyCLau46z83dIYfsXfU8B4zkUzct07kULhY",
  "secret_cm9150ywc00003b6r8hdkq4u5": "live_BxgFDIvrZfkrhOpHynBatf647idgT9fjdbqrAMM5HEYsELQuifJE3m52BMXjqVqP",
  "secret_cm9kdjlwb00003b6vx2rde7rd": "EUK6nliWVdB5Nkt4VuNXUsAV7VwBmtwR",
  "secret_cm915ekms00043b6rzsd0440a": "1d0226d4-9f84-48d6-9486-b4381e220d9f",
  "secret_cm98tgbme00003b6rjf0egbe3": "f77f2c86182c6dfc620c49b3a3a2204c"
}

function createSecretMap(): Map<string, string> {
  const secretMap = new Map<string, string>()

  for (const [key, value] of Object.entries(customSecretMappings)) {
    secretMap.set(key, value)
  }

  return secretMap
}

export async function GET(request: Request) {
  return handleRequest(request)
}

export async function POST(request: Request) {
  return handleRequest(request)
}

export async function PUT(request: Request) {
  return handleRequest(request)
}

export async function PATCH(request: Request) {
  return handleRequest(request)
}

export async function DELETE(request: Request) {
  return handleRequest(request)
}

async function handleRequest(request: Request) {
  let parsed
  const wordMap = createSecretMap()

  const contentType = request.headers.get('content-type')

  if (!contentType) {
    return NextResponse.json(
      { error: 'Missing content-type header in the request' },
      { status: 400 },
    )
  }

  if (contentType.includes('multipart/form-data')) {
    const proxyRequest = await request.formData()
    parsed = {
      protocol: '',
      origin: '',
      path: '',
      method: '',
      headers: {},
      body: new FormData(),
    }

    for (const [key, value] of proxyRequest.entries()) {
      if (key.startsWith('body[') && key.endsWith(']')) {
        const fieldName = key.slice(5, -1)
        parsed.body.append(
          fieldName,
          replaceMaskedWordsWithSecrets(value, wordMap),
        )
      } else if (key === 'headers') {
        try {
          parsed.headers = replaceMaskedWordsWithSecrets(
            JSON.parse(String(value)),
            wordMap,
          )
        } catch {
          return NextResponse.json(
            {
              error: 'Invalid headers in the body - must be a JSON object',
            },
            { status: 400 },
          )
        }
      } else {
        // Use type assertion to safely access known properties
        (parsed as Record<string, any>)[key] = replaceMaskedWordsWithSecrets(value, wordMap)
      }
    }
  } else if (contentType.includes('application/json')) {
    try {
      parsed = await request.json()
    } catch (error) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    if (wordMap.size > 0) {
      parsed = replaceMaskedWordsWithSecrets(parsed, wordMap)
    }
  } else {
    return NextResponse.json(
      { error: 'Unsupported content-type header' },
      { status: 400 },
    )
  }

  const { protocol, origin, path, method, headers, body } = parsed

  if (!protocol || !origin || !path || !method || !headers) {
    return NextResponse.json(
      { error: 'Missing required fields in request body' },
      { status: 400 },
    )
  }

  const fetchHeaders = new Headers(headers)
  if (contentType.includes('multipart/form-data')) {
    fetchHeaders.delete('content-type') // fetch sets the header automatically
  }

  try {
    const response = await fetch(
      `${protocol}://${origin}/${path.startsWith('/') ? path.slice(1) : path}`,
      {
        method,
        body:
          typeof body === 'string' || body instanceof FormData
            ? body
            : JSON.stringify(body),
        headers: fetchHeaders,
      },
    )

    const json = await response.json()
    return NextResponse.json(json)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch external API', details: error.message },
      { status: 500 },
    )
  }
}

function replaceMaskedWordsWithSecrets(
  obj: any,
  wordMap: Map<string, string>,
): any {
  if (typeof obj === 'string') {
    return replaceInString(obj, wordMap)
  } else if (typeof obj === 'object' && obj.constructor.name === 'File') {
    return obj
  } else if (Array.isArray(obj)) {
    return obj.map((item) => replaceMaskedWordsWithSecrets(item, wordMap))
  } else if (typeof obj === 'object' && obj !== null) {
    const newObj: any = {}
    for (const key in obj) {
      newObj[key] = replaceMaskedWordsWithSecrets(obj[key], wordMap)
    }
    return newObj
  }
  return obj
}

function replaceInString(str: string, wordMap: Map<string, string>): string {
  for (const [word, replacement] of Array.from(wordMap.entries())) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    str = str.replace(regex, replacement)
  }
  return str
}
