function parseInstagramNumber(str) {
  if (!str) return 0;
  const clean = str.trim();
  // Check if string contains suffix (K, B/Bin, M/Mn)
  const isMillion = /\b(mn|m)\b|(?:\d\s*)(m|mn)\b/i.test(clean) || /[0-9][mM]/i.test(clean);
  const isThousand = /\b(k|b|bin)\b|(?:\d\s*)(k|b|bin)\b/i.test(clean) || /[0-9][kKbB]/i.test(clean);

  if (isMillion) {
    const numPart = clean.replace(/[^\d.,]/g, '').replace(/,/g, '.');
    const n = parseFloat(numPart);
    return isNaN(n) ? 0 : Math.round(n * 1000000);
  }

  if (isThousand) {
    const numPart = clean.replace(/[^\d.,]/g, '').replace(/,/g, '.');
    const n = parseFloat(numPart);
    return isNaN(n) ? 0 : Math.round(n * 1000);
  }

  // Pure integer with thousand separators (e.g. "3,632", "3.137", "528", "52.844")
  const numPart = clean.replace(/[^\d]/g, '');
  const n = parseInt(numPart, 10);
  return isNaN(n) ? 0 : n;
}

const testCases = [
  '528 Posts',
  '528 Gönderi',
  '43K Followers',
  '43 B Takipçi',
  '43,8 B Takipçi',
  '43.8K Followers',
  '3,632 Following',
  '3.137 Takip',
  '3.632 Takip',
  '3M Followers',
  '3,3 Mn Takipçi',
  '52.844 Gönderi',
  '1531 Posts'
];

for (const tc of testCases) {
  console.log(`${tc} => ${parseInstagramNumber(tc)}`);
}
