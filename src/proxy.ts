import { NextRequest, NextResponse } from 'next/server';
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set('x-evpower-editor-preview', request.nextUrl.searchParams.get('editorPreview') === '1' ? '1' : '0');
  return NextResponse.next({request:{headers}});
}
export const config = { matcher: ['/((?!_next).*)'] };
