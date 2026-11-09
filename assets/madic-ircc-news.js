/* MADIC - Actualites officielles IRCC. Aucun acces aux donnees du portail. */
(() => {
  'use strict';
  const target = document.getElementById('madicActualitesItems');
  if (!target) return;
  const sources = {
    fr: 'https://api.io.canada.ca/io-server/gc/news/fr/v2?dept=departmentofcitizenshipandimmigration&sort=publishedDate&orderBy=desc&pick=20&format=atom',
    en: 'https://api.io.canada.ca/io-server/gc/news/en/v2?dept=departmentofcitizenshipandimmigration&sort=publishedDate&orderBy=desc&pick=20&format=atom'
  };
  const fallback = {
    fr: 'https://www.canada.ca/fr/nouvelles/rechercher/recherche-avancee.html?sort=descending&allq=&dprtmnt=Immigration%2C+R%C3%A9fugi%C3%A9s+et+Citoyennet%C3%A9+Canada&declaredtype=communiqu%C3%A9s+de+presse&startdate=&enddate=',
    en: 'https://www.canada.ca/en/news/advanced-news-search/news-results.html?sort=descending&allq=&dprtmnt=Immigration%2C+Refugees+and+Citizenship+Canada'
  };
  const words = {
    fr: {loading:'Chargement des actualités officielles…', unavailable:'Le service d’actualités est temporairement inaccessible.', link:'Consulter les communiqués officiels', read:'Lire la suite', source:'Immigration, Réfugiés et Citoyenneté Canada'},
    en: {loading:'Loading official news…', unavailable:'The news service is temporarily unavailable.', link:'View official news releases', read:'Read more', source:'Immigration, Refugees and Citizenship Canada'}
  };
  let lastLang = '', requestId = 0;
  const lang = () => document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'fr';
  const clean = value => (value || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const child = (element, name) => Array.from(element.children).find(n => n.localName === name);
  const val = (element, name) => child(element,name)?.textContent?.trim() || '';
  function parse(xml) {
    const doc = new DOMParser().parseFromString(xml,'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid XML');
    const entries = Array.from(doc.getElementsByTagName('*')).filter(n => n.localName === 'entry' || n.localName === 'item');
    return entries.map(e => {
      const links = Array.from(e.children).filter(n => n.localName === 'link');
      const href = links.find(n => n.getAttribute('rel') === 'alternate')?.getAttribute('href') || links.find(n => n.getAttribute('href'))?.getAttribute('href') || links[0]?.textContent?.trim() || '';
      const rawDate = val(e,'published') || val(e,'pubDate') || val(e,'updated');
      const timestamp = Date.parse(rawDate);
      return { title:val(e,'title'), summary:clean(val(e,'summary') || val(e,'description') || val(e,'content')).slice(0,310), href, date:Number.isFinite(timestamp)?timestamp:0 };
    }).filter(item => item.title && item.date && /^https:\/\//i.test(item.href)).sort((a,b) => b.date-a.date).slice(0,3);
  }
  function showFallback(language) {
    const p=document.createElement('p');p.className='madic-publication-empty';p.textContent=words[language].unavailable;
    const a=document.createElement('a');a.href=fallback[language];a.target='_blank';a.rel='noopener noreferrer';a.textContent=words[language].link;
    target.replaceChildren(p,a);
  }
  function render(items,language) {
    if (!items.length) return showFallback(language);
    const fragment=document.createDocumentFragment();
    for (const item of items) {
      const article=document.createElement('article');article.className='madic-ircc-article';
      const date=document.createElement('time');date.dateTime=new Date(item.date).toISOString();date.textContent=new Intl.DateTimeFormat(language==='fr'?'fr-CA':'en-CA',{year:'numeric',month:'long',day:'numeric'}).format(item.date);
      const title=document.createElement('h3');const a=document.createElement('a');a.href=item.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=item.title;title.append(a);
      const source=document.createElement('small');source.textContent=words[language].source;
      article.append(date,title,source);
      if(item.summary){const p=document.createElement('p');p.textContent=item.summary;article.append(p);}
      const read=document.createElement('a');read.href=item.href;read.target='_blank';read.rel='noopener noreferrer';read.textContent=words[language].read+' ↗';article.append(read);
      fragment.append(article);
    }
    target.replaceChildren(fragment);
  }
  async function load(force=false) {
    const language=lang();if (!force && lastLang===language) return;
    lastLang=language;const id=++requestId;target.textContent=words[language].loading;
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch(sources[language],{signal:controller.signal,headers:{Accept:'application/atom+xml,application/xml,text/xml'}});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const entries=parse(await response.text());if(id!==requestId)return;
      render(entries,language);
    } catch(error) {if(id===requestId){console.warn('MADIC IRCC feed unavailable:',error);showFallback(language);}}
    finally {clearTimeout(timeout);}
  }
  new MutationObserver(()=>load()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  load();
  setInterval(()=>load(true),15*60*1000);
})();
