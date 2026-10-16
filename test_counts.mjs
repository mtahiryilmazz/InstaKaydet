function parseInstagramNumber(str) {
  if (!str) return 0;
  const clean = str.trim();
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

  const numPart = clean.replace(/[^\d]/g, '');
  const n = parseInt(numPart, 10);
  return isNaN(n) ? 0 : n;
}

const samples = [
  '43K Followers, 3,632 Following, 528 Posts',
  '43 B Takipçi, 3.137 Takip, 528 Gönderi',
  '3M Takipçi, 3 Takip, 53K Gönderi',
  '3.3M Followers, 28 Following, 1,531 Posts'
];

for (const s of samples) {
  const followerMatch = s.match(/([\d.,]+(?:\s*[KMBkmb]|\s*bin|\s*mn)?)\s+(?:Followers|Takipçi)/i);
  const followingMatch = s.match(/([\d.,]+(?:\s*[KMBkmb]|\s*bin|\s*mn)?)\s+(?:Following|Takip)(?!çi)/i);
  const postsMatch = s.match(/([\d.,]+(?:\s*[KMBkmb]|\s*bin|\s*mn)?)\s+(?:Posts|Gönderi)/i);

  console.log('Sample:', s);
  console.log('  Followers:', followerMatch ? parseInstagramNumber(followerMatch[1]) : 0);
  console.log('  Following:', followingMatch ? parseInstagramNumber(followingMatch[1]) : 0);
  console.log('  Posts:', postsMatch ? parseInstagramNumber(postsMatch[1]) : 0);
}
