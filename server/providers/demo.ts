import { favourites } from '../../shared/catalog.js';
import type { JourneyStop } from '../../shared/contracts.js';
import type { RecommendationProvider } from './provider.js';

type Fixture = Omit<JourneyStop, 'connection'> & { distance: number };
export const demoItems: Fixture[] = [
  { id: 'demo-cleosol', medium: 'Music', title: 'Mother', creator: 'Cleo Sol · 2021', tags: ['soulful', 'intimate'], palette: 'clay', distance: 0, description: 'Warm, unhurried soul that makes room for a little stillness.', invitation: 'Begin with “Don’t Let Me Fall”.', },
  { id: 'demo-nala', medium: 'Music', title: 'Space 1.8', creator: 'Nala Sinephro · 2021', tags: ['dreamlike', 'experimental'], palette: 'green', distance: 1, description: 'A floating meeting of harp, modular synths and spiritual jazz.', invitation: 'Put on headphones. Start with “Space 1”.' },
  { id: 'demo-lrain', medium: 'Music', title: 'Fatigue', creator: 'L’Rain · 2021', tags: ['experimental', 'soulful'], palette: 'wine', distance: 2, description: 'Fragments of memory, tangled rhythms and songs that change shape.', invitation: 'Let “Two Face” open the door.' },
  { id: 'demo-aja', medium: 'Music', title: 'The Infinite', creator: 'Aja Monet · 2023', tags: ['rebellious', 'intimate'], palette: 'yellow', distance: 1, description: 'A spoken-word piece with the space and spirit of jazz.', invitation: 'Listen once for the words, once for the spaces.' },
  { id: 'demo-kaitlyn', medium: 'Music', title: 'EARS', creator: 'Kaitlyn Aurelia Smith · 2016', tags: ['speculative', 'dreamlike'], palette: 'blue', distance: 2, description: 'Organic electronic landscapes that feel like an unfamiliar ecosystem.', invitation: 'Step into “First Flight”.' },
  { id: 'demo-pastlives', medium: 'Film', title: 'Past Lives', creator: 'Celine Song · 2023', tags: ['intimate', 'soulful'], palette: 'blue', distance: 0, description: 'A tender meditation on the lives we live and the ones we imagine.', invitation: 'Watch for what happens between the conversations.' },
  { id: 'demo-afteryang', medium: 'Film', title: 'After Yang', creator: 'Kogonada · 2021', tags: ['speculative', 'intimate'], palette: 'green', distance: 1, description: 'A quiet science-fiction story about memory, family and attention.', invitation: 'Notice the small moments that become a whole life.' },
  { id: 'demo-atlantics', medium: 'Film', title: 'Atlantics', creator: 'Mati Diop · 2019', tags: ['dreamlike', 'rebellious'], palette: 'wine', distance: 1, description: 'A love story in Dakar, where longing meets the supernatural.', invitation: 'Follow the sea, the light and the things left unsaid.' },
  { id: 'demo-daughters', medium: 'Film', title: 'Daughters of the Dust', creator: 'Julie Dash · 1991', tags: ['soulful', 'experimental'], palette: 'clay', distance: 2, description: 'A lyrical portrait of family, migration and Gullah memory.', invitation: 'Let the images lead before trying to untangle the story.' },
  { id: 'demo-holy', medium: 'Film', title: 'Holy Motors', creator: 'Leos Carax · 2012', tags: ['experimental', 'speculative'], palette: 'yellow', distance: 2, description: 'A restless, strange journey through many lives in a single day.', invitation: 'Go in curious. Leave the plot predictions behind.' },
  { id: 'demo-openwater', medium: 'Book', title: 'Open Water', creator: 'Caleb Azumah Nelson · 2021', tags: ['intimate', 'soulful'], palette: 'blue', distance: 0, description: 'A lyrical love story threaded with music, art and vulnerability.', invitation: 'Read the first pages slowly, like a favourite track.' },
  { id: 'demo-piranesi', medium: 'Book', title: 'Piranesi', creator: 'Susanna Clarke · 2020', tags: ['dreamlike', 'speculative'], palette: 'clay', distance: 1, description: 'An impossible house, an ocean inside it, and a mystery of belonging.', invitation: 'Enter the house without reading a plot summary.' },
  { id: 'demo-pet', medium: 'Book', title: 'Pet', creator: 'Akwaeke Emezi · 2019', tags: ['rebellious', 'speculative'], palette: 'lavender', distance: 1, description: 'A fable about seeing what a seemingly perfect world refuses to see.', invitation: 'Start with the question: who gets to name a monster?' },
  { id: 'demo-invisible', medium: 'Book', title: 'Invisible Cities', creator: 'Italo Calvino · 1972', tags: ['experimental', 'dreamlike'], palette: 'green', distance: 2, description: 'Imaginary cities become tiny maps of desire, memory and possibility.', invitation: 'Read one city, then take a walk.' },
  { id: 'demo-salt', medium: 'Book', title: 'The Salt Eaters', creator: 'Toni Cade Bambara · 1980', tags: ['experimental', 'soulful'], palette: 'yellow', distance: 2, description: 'A layered, polyphonic novel about healing and community.', invitation: 'Listen for the voices instead of rushing for a straight line.' },
];

export const demoProvider: RecommendationProvider = {
  async createJourney(input) {
    const seeds = favourites.filter(item => input.favouriteIds.includes(item.id));
    const tags = new Set(seeds.flatMap(item => item.tags));
    const targetDistance = { gentle: 0, curious: 1, wild: 2 }[input.adventure];
    const stops = (['Music', 'Film', 'Book'] as const).flatMap(medium => {
      const candidates = demoItems.filter(item => item.medium === medium && input.feedback[item.id] !== 'skip');
      const scored = candidates.map((item, index) => ({ item, score:
        (input.feedback[item.id] === 'love' ? 100 : 0)
        + item.tags.filter(tag => tags.has(tag)).length * 2
        - Math.abs(item.distance - targetDistance) * 3
        + ((index + input.revision) % Math.max(candidates.length, 1)) * 0.7,
      })).sort((a, b) => b.score - a.score);
      const item = scored[0]?.item;
      if (!item) return [];
      const seed = seeds.find(seed => seed.tags.some(tag => item.tags.includes(tag)));
      const sharedTag = seed?.tags.find(tag => item.tags.includes(tag));
      return [{ id: item.id, medium: item.medium, title: item.title, creator: item.creator,
        tags: item.tags, palette: item.palette, description: item.description, invitation: item.invitation,
        connection: seed ? `A hand-written ${sharedTag} thread from ${seed.title}.` : 'An intentional detour from your starting points.',
      }];
    });
    return {
      source: 'demo', status: stops.length === 3 ? 'ok' : 'empty',
      title: ['Familiar feeling. New world.', 'Follow the unexpected thread.', 'A very different kind of familiar.'][targetDistance],
      summary: 'Three hand-picked demo stops. Connections are editorial ideas, not live Qloo recommendations.',
      stops: stops.length === 3 ? stops : [],
    };
  },
};
