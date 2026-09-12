const films = [
  {title:"The Big Lebowski",image:"assets/posters/the-big-lebowski.jpg",collection:"Tonight",note:"A Friday-night classic with its own weather system."},
  {title:"Pretty in Pink",image:"assets/posters/pretty-in-pink.jpg",collection:"Tonight",note:"Warm, sharp and endlessly rewatchable."},
  {title:"Portrait of a Lady on Fire",image:"assets/posters/portrait-of-a-lady-on-fire.jpg",collection:"Tonight",note:"A film about looking—and being remembered."},
  {title:"Badlands",image:"assets/posters/badlands.jpg",collection:"Love & Rebellion",note:"Dreamlike Americana with danger under the surface."},
  {title:"The Truman Show",image:"assets/posters/the-truman-show.jpg",collection:"Epiphanies",note:"A perfect premise that became a modern fable."},
  {title:"The Godfather",image:"assets/posters/the-godfather.jpg",collection:"Essential",note:"The family epic against which all others are measured."},
  {title:"Network",image:"assets/posters/network.jpg",collection:"America",note:"Furious, funny and still alarmingly current."},
  {title:"Dr. Strangelove",image:"assets/posters/dr-strangelove-or-how-i-learned-to-stop-worrying-and-love-the-bomb.jpg",collection:"Funny",note:"The end of the world, played as perfect farce."},
  {title:"It's a Wonderful Life",image:"assets/posters/it-s-a-wonderful-life.jpg",collection:"Essential",note:"More bruised, strange and human than its reputation."},
  {title:"Casablanca",image:"assets/posters/casablanca.jpg",collection:"Essential",note:"Romance and sacrifice, without a wasted frame."},
  {title:"Amadeus",image:"assets/posters/amadeus.jpg",collection:"Music",note:"Genius, envy and spectacle in ecstatic collision."},
  {title:"2001: A Space Odyssey",image:"assets/posters/2001-a-space-odyssey.jpg",collection:"The Future",note:"Cinema at its most mysterious and monumental."},
  {title:"The Third Man",image:"assets/posters/the-third-man.jpg",collection:"Criminal Mind",note:"Ruins, shadows and one unforgettable entrance."},
  {title:"Chinatown",image:"assets/posters/chinatown.jpg",collection:"Criminal Mind",note:"A sunlit noir with darkness at its centre."},
  {title:"One Flew Over the Cuckoo's Nest",image:"assets/posters/one-flew-over-the-cuckoo-s-nest.jpg",collection:"Rebellion",note:"A charged study of freedom and authority."},
  {title:"Days of Heaven",image:"assets/posters/days-of-heaven.jpg",collection:"Visual Symphony",note:"Light, landscape and longing become the story."},
  {title:"Capote",image:"assets/posters/capote.jpg",collection:"Criminal Mind",note:"A cool, exacting portrait of ambition and obsession."},
  {title:"Zodiac",image:"assets/posters/zodiac.jpg",collection:"Criminal Mind",note:"An investigation becomes an atmosphere—and an illness."},
  {title:"The Silence of the Lambs",image:"assets/posters/the-silence-of-the-lambs.jpg",collection:"Criminal Mind",note:"Precision suspense anchored by two magnetic performances."},
  {title:"A History of Violence",image:"assets/posters/a-history-of-violence.jpg",collection:"America",note:"A lean reckoning with identity and buried violence."},
  {title:"The Talented Mr. Ripley",image:"assets/posters/the-talented-mr-ripley.jpg",collection:"Criminal Mind",note:"Beauty, envy and reinvention on the Italian coast."},
  {title:"Monster",image:"assets/posters/monster.jpg",collection:"Criminal Mind",note:"A difficult story told without easy distance."},
  {title:"No Country for Old Men",image:"assets/posters/no-country-for-old-men.jpg",collection:"America",note:"A western stripped to fate, chance and silence."},
  {title:"Taxi Driver",image:"assets/posters/taxi-driver.jpg",collection:"America",note:"The city as fever dream."},
  {title:"American Psycho",image:"assets/posters/american-psycho.jpg",collection:"Funny",note:"A savage comedy dressed as a nightmare."},
  {title:"RoboCop",image:"assets/posters/robocop.jpg",collection:"The Future",note:"Brutal, hilarious satire in action-movie armour."},
  {title:"Children of Men",image:"assets/posters/children-of-men.jpg",collection:"The Future",note:"A future thriller alive with desperate hope."},
  {title:"The Matrix",image:"assets/posters/the-matrix.jpg",collection:"The Future",note:"The blockbuster that made philosophy move at bullet speed."},
  {title:"Her",image:"assets/posters/her.jpg",collection:"The Future",note:"A tender love story about technology and loneliness."}
];

const rows = [
  {title:"New to the canon",tag:"tonight",items:["Pretty in Pink","Portrait of a Lady on Fire","The Truman Show","Badlands"]},
  {title:"See before you die",tag:"essential",items:["The Godfather","2001: A Space Odyssey","Casablanca","Amadeus","It's a Wonderful Life"]},
  {title:"The criminal mind",tag:"mood",items:["Zodiac","The Silence of the Lambs","Chinatown","Capote","The Talented Mr. Ripley"]},
  {title:"The future",tag:"world",items:["RoboCop","Children of Men","The Matrix","Her","2001: A Space Odyssey"]},
  {title:"Rebels & outsiders",tag:"mood",items:["One Flew Over the Cuckoo's Nest","Badlands","Taxi Driver","American Psycho"]},
  {title:"America, the beautiful",tag:"director",items:["Network","No Country for Old Men","A History of Violence","Days of Heaven","Monster"]},
  {title:"Darkly funny",tag:"mood",items:["The Big Lebowski","Dr. Strangelove","American Psycho","The Truman Show"]}
];

const allCollections = ["Today","This week","This month","Roll the dice","New","See before you die","Diamonds in the rough","Epics","Epiphanies","Friday night","Sunday afternoon","The criminal mind","Cops & robbers","Spies","Whodunnits","The future","The western canon","Superheroes","Revolutions","America the great","This is Amerika","Childhood","Young love","Rebellion","Madness","Love & marriage","Family","Old age & death","Funny","Sexy","Creepy","Scary","Painful","Slow","Sports","Music","Art","Writing","Science","History","Adapted plays","Adapted books","Remakes","Shakespeare","Musicals","Master docs","War docs","Essay docs","Visual symphony","Stand up","Concert films","Essential 2010s","Essential 2000s","Essential 1990s","Essential 1980s","Essential 1970s","Oscar winners","Best director","Palme d'Or","Hitchcock","Kubrick","Wilder","Welles","Lean","Malick","Coppola","Spielberg","Scorsese","Lynch","Lee","Tarantino","PTA","Nolan","Fincher","Coen Brothers","Kurosawa","Bergman","Fellini","Varda","France","Italy","Spain","Germany","Russia","India","Iran","Japan","Korea","Mexico"];

const byTitle = Object.fromEntries(films.map(f=>[f.title,f]));
const catalogue = document.querySelector('#catalogue');
const overlay = document.querySelector('#overlay');
const filmSheet = document.querySelector('#filmSheet');
const sheetContent = document.querySelector('#sheetContent');
const searchPanel = document.querySelector('#searchPanel');
const drawer = document.querySelector('#collectionDrawer');
const collectionSheet = document.querySelector('#collectionSheet');
const toast = document.querySelector('#toast');
let activeTag = 'all';
let currentView = 'home';
let saved = new Set(JSON.parse(localStorage.getItem('ark-saved') || '[]'));

function safe(text){const d=document.createElement('div');d.textContent=text;return d.innerHTML}
function filmCard(film,index){
  return `<article class="film-card-wrap"><button class="film-card" data-open="${safe(film.title)}"><div class="poster-wrap"><img src="${film.image}" alt="${safe(film.title)} poster" loading="lazy"><span class="poster-number">${String(index+1).padStart(2,'0')}</span></div><h3>${safe(film.title)}</h3><p>${safe(film.collection)}</p></button><button class="save-mini ${saved.has(film.title)?'is-saved':''}" data-save="${safe(film.title)}" aria-label="${saved.has(film.title)?'Remove from':'Save'} ${safe(film.title)}">${saved.has(film.title)?'●':'＋'}</button></article>`
}
function renderRows(){
  const visibleRows=rows.filter(row=>activeTag==='all'||row.tag===activeTag);
  catalogue.innerHTML=visibleRows.map((row,rowIndex)=>`<section class="film-row" data-section="${row.tag}"><div class="row-head"><h2>${safe(row.title)}</h2><button data-row="${safe(row.title)}">${String(row.items.length).padStart(2,'0')} films</button></div><div class="rail">${row.items.map((title,i)=>filmCard(byTitle[title],i)).join('')}</div>${rowIndex<visibleRows.length-1?'<div class="row-marker"></div>':''}</section>`).join('');
  bindCards();
}
function renderSaved(){
  const items=films.filter(f=>saved.has(f.title));
  document.querySelector('.editorial-pick').classList.add('is-hidden');
  document.querySelector('.quick-filter').classList.add('is-hidden');
  document.querySelector('.all-collections').classList.add('is-hidden');
  catalogue.innerHTML=items.length?`<section class="film-row"><div class="row-head"><h2>Your saved films</h2><button>${items.length} films</button></div><div class="rail">${items.map((f,i)=>filmCard(f,i)).join('')}</div></section>`:`<section class="empty-state"><p class="kicker">Your shelf</p><h2>Nothing saved.<br><em>Yet.</em></h2><p>Tap the plus on any film to keep it here for later.</p></section>`;
  bindCards();
}
function bindCards(){
  document.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>openFilm(el.dataset.open));
  document.querySelectorAll('[data-save]').forEach(el=>el.onclick=e=>{e.stopPropagation();toggleSave(el.dataset.save)});
}
function toggleSave(title){
  if(saved.has(title)){saved.delete(title);showToast('Removed from your shelf')}else{saved.add(title);showToast('Saved to your shelf')}
  localStorage.setItem('ark-saved',JSON.stringify([...saved]));
  if(currentView==='saved')renderSaved();else renderRows();
  if(filmSheet.classList.contains('is-open'))openFilm(title);
}
function openFilm(title){
  const f=byTitle[title];if(!f)return;
  sheetContent.innerHTML=`<div class="sheet-film"><img src="${f.image}" alt="${safe(f.title)} poster"><div class="sheet-film-info"><p class="micro">ARK SELECTS · ${safe(f.collection)}</p><h2>${safe(f.title)}</h2><p>${safe(f.note)}</p><button class="save-button ${saved.has(title)?'is-saved':''}" data-sheet-save>${saved.has(title)?'Saved — remove':'Save for later'}</button></div></div>`;
  sheetContent.querySelector('[data-sheet-save]').onclick=()=>toggleSave(title);
  openLayer(filmSheet);
}
function openLayer(el){closeLayers();overlay.hidden=false;el.classList.add('is-open');el.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function closeLayers(){[drawer,searchPanel,filmSheet,collectionSheet].forEach(el=>{el.classList.remove('is-open');el.setAttribute('aria-hidden','true')});overlay.hidden=true;document.body.style.overflow='';document.querySelector('#menuButton').setAttribute('aria-expanded','false')}
function showToast(message){toast.textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),1800)}
function setView(view){
  currentView=view;activeTag='all';closeLayers();
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('is-active',b.dataset.view===view));
  document.querySelectorAll('.chip').forEach((b,i)=>b.classList.toggle('is-active',i===0));
  const hero=document.querySelector('.hero'),pick=document.querySelector('.editorial-pick'),filters=document.querySelector('.quick-filter'),all=document.querySelector('.all-collections');
  hero.classList.toggle('is-hidden',view!=='home');
  if(view==='saved'){renderSaved()}else{
    filters.classList.remove('is-hidden');pick.classList.toggle('is-hidden',view==='discover');all.classList.remove('is-hidden');renderRows();
    if(view==='discover')document.querySelector('#catalogue').scrollIntoView({behavior:'smooth',block:'start'});else window.scrollTo({top:0,behavior:'smooth'});
  }
}
function showSearchResults(query){
  const q=query.trim().toLowerCase();const host=document.querySelector('#searchResults');
  if(!q){host.innerHTML='<p>Try “future”, “criminal” or “love”.</p>';return}
  const matches=films.filter(f=>(f.title+' '+f.collection+' '+f.note).toLowerCase().includes(q));
  host.innerHTML=matches.length?matches.map(f=>`<button class="search-result" data-result="${safe(f.title)}"><img src="${f.image}" alt=""><span><b>${safe(f.title)}</b><small>${safe(f.collection)}</small></span></button>`).join(''):'<p>No match in this edition.</p>';
  host.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>openFilm(b.dataset.result));
}

renderRows();
document.querySelector('#collectionCloud').innerHTML=allCollections.map(c=>`<button>${safe(c)}</button>`).join('');
document.querySelectorAll('.collection-cloud button').forEach(b=>b.onclick=()=>{closeLayers();showToast('Collection preview: '+b.textContent)});
document.querySelector('#menuButton').onclick=()=>{openLayer(drawer);document.querySelector('#menuButton').setAttribute('aria-expanded','true')};
document.querySelector('#searchButton').onclick=()=>{openLayer(searchPanel);setTimeout(()=>document.querySelector('#searchInput').focus(),100)};
document.querySelector('#allCollectionsButton').onclick=()=>openLayer(collectionSheet);
document.querySelector('#searchInput').oninput=e=>showSearchResults(e.target.value);
document.querySelector('#diceButton').onclick=()=>openFilm(films[Math.floor(Math.random()*films.length)].title);
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeLayers);overlay.onclick=closeLayers;
document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.querySelectorAll('[data-drawer-view]').forEach(b=>b.onclick=()=>setView(b.dataset.drawerView));
document.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{activeTag=b.dataset.filter;document.querySelectorAll('.chip').forEach(x=>x.classList.toggle('is-active',x===b));renderRows();document.querySelector('#catalogue').scrollIntoView({behavior:'smooth',block:'start'})});
window.addEventListener('scroll',()=>document.querySelector('#topbar').classList.toggle('scrolled',scrollY>24),{passive:true});
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeLayers();if(e.key==='/'&&!/input/i.test(document.activeElement.tagName)){e.preventDefault();document.querySelector('#searchButton').click()}});
