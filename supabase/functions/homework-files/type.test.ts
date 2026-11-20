import { detectFile } from './type.ts';
Deno.test(
  'rejects renamed payloads and malformed UTF-8, accepts plain text',
  () => {
    const b = new TextEncoder().encode('assignment');
    if (
      detectFile(b, 'example.jpg') !== null ||
      detectFile(b, 'notes.txt') !== 'text/plain' ||
      detectFile(new Uint8Array([255]), 'notes.txt') !== null
    )
      throw Error('type validation');
  },
);
