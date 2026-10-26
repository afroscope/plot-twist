import { useEffect, useRef, useState } from 'react';
import { adventureLevels, favourites, type Adventure, type CulturalItem, type Medium } from '../shared/catalog';
import type { ApiError, Feedback, Journey } from '../shared/contracts';

const symbols: Record<Medium, string> = { Music: '↗', Film: '◉', Book: '▤' };

function Artwork({ item, large = false }: { item: CulturalItem; large?: boolean }) {
  return <div aria-hidden="true" className={`artwork ${item.palette} ${large ? 'large' : ''}`}>
    <span className="art-grid" /><span className="art-orbit" /><span className="art-disc" />
    <span className="art-type">{item.medium === 'Music' ? 'SOUND' : item.medium === 'Film' ? 'SCENE' : 'STORY'}</span>
    <span className="art-mark">{symbols[item.medium]}</span>
  </div>;
}

export default function App() {
  const [mode, setMode] = useState<'agent' | 'qloo' | 'demo'>('agent');
  const [agentReady, setAgentReady] = useState<'checking' | 'ready' | 'unavailable' | 'unknown'>('checking');
  const [liveItems, setLiveItems] = useState<CulturalItem[]>([]);
  const [knownItems, setKnownItems] = useState<CulturalItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchGeneration = useRef(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [familiar, setFamiliar] = useState<string[]>([]);
  const [tasteGroup, setTasteGroup] = useState<'love' | 'dislike' | 'known'>('love');
  const [context, setContext] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [filter, setFilter] = useState<Medium | 'All'>('All');
  const [search, setSearch] = useState('');
  const [adventure, setAdventure] = useState<Adventure>('curious');
  const [journey, setJourney] = useState<Journey | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const tasteHeading = useRef<HTMLHeadingElement>(null);
  const requestController = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/health', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { if (!controller.signal.aborted) setAgentReady(data.agent === 'configured-unverified' ? 'ready' : 'unavailable'); })
      .catch(() => { if (!controller.signal.aborted) setAgentReady('unknown'); });
    return () => { controller.abort(); requestController.current?.abort(); };
  }, []);
  const catalogue = mode === 'demo' ? favourites : knownItems;
  const items = mode !== 'demo' ? liveItems : favourites.filter(item => (filter === 'All' || item.medium === filter)
    && `${item.title} ${item.creator}`.toLowerCase().includes(search.toLowerCase().trim()));
  const level = adventureLevels.find(level => level.id === adventure)!;
  const groupIds = tasteGroup === 'love' ? selected : tasteGroup === 'dislike' ? disliked : familiar;
  const groupLimit = tasteGroup === 'love' ? 5 : tasteGroup === 'dislike' ? 10 : 15;

  function switchMode(next: 'agent' | 'qloo' | 'demo') {
    if (next === mode) return;
    if (next !== 'demo' && mode !== 'demo') { setMode(next); setJourney(null); setFeedback({}); setRevision(0); setError(''); return; }
    searchGeneration.current += 1;
    setMode(next); setSelected([]); setJourney(null); setFeedback({}); setRevision(0);
    setSearch(''); setLiveItems([]); setKnownItems([]); setSearched(false); setSearching(false);
    setError(''); setSearchError(''); setNotice('');
    setDisliked([]); setFamiliar([]); setTasteGroup('love'); setContext(''); setShowContext(false);
  }
  async function searchQloo() {
    if (search.trim().length < 2 || searching) return;
    const generation = ++searchGeneration.current;
    setSearching(true); setSearchError(''); setSearched(false); setLiveItems([]);
    try {
      const params = new URLSearchParams({ q: search.trim() });
      if (filter !== 'All') params.set('medium', filter);
      const response = await fetch(`/api/search?${params}`, { signal: AbortSignal.timeout(10000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Search is unavailable.');
      if (generation !== searchGeneration.current) return;
      const found = data.items as CulturalItem[];
      setLiveItems(found); setSearched(true);
      setKnownItems(previous => [...new Map([...previous, ...found].map(item => [item.id, item])).values()]);
    } catch (error) {
      if (generation === searchGeneration.current) setSearchError(error instanceof Error && error.name === 'Error' ? error.message : 'Search could not reach Qloo. Please try again.');
    } finally { if (generation === searchGeneration.current) setSearching(false); }
  }
  function toggle(id: string, group = tasteGroup) {
    setNotice('');
    const current = group === 'love' ? selected : group === 'dislike' ? disliked : familiar;
    const limit = group === 'love' ? 5 : group === 'dislike' ? 10 : 15;
    const removing = current.includes(id);
    if (!removing && current.length >= limit) { setNotice(`You can add up to ${limit} items in this group.`); return; }
    setSelected(previous => group === 'love' && !removing ? [...previous.filter(value => value !== id), id] : previous.filter(value => value !== id));
    setDisliked(previous => group === 'dislike' && !removing ? [...previous.filter(value => value !== id), id] : previous.filter(value => value !== id));
    setFamiliar(previous => group === 'known' && !removing ? [...previous.filter(value => value !== id), id] : previous.filter(value => value !== id));
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
    requestController.current = controller;
    const timeout = setTimeout(() => controller.abort(), mode === 'agent' ? 80000 : 20000);
    try {
      const response = await fetch('/api/journeys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ mode, favouriteIds: selected, adventure, revision: nextRevision, feedback: revise ? feedback : {},
          ...(mode !== 'demo' ? { dislikedIds: disliked, knownIds: familiar } : {}), ...(mode === 'agent' ? { context } : {}) }),
      });
      if (!response.ok) {
        const data = await response.json() as ApiError;
        throw new Error(data.error?.message || 'Your journey could not be prepared. Please try again.');
      }
      const data = await response.json() as Journey;
      setJourney(data); setRevision(nextRevision);
      if (mode !== 'demo') setKnownItems(previous => [...new Map([...previous, ...data.stops].map(item => [item.id, item])).values()]);
      if (!revise) setFeedback({});
      setNotice(data.status === 'needs_input' ? 'Please reselect your favourites.' : revise ? 'Journey revised using your feedback.' : data.source === 'qloo' ? 'Your Qloo discoveries are ready.' : 'Your demo journey is ready.');
      requestAnimationFrame(() => resultHeading.current?.focus());
    } catch (error) {
      setError(controller.signal.aborted ? 'Discovery stopped or timed out. Your selections are still here.' : error instanceof Error && error.name !== 'AbortError' && error.name !== 'TypeError'
        ? error.message : 'We couldn’t reach the discovery server. Check that it’s running, then try again.');
    } finally { clearTimeout(timeout); requestController.current = null; setLoading(false); }
  }
  function rate(id: string, value: Feedback) {
    if (!feedback[id] && Object.keys(feedback).length >= 30) {
      setNotice('You have reached 30 feedback choices. Start a fresh journey to reset them.'); return;
    }
    setFeedback(previous => {
      const next = { ...previous };
      if (next[id] === value) delete next[id]; else if (Object.keys(next).length < 30 || next[id]) {
        if (value === 'love') {
          const medium = journey?.stops.find(stop => stop.id === id)?.medium;
          for (const oldId of Object.keys(next)) if (next[oldId] === 'love' && knownItems.find(item => item.id === oldId)?.medium === medium) delete next[oldId];
        }
        next[id] = value;
      }
      return next;
    });
  }

  return <>
    <a className="skip-link" href="#main">Skip to discovery</a>
    <div className="shell">
      <header className="masthead">
        <a className="wordmark" href="/" aria-label="Plot Twist home">PLOT<span className="brand-turn">↪</span>TWIST<span className="brand-period">.</span></a>
        <span className="masthead-note">GOOD TASTE. UNEXPECTED PLACES.</span>
        <span className="demo-badge"><span /> {mode === 'agent' ? 'AGENT DISCOVERY' : mode === 'qloo' ? 'QLOO DISCOVERY' : 'DEMO EDITION'}</span>
      </header>
      <main id="main">
        <div className="mode-bar" aria-label="Discovery mode">
          <div className="filters">{(['agent', 'qloo', 'demo'] as const).map(value => <button key={value} disabled={loading} aria-pressed={mode === value} className={mode === value ? 'active' : ''} onClick={() => switchMode(value)}>{value === 'agent' ? 'Agent discovery' : value === 'qloo' ? 'Qloo discovery' : 'Try the demo'}</button>)}</div>
          <span>{mode === 'agent' ? 'Your selections give the agent its brief.' : mode === 'qloo' ? 'Qloo affinity ranking · no model decisions' : 'Sample catalogue · no live recommendations'}</span>
        </div>
        {mode === 'agent' && agentReady === 'unavailable' && <div className="setup-note" role="status">Agent discovery needs its model connection. You can still explore with <button className="text-button" onClick={() => switchMode('qloo')}>Qloo discovery ↗</button>.</div>}
        {loading && <div className="discovery-progress" role="status"><span>{mode === 'agent' ? 'The agent is exploring Qloo and considering your journey. This may take up to a minute.' : 'Finding your discoveries…'}</span><button className="text-button" onClick={() => requestController.current?.abort()}>Cancel</button></div>}
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
          <fieldset className="builder" disabled={loading}>
            <legend className="sr-only">Build your discovery brief</legend>
            <section className="taste-panel" aria-labelledby="taste-title">
              <div className="section-heading"><div><h2 id="taste-title" ref={tasteHeading} tabIndex={-1}>What’s in your orbit?</h2><p>{mode !== 'demo' ? 'Search for an artist, film or book. Start with 1–5 favourites.' : 'Pick 1–5 favourites from our demo collection.'}</p></div><span className="count" aria-live="polite">{groupIds.length}<small> / {groupLimit}</small></span></div>
              {mode !== 'demo' && <div className="taste-groups"><div className="filters" aria-label="Add selection as">{(['love', 'dislike', 'known'] as const).map(group => <button key={group} aria-pressed={tasteGroup === group} className={tasteGroup === group ? 'active' : ''} onClick={() => setTasteGroup(group)}>{group === 'love' ? 'I love this' : group === 'dislike' ? 'Not for me' : 'Already know it'}</button>)}</div><p>{tasteGroup === 'love' ? 'These are the sparks to build from.' : tasteGroup === 'dislike' ? 'Leave these out. One dislike doesn’t rule out a whole genre.' : 'Leave these out because they’re familiar. This doesn’t mean you dislike them.'}</p></div>}
              <div className="catalogue-tools">
                <div className="filters" aria-label="Filter by medium">{(['All', 'Music', 'Film', 'Book'] as const).map(value => <button key={value} className={filter === value ? 'active' : ''} aria-pressed={filter === value} onClick={() => { setFilter(value); if (mode !== 'demo') { searchGeneration.current += 1; setLiveItems([]); setSearched(false); setSearching(false); } }}>{value === 'Book' ? 'Books' : value}</button>)}</div>
                <label className="search"><span aria-hidden="true">⌕</span><input aria-label="Search favourites" placeholder="Find a favourite" value={search} maxLength={120} onKeyDown={event => { if (event.key === 'Enter' && mode !== 'demo') void searchQloo(); }} onChange={event => { setSearch(event.target.value); if (mode !== 'demo') { searchGeneration.current += 1; setLiveItems([]); setSearched(false); setSearching(false); } }} /><kbd aria-hidden="true">↵</kbd></label>
                {mode !== 'demo' && <button className="text-button" disabled={searching || search.trim().length < 2} onClick={() => void searchQloo()}>{searching ? 'Searching…' : 'Search Qloo ↗'}</button>}
              </div>
              {searchError && <div className="error-banner" role="alert">{searchError}</div>}
              {mode !== 'demo' && !searched && !searching && !searchError && <div className="empty-state"><h3>Start with something you love.</h3><p>Try Sade, Moonlight or Parable of the Sower. Check the title and details before selecting a match.</p></div>}
              <div className="favourites-grid">{items.map(item => {
                const checked = groupIds.includes(item.id);
                return <button key={item.id} className={`favourite ${checked ? 'selected' : ''}`} aria-label={`${item.title}, ${item.medium}`} aria-pressed={checked} disabled={!checked && groupIds.length >= groupLimit} onClick={() => toggle(item.id)}>
                  <Artwork item={item} /><span className="selection-mark" aria-hidden="true">{checked ? '✓' : '+'}</span>
                  <span className="item-medium">{item.medium}</span><strong>{item.title}</strong><span className="creator">{item.creator}</span>
                </button>;
              })}</div>
              {items.length === 0 && (mode === 'demo' || searched) && <div className="empty-state"><span>⌕</span><h3>No matching favourites found.</h3><p>Try a different spelling, title or category.</p><button className="text-button" onClick={() => { setSearch(''); setFilter('All'); }}>Show all favourites ↗</button></div>}
              <div className="catalogue-foot"><span>{mode !== 'demo' ? 'Catalogue matches from Qloo · original abstract artwork' : 'Hand-picked demo titles · original abstract artwork'}</span>{mode === 'demo' && <button className="text-button" onClick={() => { setSelected(['seed-sade', 'seed-wong', 'seed-octavia']); setNotice('Sample taste selected: Sade, In the Mood for Love, and Parable of the Sower.'); }}>Try a sample taste ↗</button>}</div>
            </section>
            <aside className="adventure-panel" aria-labelledby="adventure-title">
              <p className="eyebrow">02 / CHOOSE YOUR TWIST</p><h2 id="adventure-title">How far will you wander?</h2>
              <fieldset className="adventures"><legend className="sr-only">Adventure level</legend>{adventureLevels.map(option => <label key={option.id} className={`adventure ${adventure === option.id ? 'chosen' : ''}`}><input type="radio" name="adventure" value={option.id} checked={adventure === option.id} onChange={() => setAdventure(option.id)} /><span className="adventure-number">{option.number}</span><span><strong>{option.title}</strong><small>{option.description}</small></span><span className="radio-dot" aria-hidden="true" /></label>)}</fieldset>
              <div className="taste-receipt"><span>YOUR STARTING POINTS</span>{selected.length ? <div className="selected-chips">{selected.map(id => <button key={id} onClick={() => toggle(id, 'love')} aria-label={`Remove ${catalogue.find(item => item.id === id)?.title || 'Favourite'}`}>{catalogue.find(item => item.id === id)?.title || 'Favourite'}<span aria-hidden="true">×</span></button>)}</div> : <p>Your favourites will appear here.<br />One is enough to begin.</p>}</div>
              {mode !== 'demo' && ([['dislike', disliked, 'NOT FOR ME'], ['known', familiar, 'ALREADY KNOW IT']] as const).map(([group, ids, label]) => ids.length > 0 && <div className="taste-receipt" key={group}><span>{label}</span><div className="selected-chips">{ids.map(id => <button key={id} onClick={() => toggle(id, group)} aria-label={`Remove ${catalogue.find(item => item.id === id)?.title} from ${label.toLowerCase()}`}>{catalogue.find(item => item.id === id)?.title}<span aria-hidden="true">×</span></button>)}</div></div>)}
              {mode === 'agent' && <div className="context-option"><button className="text-button" aria-expanded={showContext} aria-controls="extra-context" onClick={() => setShowContext(value => !value)}>{showContext ? '−' : '+'} Give more context <span>(optional)</span></button>{showContext && <div id="extra-context"><label htmlFor="taste-context">Anything else for this journey?</label><textarea id="taste-context" maxLength={1000} rows={3} placeholder="A quiet evening. Keep the music warm; surprise me with the book." value={context} onChange={event => setContext(event.target.value)} /><small>{context.length}/1000 · Select specific titles above to exclude them.</small></div>}</div>}
              <button className="primary-button" disabled={!selected.length || loading || (mode === 'agent' && (agentReady === 'checking' || agentReady === 'unavailable'))} onClick={() => void discover()}>{loading ? 'Finding your discoveries…' : 'Find my plot twist'}<span aria-hidden="true">↗</span></button>
              <p className="demo-note">{mode === 'agent' ? 'The agent chooses Qloo searches and builds your journey. Qloo receives catalogue signals; OpenAI receives your selections and optional context. Avoid personal details.' : mode === 'qloo' ? 'Discover music, film and books through Qloo’s cultural affinities. Your adventure level explores further down the recommendation list.' : 'A 3-stop demo. Hand-written connections; no live Qloo calls.'}</p>
            </aside>
          </fieldset>
        </> : <section className="journey-section" aria-labelledby="journey-title">
          <div className="journey-top"><button className="text-button" onClick={editTaste} disabled={loading}>← Edit my taste</button><span className="eyebrow">03 / YOUR NEXT CHAPTER</span><span className="journey-edition">{level.label} · Edition {revision + 1}</span></div>
          <div className="journey-heading"><p className="eyebrow">A SMALL JOURNEY BEYOND YOUR USUAL</p><h1 ref={resultHeading} tabIndex={-1} id="journey-title">{journey.title}</h1><p>{journey.summary}</p><div className="journey-seeds">Starting with {selected.map(id => catalogue.find(item => item.id === id)?.title || 'Favourite').join(' · ')}</div></div>
          {journey.notices?.map(message => <p className="error-banner" role="status" key={message}>{message}</p>)}
          {journey.status === 'needs_input' ? <div className="empty-state"><h2>Choose your favourites again.</h2><p>{journey.summary}</p><button className="primary-button" onClick={() => { setSelected([]); setDisliked([]); setFamiliar([]); setFeedback({}); editTaste(); }}>Back to search ↗</button></div> : journey.status === 'empty' ? <div className="empty-state"><h2>No discoveries available for this combination.</h2><p>Reset your feedback or edit your favourites to try a different direction.</p><button className="primary-button" onClick={() => void discover(false)} disabled={loading}>Start a fresh journey ↗</button></div> : <>
            <ol className="journey-grid">{journey.stops.map((stop, index) => <li key={stop.id} className="journey-card"><div className="stop-label"><span>0{index + 1} / {stop.medium === 'Music' ? 'LISTEN' : stop.medium === 'Film' ? 'WATCH' : 'READ'}</span><span>{index === 0 ? 'The spark' : index === 1 ? 'The bridge' : 'The new world'} ↗</span></div><Artwork item={stop} large /><div className="stop-body"><p className="eyebrow">{stop.medium} · {journey.method === 'agent' ? 'AGENT PICK · QLOO CATALOGUE' : journey.source === 'qloo' ? 'QLOO PICK' : 'DEMO PICK'}</p><h2>{stop.title}</h2><p className="stop-creator">{stop.creator}</p><p className="stop-description">{stop.description}</p><div className="connection"><span>{journey.method === 'agent' ? 'FROM QLOO' : 'THE THREAD'}</span><p>{stop.connection}</p></div>{stop.interpretation && <div className="interpretation"><span>THE AGENT’S TAKE</span><p>{stop.interpretation}</p></div>}<p className="invitation">{stop.invitation}</p><div className="feedback" aria-label={`Feedback for ${stop.title}`}><button aria-pressed={feedback[stop.id] === 'love'} onClick={() => rate(stop.id, 'love')} disabled={loading}>♡ Keep this</button>{mode === 'agent' ? <>{([['known', 'Already know it'], ['dislike', 'Not for me'], ['farther', 'More adventurous']] as const).map(([action, label]) => <button key={action} aria-pressed={feedback[stop.id] === action} onClick={() => rate(stop.id, action)} disabled={loading}>{label}</button>)}</> : <button aria-pressed={feedback[stop.id] === 'skip'} onClick={() => rate(stop.id, 'skip')} disabled={loading}>↻ Try another</button>}</div></div></li>)}</ol>
            <div className="revise-panel"><div><p className="eyebrow">YOUR TASTE IS A CONVERSATION</p><h2>Good turn? Or one more twist?</h2><p>{mode === 'agent' ? 'Keep a favourite stop, mark what’s familiar, or take one category further. Your feedback shapes the next search.' : 'Keep the sparks. Swap what doesn’t click.'} Feedback stays in this session. Up to 30 choices.</p><button className="text-button" disabled={loading} onClick={() => void discover(false)}>Start fresh without feedback ↗</button></div><button className="primary-button" disabled={loading || revision >= 100 || !journey.stops.some(stop => feedback[stop.id])} onClick={() => void discover(true)}>{loading ? 'Following your feedback…' : 'Revise my journey'}<span aria-hidden="true">↪</span></button></div>
          </>}
        </section>}
        {error && <div className="error-banner" role="alert"><strong>Let’s try that again.</strong> {error}<button className="text-button" disabled={loading} onClick={() => void discover(Boolean(journey))}>Retry ↗</button></div>}
        <p className="status-message" role="status">{notice}</p>
      </main>
      <footer><span className="footer-brand">PLOT TWIST.</span><p>Follow your taste. Leave room for surprise.</p><span>PROTOTYPE 001 <span aria-hidden="true">✳</span></span></footer>
    </div>
  </>;
}
