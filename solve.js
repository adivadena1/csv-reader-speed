// A fast drop-in for csv-reader 1.0.0.
//
// run(input) answers {text, header} with {columns, rows, errors}, byte for
// byte the same answer the reference reader gives. The text is scanned once,
// left to right, with plain fields taken as slices of the input and only the
// rare broken shapes (a stray CR, a quoted field with a doubled quote or a
// line break inside, junk after a closing quote, a quote that never closes)
// built up piece by piece.
//
// The dialect, as the competition states it:
// - a U+FEFF at the very start is dropped;
// - a record ends at LF or CRLF, and a line left with no characters is no record;
// - outside quotes a CR not followed by LF is dropped (stray_cr);
// - a field that opens with a quote runs to the next quote that is not doubled,
//   "" inside it is one quote, and each CRLF or lone CR inside it reads as LF;
//   what follows its closing quote, up to the next comma or line break, is
//   appended as it stands (quote_junk, when the field ends);
// - a quote that never closes is a literal character, and the text after it is
//   read again as unquoted (unterminated_quote);
// - a quote inside an unquoted field is a literal character;
// - fields stay strings, never trimmed or converted;
// - columns is the first record when header is true, else null; rows holds the
//   records after it (every record when header is false), each padded with ""
//   (short_row, with fields: its count) or cut (long_row, with extra: the cut
//   fields) to the first record's width;
// - each error is {code, line, row} in the order met: line the 1-based line its
//   record starts on (every LF, CRLF and lone CR inside a quoted field counted),
//   row its record's index in rows (null for the header).

// How one field ended.
const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let i = 0; // next character to read
  let line = 1; // the line that character is on
  if (n > 0 && text.charCodeAt(0) === 0xfeff) i = 1;

  // The record being read: the line it starts on and the index in rows it
  // takes (null for the header). Field scanners read these when they err.
  let recordLine = 1;
  let recordRow = null;

  // Kept characters the last unquoted scan read (not counting a prefix it was
  // handed or CRs it dropped). The quote-junk check reads this after a junk scan.
  let scanAdded = 0;

  // The fields of the record being read. Scanners push into it directly.
  let fields = [];

  // Scan an unquoted field. `prefix` is text already collected for this field
  // ("" normally, the opening quote for a quote that never closes, the quoted
  // value when junk follows a closing quote). The field is pushed into
  // `fields`; the return is how it ended. A CR not followed by LF is dropped
  // with a stray_cr error and the scan carries on.
  function unquoted(prefix) {
    let start = i;
    let parts = prefix ? [prefix] : null;
    let added = 0;
    let j = i;
    let c = 0;
    let end = END;
    while (j < n) {
      c = text.charCodeAt(j);
      if (c === 44) {
        end = COMMA;
        break;
      }
      if (c === 10) {
        end = LINE_BREAK;
        break;
      }
      if (c === 13) {
        if (text.charCodeAt(j + 1) === 10) {
          end = LINE_BREAK;
          break;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        added += j - start;
        if (!parts) parts = [];
        parts.push(text.slice(start, j));
        j += 1;
        start = j;
        continue;
      }
      j++;
    }
    added += j - start;
    if (parts) {
      parts.push(text.slice(start, j));
      fields.push(parts.join(''));
    } else if (prefix) {
      fields.push(prefix + text.slice(start, j));
    } else {
      fields.push(text.slice(start, j));
    }
    scanAdded = added;
    if (end === COMMA) {
      i = j + 1;
    } else if (end === LINE_BREAK) {
      i = c === 13 ? j + 2 : j + 1;
      line++;
    } else {
      i = j;
    }
    return end;
  }

  // Scan a quoted field. text[i] is its opening quote. Returns how it ended.
  function quoted() {
    const open = i;
    const openLine = line;
    let p = i + 1;
    let close = -1;
    let doubled = false;
    for (;;) {
      const q = text.indexOf('"', p);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text
        // after it is read again as unquoted. The line is still openLine:
        // nothing was counted while the closing quote was being looked for.
        i = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        return unquoted('"');
      }
      if (text.charCodeAt(q + 1) === 34) {
        doubled = true;
        p = q + 2;
        continue;
      }
      close = q;
      break;
    }
    // The field closed at `close`. Look for a line break inside it: none is
    // the common case, and then the field is one slice of the input.
    let nl = text.indexOf('\n', open + 1);
    let hasBreak = nl !== -1 && nl < close;
    if (!hasBreak) {
      const cr = text.indexOf('\r', open + 1);
      hasBreak = cr !== -1 && cr < close;
    }
    let value;
    if (!doubled && !hasBreak) {
      value = text.slice(open + 1, close);
    } else {
      // Rebuild the field: "" is one quote, each CRLF or lone CR inside is
      // one LF, and every line break inside counts a line.
      const parts = [];
      let seg = open + 1;
      let k = open + 1;
      while (k < close) {
        const c = text.charCodeAt(k);
        if (c === 34) {
          parts.push(text.slice(seg, k));
          parts.push('"');
          k += 2;
          seg = k;
        } else if (c === 13) {
          parts.push(text.slice(seg, k));
          parts.push('\n');
          line++;
          k += text.charCodeAt(k + 1) === 10 ? 2 : 1;
          seg = k;
        } else {
          if (c === 10) line++;
          k++;
        }
      }
      parts.push(text.slice(seg, close));
      value = parts.join('');
    }
    const after = close + 1;
    if (after >= n) {
      fields.push(value);
      i = after;
      return END;
    }
    const c = text.charCodeAt(after);
    if (c === 44) {
      fields.push(value);
      i = after + 1;
      return COMMA;
    }
    if (c === 10) {
      fields.push(value);
      i = after + 1;
      line++;
      return LINE_BREAK;
    }
    if (c === 13 && text.charCodeAt(after + 1) === 10) {
      fields.push(value);
      i = after + 2;
      line++;
      return LINE_BREAK;
    }
    // What follows the closing quote is appended as it stands, up to the
    // next comma or line break.
    i = after;
    const end = unquoted(value);
    if (scanAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    return end;
  }

  for (;;) {
    // Lines with no characters are no records.
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 10) {
        i++;
        line++;
      } else if (c === 13 && text.charCodeAt(i + 1) === 10) {
        i += 2;
        line++;
      } else {
        break;
      }
    }
    if (i >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    fields = [];
    let end;
    let lastQuoted = false;
    do {
      if (text.charCodeAt(i) === 34) {
        lastQuoted = true;
        end = quoted();
      } else {
        lastQuoted = false;
        end = unquoted('');
      }
    } while (end === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.slice(width) });
      fields.length = width;
    }
    rows.push(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
