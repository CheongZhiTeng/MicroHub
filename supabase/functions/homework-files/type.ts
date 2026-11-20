export function detectFile(bytes: Uint8Array, name: string): string | null {
  const prefix = (seq: number[]) => seq.every((v, i) => bytes[i] === v);
  if (
    /\.png$/i.test(name) &&
    prefix([137, 80, 78, 71, 13, 10, 26, 10]) &&
    bytes.length >= 33 &&
    new TextDecoder().decode(bytes.slice(12, 16)) === 'IHDR'
  )
    return 'image/png';
  if (
    /\.jpe?g$/i.test(name) &&
    prefix([255, 216, 255]) &&
    bytes.length >= 6 &&
    bytes.at(-2) === 255 &&
    bytes.at(-1) === 217
  )
    return 'image/jpeg';
  if (
    /\.pdf$/i.test(name) &&
    prefix([37, 80, 68, 70, 45]) &&
    new TextDecoder().decode(bytes.slice(-1024)).includes('%%EOF')
  )
    return 'application/pdf';
  if (
    /\.txt$/i.test(name) &&
    bytes.length &&
    !bytes.some((x) => x < 9 || (x > 13 && x < 32))
  ) {
    try {
      new TextDecoder('utf8', { fatal: true }).decode(bytes);
      return 'text/plain';
    } catch {
      return null;
    }
  }
  return null;
}
