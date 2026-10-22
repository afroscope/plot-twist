import { useRef, useState } from 'react';
import { adventureLevels, favourites, type Adventure, type CulturalItem, type Medium } from '../shared/catalog';
import type { ApiError, Journey } from '../shared/contracts';

const symbols: Record<Medium, string> = { Music: '↗', Film: '◉', Book: '▤' };

function Artwork({ item, large = false }: { item: CulturalItem; large?: boolean }) {
  return <div aria-hidden="true" className={`artwork ${item.palette} ${large ? 'large' : ''}`}>
    <span className="art-grid" /><span className="art-orbit" /><span className="art-disc" />
    <span className="art-type">{item.medium === 'Music' ? 'SOUND' : item.medium === 'Film' ? 'SCENE' : 'STORY'}</span>
    <span className="art-mark">{symbols[item.medium]}</span>
  </div>;
}

export default function App() {
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState<Medium | 'All'>('All');
  const [search, setSearch] = useState('');
  const [adventure, setAdventure] = useState<Adventure>('curious');
  const [journey, setJourney] = useState<Journey | null>(null);
  const [feedback, setFeedback] = useState<Record<string, 'love' | 'skip'>>({});
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const tasteHeading = useRef<HTMLHeadingElement>(null);
  const items = favourites.filter(item => (filter === 'All' || item.medium === filter)
    && `${item.title} ${item.creator}`.toLowerCase().includes(search.toLowerCase().trim()));
  const level = adventureLevels.find(level => level.id === adventure)!;

  function toggle(id: string) {
    setNotice('');
    setSelected(previous => previous.includes(id) ? previous.filter(item => item !== id) : previous.length < 5 ? [...previous, id] : previous);
  }
  function editTaste() {
    setJourney(null); setError(''); setNotice('');
    requestAnimationFrame(() => tasteHeading.current?.focus());
  }
  async function discover(revise = false) {
    if (!selected.length || loading) return;
    setLoading(true); setError(''); setNotice('');
    const nextRevision = revise ? revision + 1 : 0;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/journeys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ favouriteIds: selected, adventure, revision: nextRevision, feedback: revise ? feedback : {} }),
      });
      if (!response.ok) {
        const data = await response.json() as ApiError;
        throw new Error(data.error?.message || 'Your journey could not be prepared. Please try again.');
      }
      const data = await response.json() as Journey;
      setJourney(data); setRevision(nextRevision);
      if (!revise) setFeedback({});
      setNotice(revise ? 'Journey revised using your feedback. Loved stops stay; skipped stops are replaced.' : 'Your demo journey is ready.');
      requestAnimationFrame(() => resultHeading.current?.focus());
    } catch (error) {
      setError(error instanceof Error && error.name !== 'AbortError' && error.name !== 'TypeError'
        ? error.message : 'We couldn’t reach the local demo server. Check that it’s running, then try again.');
    } finally { clearTimeout(timeout); setLoading(false); }
  }
  function rate(id: string, value: 'love' | 'skip') {
    setFeedback(previous => {
      const next = { ...previous };
      if (next[id] === value) delete next[id]; else next[id] = value;
      return next;
    });
  }

  return <>
    <a className="skip-link" href="#main">Skip to discovery</a>
    <div className="shell">
      <header className="masthead">
        <a className="wordmark" href="/" aria-label="Plot Twist home">PLOT<span className="brand-turn">↪</span>TWIST<span className="brand-period">.</span></a>
        <span className="masthead-note">GOOD TASTE. UNEXPECTED PLACES.</span>
        <span className="demo-badge"><span /> DEMO EDITION</span>
      </header>
      <main id="main">
        {!journey ? <>
          <section className="hero" aria-labelledby="hero-title">
            <div>
              <p className="eyebrow"><span className="small-star">✳</span> FOR YOUR NEXT GOOD OBSESSION</p>
              <h1 id="hero-title">Your taste.<br />An unexpected <em>turn.</em></h1>
              <p className="hero-copy">Escape your algorithm without losing yourself.<br className="desktop-break" /> Start with what you love. See where it takes you.</p>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
              <span className="orbit-label label-one">MUSIC</span><span className="orbit-label label-two">FILM</span><span className="orbit-label label-three">BOOKS</span>
              <span className="hero-spark">✳</span><span className="hero-caption">CONNECT THE UNEXPECTED</span>
            </div>
          </section>
          <div className="section-rule"><span>01 / START WITH A SPARK</span><span>A LITTLE YOU. A LITTLE UNKNOWN.</span></div>
          <div className="builder">
            <section className="taste-panel" aria-labelledby="taste-title">
              <div className="section-heading"><div><h2 id="taste-title" ref={tasteHeading} tabIndex={-1}>What’s in your orbit?</h2><p>Pick 1–5 favourites from our demo collection.</p></div><span className="count" aria-live="polite">{selected.length}<small> / 5</small></span></div>
              <div className="catalogue-tools">
                <div className="filters" aria-label="Filter by medium">{(['All', 'Music', 'Film', 'Book'] as const).map(value => <button key={value} className={filter === value ? 'active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'Book' ? 'Books' : value}</button>)}</div>
                <label className="search"><span aria-hidden="true">⌕</span><input aria-label="Search demo favourites" placeholder="Find a favourite" value={search} onChange={event => setSearch(event.target.value)} /><kbd aria-hidden="true">↵</kbd></label>
              </div>
              <div className="favourites-grid">{items.map(item => {
                const checked = selected.includes(item.id);
                return <button key={item.id} className={`favourite ${checked ? 'selected' : ''}`} aria-label={`${item.title}, ${item.medium}`} aria-pressed={checked} disabled={!checked && selected.length === 5} onClick={() => toggle(item.id)}>
                  <Artwork item={item} /><span className="selection-mark" aria-hidden="true">{checked ? '✓' : '+'}</span>
                  <span className="item-medium">{item.medium}</span><strong>{item.title}</strong><span className="creator">{item.creator}</span>
                </button>;
              })}</div>
              {items.length === 0 && <div className="empty-state"><span>⌕</span><h3>No matches in this small collection.</h3><p>Try a different title, artist or category. Live search isn’t connected yet.</p><button className="text-button" onClick={() => { setSearch(''); setFilter('All'); }}>Show all favourites ↗</button></div>}
              <div className="catalogue-foot"><span>Hand-picked demo titles · original abstract artwork</span><button className="text-button" onClick={() => { setSelected(['seed-sade', 'seed-wong', 'seed-octavia']); setNotice('Sample taste selected: Sade, In the Mood for Love, and Parable of the Sower.'); }}>Try a sample taste ↗</button></div>
            </section>
            <aside className="adventure-panel" aria-labelledby="adventure-title">
              <p className="eyebrow">02 / CHOOSE YOUR TWIST</p><h2 id="adventure-title">How far will you wander?</h2>
              <fieldset className="adventures"><legend className="sr-only">Adventure level</legend>{adventureLevels.map(option => <label key={option.id} className={`adventure ${adventure === option.id ? 'chosen' : ''}`}><input type="radio" name="adventure" value={option.id} checked={adventure === option.id} onChange={() => setAdventure(option.id)} /><span className="adventure-number">{option.number}</span><span><strong>{option.title}</strong><small>{option.description}</small></span><span className="radio-dot" aria-hidden="true" /></label>)}</fieldset>
              <div className="taste-receipt"><span>YOUR STARTING POINTS</span>{selected.length ? <div className="selected-chips">{selected.map(id => <button key={id} onClick={() => toggle(id)} aria-label={`Remove ${favourites.find(item => item.id === id)!.title}`}>{favourites.find(item => item.id === id)!.title}<span aria-hidden="true">×</span></button>)}</div> : <p>Your favourites will appear here.<br />One is enough to begin.</p>}</div>
              <button className="primary-button" disabled={!selected.length || loading} onClick={() => void discover()}>{loading ? 'Tracing your demo journey…' : 'Find my plot twist'}<span aria-hidden="true">↗</span></button>
              <p className="demo-note">A 3-stop demo across music, film and books.<br />Hand-written connections. No live AI or Qloo calls.</p>
            </aside>
          </div>
        </> : <section className="journey-section" aria-labelledby="journey-title">
          <div className="journey-top"><button className="text-button" onClick={editTaste} disabled={loading}>← Edit my taste</button><span className="eyebrow">03 / YOUR NEXT CHAPTER</span><span className="journey-edition">{level.label} · Edition {revision + 1}</span></div>
          <div className="journey-heading"><p className="eyebrow">A SMALL JOURNEY BEYOND YOUR USUAL</p><h1 ref={resultHeading} tabIndex={-1} id="journey-title">{journey.title}</h1><p>{journey.summary}</p><div className="journey-seeds">Starting with {selected.map(id => favourites.find(item => item.id === id)!.title).join(' · ')}</div></div>
          {journey.status === 'empty' ? <div className="empty-state"><h2>You’ve explored this little collection.</h2><p>Reset your feedback to try another demo journey.</p><button className="primary-button" onClick={() => void discover(false)} disabled={loading}>Start a fresh journey ↗</button></div> : <>
            <ol className="journey-grid">{journey.stops.map((stop, index) => <li key={stop.id} className="journey-card"><div className="stop-label"><span>0{index + 1} / {stop.medium === 'Music' ? 'LISTEN' : stop.medium === 'Film' ? 'WATCH' : 'READ'}</span><span>{index === 0 ? 'The spark' : index === 1 ? 'The bridge' : 'The new world'} ↗</span></div><Artwork item={stop} large /><div className="stop-body"><p className="eyebrow">{stop.medium} · DEMO PICK</p><h2>{stop.title}</h2><p className="stop-creator">{stop.creator}</p><p className="stop-description">{stop.description}</p><div className="connection"><span>THE THREAD</span><p>{stop.connection}</p></div><p className="invitation">{stop.invitation}</p><div className="feedback" aria-label={`Feedback for ${stop.title}`}><button aria-pressed={feedback[stop.id] === 'love'} onClick={() => rate(stop.id, 'love')} disabled={loading}>♡ Keep this</button><button aria-pressed={feedback[stop.id] === 'skip'} onClick={() => rate(stop.id, 'skip')} disabled={loading}>↻ Try another</button></div></div></li>)}</ol>
            <div className="revise-panel"><div><p className="eyebrow">YOUR TASTE IS A CONVERSATION</p><h2>Good turn? Or one more twist?</h2><p>Keep the sparks. Swap what doesn’t click. Feedback stays in this session.</p></div><button className="primary-button" disabled={loading || revision >= 100 || !journey.stops.some(stop => feedback[stop.id])} onClick={() => void discover(true)}>{loading ? 'Revising your demo…' : 'Revise my journey'}<span aria-hidden="true">↪</span></button></div>
          </>}
        </section>}
        {error && <div className="error-banner" role="alert"><strong>Let’s try that again.</strong> {error}<button className="text-button" disabled={loading} onClick={() => void discover(Boolean(journey))}>Retry ↗</button></div>}
        <p className="status-message" role="status">{notice}</p>
      </main>
      <footer><span className="footer-brand">PLOT TWIST.</span><p>Follow your taste. Leave room for surprise.</p><span>PROTOTYPE 001 <span aria-hidden="true">✳</span></span></footer>
    </div>
  </>;
}
