const hexMap = [];
for (let i = 0; i < 256; i++) {
  hexMap[i] = (i + 0x100).toString(16).substr(1);
}

export { hexMap };

export function hexToBuffer(input) {
  if (typeof input !== 'string') {
    throw new TypeError('Expected input to be a string');
  }

  input = input.replace(/-/g, '');

  if (input.length % 2 !== 0) {
    throw new RangeError('Expected string to be an even number of characters');
  }

  const view = new Uint8Array(input.length / 2);

  for (let i = 0; i < input.length; i += 2) {
    view[i / 2] = parseInt(input.substring(i, i + 2), 16);
  }

  return view.buffer;
}

export function bufferToHex(source, isUuid) {
  if (source instanceof Uint8Array) {
    // already Uint8Array
  } else if (ArrayBuffer.isView(source)) {
    source = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  } else if (Array.isArray(source)) {
    source = Uint8Array.from(source);
  }

  if (source.length !== 16) {
    throw new RangeError('only 16 bytes array is allowed');
  }

  const spacer = isUuid ? '-' : '';

  let i = 0;
  return (
    hexMap[source[i++]] +
    hexMap[source[i++]] +
    hexMap[source[i++]] +
    hexMap[source[i++]] +
    spacer +
    hexMap[source[i++]] +
    hexMap[source[i++]] +
    spacer +
    hexMap[source[i++]] +
    hexMap[source[i++]] +
    spacer +
    hexMap[source[i++]] +
    hexMap[source[i++]] +
    spacer +
    hexMap[source[i++]] +
    hexMap[source[i++]] +
    hexMap[source[i++]] +
    hexMap[source[i++]] +
    hexMap[source[i++]] +
    hexMap[source[i++]]
  );
}

function getBaseCodec(ALPHABET) {
  if (ALPHABET.length >= 255) {
    throw new TypeError('Alphabet too long');
  }
  const BASE_MAP = new Uint8Array(256);
  for (let j = 0; j < BASE_MAP.length; j++) {
    BASE_MAP[j] = 255;
  }
  for (let i = 0; i < ALPHABET.length; i++) {
    const x = ALPHABET.charAt(i);
    const xc = x.charCodeAt(0);
    if (BASE_MAP[xc] !== 255) {
      throw new TypeError(x + ' is ambiguous');
    }
    BASE_MAP[xc] = i;
  }
  const BASE = ALPHABET.length;
  const LEADER = ALPHABET.charAt(0);
  const FACTOR = Math.log(BASE) / Math.log(256);
  const iFACTOR = Math.log(256) / Math.log(BASE);

  function encode(source) {
    if (source instanceof Uint8Array) {
      // ok
    } else if (ArrayBuffer.isView(source)) {
      source = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
    } else if (Array.isArray(source)) {
      source = Uint8Array.from(source);
    }
    if (!(source instanceof Uint8Array)) {
      throw new TypeError('Expected Uint8Array');
    }
    if (source.length === 0) {
      return '';
    }
    let zeroes = 0;
    let length = 0;
    let pbegin = 0;
    const pend = source.length;
    while (pbegin !== pend && source[pbegin] === 0) {
      pbegin++;
      zeroes++;
    }
    let size = ((pend - pbegin) * iFACTOR + 1) >>> 0;
    const b58 = new Uint8Array(size);
    while (pbegin !== pend) {
      let carry = source[pbegin];
      let i = 0;
      for (
        let it1 = size - 1;
        (carry !== 0 || i < length) && it1 !== -1;
        it1--, i++
      ) {
        carry += (256 * b58[it1]) >>> 0;
        b58[it1] = carry % BASE >>> 0;
        carry = (carry / BASE) >>> 0;
      }
      if (carry !== 0) {
        throw new Error('Non-zero carry');
      }
      length = i;
      pbegin++;
    }
    let it2 = size - length;
    while (it2 !== size && b58[it2] === 0) {
      it2++;
    }
    let str = LEADER.repeat(zeroes);
    for (; it2 < size; ++it2) {
      str += ALPHABET.charAt(b58[it2]);
    }
    return str;
  }

  function decodeUnsafe(source) {
    if (typeof source !== 'string') {
      throw new TypeError('Expected String');
    }
    if (source.length === 0) {
      return new Uint8Array();
    }
    let psz = 0;
    let zeroes = 0;
    let length = 0;
    while (source[psz] === LEADER) {
      zeroes++;
      psz++;
    }
    let size = ((source.length - psz) * FACTOR + 1) >>> 0;
    const b256 = new Uint8Array(size);
    while (source[psz]) {
      let carry = BASE_MAP[source.charCodeAt(psz)];
      if (carry === 255) {
        return;
      }
      let i = 0;
      for (
        let it3 = size - 1;
        (carry !== 0 || i < length) && it3 !== -1;
        it3--, i++
      ) {
        carry += (BASE * b256[it3]) >>> 0;
        b256[it3] = carry % 256 >>> 0;
        carry = (carry / 256) >>> 0;
      }
      if (carry !== 0) {
        throw new Error('Non-zero carry');
      }
      length = i;
      psz++;
    }
    let it4 = size - length;
    while (it4 !== size && b256[it4] === 0) {
      it4++;
    }
    const vch = new Uint8Array(zeroes + (size - it4));
    let j = zeroes;
    while (it4 !== size) {
      vch[j++] = b256[it4++];
    }
    return vch;
  }

  function decode(string) {
    const buffer = decodeUnsafe(string);
    if (buffer) {
      return buffer;
    }
    throw new Error('Non-base' + BASE + ' character');
  }

  return { encode, decodeUnsafe, decode };
}

const BASE62 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const base62 = getBaseCodec(BASE62);

export function bufferToBase62(source) {
  return base62.encode(source);
}

export function base62ToBuffer(source) {
  return base62.decode(source);
}

export function bufferToBase62Unsafe(source) {
  return base62.decodeUnsafe(source);
}