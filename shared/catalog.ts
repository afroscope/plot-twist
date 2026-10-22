export type Medium = 'Music' | 'Film' | 'Book';
export interface CulturalItem {
  id: string;
  title: string;
  creator: string;
  medium: Medium;
  tags: string[];
  palette: string;
}

// Hand-selected demo catalogue. These are local IDs, never Qloo entity IDs.
export const favourites: CulturalItem[] = [
  { id: 'seed-sade', title: 'Sade', creator: 'Quiet intensity, timeless soul', medium: 'Music', tags: ['soulful', 'intimate'], palette: 'clay' },
  { id: 'seed-wong', title: 'In the Mood for Love', creator: 'Wong Kar-wai · 2000', medium: 'Film', tags: ['intimate', 'dreamlike'], palette: 'wine' },
  { id: 'seed-octavia', title: 'Parable of the Sower', creator: 'Octavia E. Butler · 1993', medium: 'Book', tags: ['speculative', 'rebellious'], palette: 'blue' },
  { id: 'seed-kendrick', title: 'Kendrick Lamar', creator: 'Storytelling with an edge', medium: 'Music', tags: ['rebellious', 'soulful'], palette: 'green' },
  { id: 'seed-miyazaki', title: 'Spirited Away', creator: 'Hayao Miyazaki · 2001', medium: 'Film', tags: ['dreamlike', 'speculative'], palette: 'lavender' },
  { id: 'seed-murakami', title: 'Kafka on the Shore', creator: 'Haruki Murakami · 2002', medium: 'Book', tags: ['dreamlike', 'intimate'], palette: 'yellow' },
  { id: 'seed-bjork', title: 'Björk', creator: 'Beautifully off-centre', medium: 'Music', tags: ['experimental', 'dreamlike'], palette: 'blue' },
  { id: 'seed-moonlight', title: 'Moonlight', creator: 'Barry Jenkins · 2016', medium: 'Film', tags: ['intimate', 'soulful'], palette: 'clay' },
  { id: 'seed-le-guin', title: 'The Left Hand of Darkness', creator: 'Ursula K. Le Guin · 1969', medium: 'Book', tags: ['speculative', 'experimental'], palette: 'green' },
  { id: 'seed-fela', title: 'Fela Kuti', creator: 'Rhythm meets resistance', medium: 'Music', tags: ['rebellious', 'experimental'], palette: 'yellow' },
  { id: 'seed-everything', title: 'Everything Everywhere All at Once', creator: 'Daniels · 2022', medium: 'Film', tags: ['experimental', 'speculative'], palette: 'wine' },
  { id: 'seed-morrison', title: 'Beloved', creator: 'Toni Morrison · 1987', medium: 'Book', tags: ['soulful', 'dreamlike'], palette: 'lavender' },
];

export const adventureLevels = [
  { id: 'gentle', title: 'A little detour', description: 'Something new, with a familiar feeling.', label: 'Close to home', number: '01' },
  { id: 'curious', title: 'The scenic route', description: 'Follow a thread into unexpected territory.', label: 'Curious by nature', number: '02' },
  { id: 'wild', title: 'Full plot twist', description: 'Keep the spark. Change everything around it.', label: 'Beautifully unfamiliar', number: '03' },
] as const;
export type Adventure = (typeof adventureLevels)[number]['id'];
