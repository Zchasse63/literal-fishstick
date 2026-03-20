/**
 * GET /api/openapi
 *
 * Serves the OpenAPI specification as YAML.
 */
import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function GET() {
  try {
    const specPath = join(process.cwd(), 'public', 'openapi.yaml');
    const yaml = await readFile(specPath, 'utf-8');

    return new NextResponse(yaml, {
      status: 200,
      headers: {
        'Content-Type': 'text/yaml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read spec';
    console.error('[openapi] Error serving spec:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
