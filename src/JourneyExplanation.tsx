import { adventureLevels } from '../shared/catalog';
import type { Feedback, JourneyExplanation as Explanation, JourneyReference } from '../shared/contracts';

const feedbackLabels: Record<Feedback, string> = { love: 'Keep', known: 'Already know', dislike: 'Not for me', farther: 'More adventurous', skip: 'Try another' };
const titles = (items: JourneyReference[]) => items.map(item => item.title).join(' · ');

export function JourneyExplanation({ explanation }: { explanation: Explanation }) {
  const { brief, searches, uniqueCandidates, selections } = explanation;
  const keptCount = selections.filter(selection => selection.kept).length;
  return <details className="journey-explanation">
    <summary><span><strong>How this journey was built</strong><small>{searches.length} Qloo {searches.length === 1 ? 'search' : 'searches'} · {uniqueCandidates} distinct candidates{keptCount > 0 ? ` · ${keptCount} kept` : ''}</small></span><span className="explanation-toggle" aria-hidden="true">+</span></summary>
    <div className="explanation-content">
      <div className="explanation-brief"><h2>Your brief</h2><dl>
        <div><dt>Starting points</dt><dd>{titles(brief.favourites)}</dd></div>
        <div><dt>Your direction</dt><dd>{adventureLevels.find(level => level.id === brief.adventure)?.title}</dd></div>
        {brief.disliked.length > 0 && <div><dt>Not for me</dt><dd>{titles(brief.disliked)}</dd></div>}
        {brief.known.length > 0 && <div><dt>Already know</dt><dd>{titles(brief.known)}</dd></div>}
        {brief.context && <div><dt>Your extra context</dt><dd className="brief-context">{brief.context}</dd></div>}
      </dl>
      {brief.feedback.length > 0 && <><h3>Feedback used for this edition</h3><ul className="explanation-feedback">{brief.feedback.map(({ item, action }) => <li key={item.id}><strong>{feedbackLabels[action]}</strong> — {item.title}{action === 'farther' ? ` (${item.medium})` : ''}</li>)}</ul></>}
      <p className="explanation-note">Familiar and disliked items in your brief are excluded from new picks. Knowing something doesn’t count as disliking it.</p></div>
      <div className="explanation-searches"><h2>What the agent explored</h2>
        {searches.length === 0 ? <p>All three discoveries were kept, so no new Qloo search was needed.</p> : <ol>{searches.map(search => <li key={search.number}>
          <div className="search-event-heading"><strong>{search.number.toString().padStart(2, '0')} / {search.medium}</strong><span>{search.round > 1 ? 'Follow-up search' : 'Initial search'}</span></div>
          <p>Using {search.signals.map((item, index) => <span key={`${item.id}-${index}`}>{index > 0 ? ', ' : ''}<strong>{item.title}</strong>{item.source === 'kept' ? ' (kept discovery)' : item.source === 'discovery' ? ' (discovered in this journey)' : ''}</span>)}.</p>
          <p className="search-outcome">{search.status === 'unavailable' ? 'Qloo was unavailable for this search; no candidates were added.'
            : `${search.candidateCount} ${search.candidateCount === 1 ? 'candidate' : 'candidates'} available after exclusions.`} {search.offset > 0 ? `Requested a later part of the affinity ranking, starting at position ${search.offset + 1}.` : 'Requested the first part of the affinity ranking.'}</p>
        </li>)}</ol>}
      </div>
      <div className="explanation-selections"><h2>How the final picks connect</h2><ul>{selections.map(({ item, kept, searchNumber }) => <li key={item.id}><span>{item.medium}</span><strong>{item.title}</strong><p>{kept ? 'Kept exactly as you requested.' : `First returned in search ${searchNumber}; selected by the agent from the available candidates.`}</p></li>)}</ul>
        <p className="explanation-note">Qloo supplies the affinity results. “The agent’s take” on each card is its interpretation. Search positions describe Qloo’s ranking; they aren’t a measured novelty score. Repeated candidates are counted once in the total.</p>
      </div>
    </div>
  </details>;
}
