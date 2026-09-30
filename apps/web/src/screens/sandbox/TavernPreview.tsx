import { useMemo, useState } from 'react';
import { useI18n } from '../../i18n';
import { TavernRoom } from '../city/TavernRoom';
import { BountyBoard, LodgingCard } from '../city/Tavern';
import { RankingsBoard } from '../city/Rankings';
import { tavernFixtures, TAVERN_STATES, type TavernState } from './tavernFixtures';
const TEXT = {
  en: { quiet:'Quiet Tavern',busy:'Mid-Season',finale:'Finale',hall:'Two Seasons',note:'Preview: Lodging and swaps change only these examples.' },
  ru: { quiet:'Тихая таверна',busy:'Середина сезона',finale:'Финал',hall:'Два сезона',note:'Пример: ночлег и замена заданий меняют только эти примеры.' },
};
export function TavernPreview() {
  const { t,locale } = useI18n(),copy = TEXT[locale];
  const [state,setState]=useState<TavernState>('busy');
  return <section className="grid gap-3" data-tavern-preview><h2 className="sub-heading">{t('city.tavern')}</h2>
    <div className="flex flex-wrap gap-2">{TAVERN_STATES.map(key => <button type="button" className="btn btn-small" key={key} data-tavern-fixture={key} aria-pressed={state===key} onClick={()=>setState(key)}>{copy[key]}</button>)}</div>
    <p className="text-sm text-muted">{copy.note}</p><Example key={state} state={state}/>
  </section>;
}
function Example({state}:{state:TavernState}) {
  const fixture=useMemo(()=>tavernFixtures(state),[state]);
  const [lodging,setLodging]=useState(fixture.lodging),[bounties,setBounties]=useState(fixture.bounties);
  const {t}=useI18n();
  return <TavernRoom view={fixture.view} hall={fixture.hall} initialTab={state==='hall'?'hall':'feed'} rankings={<RankingsBoard data={fixture.rankings}/>}
    lodging={<LodgingCard data={lodging} slept={lodging.availableAt!==null} onSleep={()=>setLodging(d=>({...d,gold:d.gold-d.price,stamina:d.staminaMax,shortRests:{left:2,of:2},availableAt:new Date(Date.now()+86400000).toISOString()}))}/>}
    bounties={state==='quiet'?<p className="tavern-empty">{t('bounty.noHero')}</p>:<BountyBoard data={bounties} onSwap={id=>setBounties(d=>({...d,daily:d.daily.map(b=>b.id===id?{...b,id:'swapped',title:{en:'Bring home 100 gold',ru:'Принести домой 100 золота'},target:100,canSwap:false}:b)}))}/>}/>
}
