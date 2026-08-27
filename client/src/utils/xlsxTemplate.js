// Minimal dependency-free .xlsx generator (ZIP with STORED entries + SpreadsheetML).
// Produces a clients import template with Excel list-dropdowns on the
// Assessee Type and Status columns.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(v) { return [v & 255, (v >> 8) & 255]; }
function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }

function concat(parts) {
  let len = 0;
  parts.forEach((p) => { len += p.length; });
  const out = new Uint8Array(len);
  let pos = 0;
  parts.forEach((p) => { out.set(p, pos); pos += p.length; });
  return out;
}

function zipStore(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach((e) => {
    const nameBytes = encoder.encode(e.name);
    const data = typeof e.data === 'string' ? encoder.encode(e.data) : e.data;
    const crc = crc32(data);
    const size = data.length;

    const local = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04,
      ...u16(20),          // version needed
      ...u16(0x0800),      // flags: UTF-8 names
      ...u16(0),           // method: stored
      ...u16(0), ...u16(0), // time, date
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      ...u16(0),
    ]);
    localParts.push(local, nameBytes, data);

    const central = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02,
      ...u16(20), ...u16(20),
      ...u16(0x0800),
      ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0),
      ...u32(offset),
    ]);
    centralParts.push(central, nameBytes);

    offset += local.length + nameBytes.length + size;
  });

  const centralDir = concat(centralParts);
  const end = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06,
    ...u16(0), ...u16(0),
    ...u16(entries.length), ...u16(entries.length),
    ...u32(centralDir.length),
    ...u32(offset),
    ...u16(0),
  ]);

  return concat([...localParts, centralDir, end]);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const HEADERS = ['Name', 'Assessee Type', 'Email', 'Phone', 'City', 'Status'];
const EXAMPLES = [
  ['Aarav Sharma', 'Individual', 'aarav.s@example.com', '+91 98765 43210', 'Mumbai', 'Active'],
  ['GreenTech Solutions', 'Private Limited', 'contact@greentech.co.in', '+91 11 2345 6789', 'New Delhi', 'Inactive'],
];
const TYPE_LIST = 'Individual,Proprietor,Partnership,Private Limited,LLP,Others';
const STATUS_LIST = 'Active,Inactive';

function colLetter(i) {
  return String.fromCharCode(65 + i);
}

function cell(ref, value) {
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function row(n, values) {
  return `<row r="${n}">${values.map((v, i) => cell(`${colLetter(i)}${n}`, v)).join('')}</row>`;
}

function buildSheetXml() {
  const rows = [
    row(1, HEADERS),
    ...EXAMPLES.map((values, idx) => row(idx + 2, values)),
  ];
  const lastRow = EXAMPLES.length + 500;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols>
<col min="1" max="1" width="26" customWidth="1"/>
<col min="2" max="2" width="18" customWidth="1"/>
<col min="3" max="3" width="30" customWidth="1"/>
<col min="4" max="4" width="20" customWidth="1"/>
<col min="5" max="5" width="16" customWidth="1"/>
<col min="6" max="6" width="12" customWidth="1"/>
</cols>
<sheetData>${rows.join('')}</sheetData>
<dataValidations count="2">
<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="B2:B${lastRow}"><formula1>"${TYPE_LIST}"</formula1></dataValidation>
<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="F2:F${lastRow}"><formula1>"${STATUS_LIST}"</formula1></dataValidation>
</dataValidations>
</worksheet>`;
}

export function buildClientsTemplateBytes() {
  const entries = [
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Clients" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      data: buildSheetXml(),
    },
  ];
  return zipStore(entries);
}

export function downloadClientsTemplate() {
  const bytes = buildClientsTemplateBytes();
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clients_import_template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
