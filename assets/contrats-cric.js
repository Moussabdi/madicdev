(()=>{'use strict';const $=id=>document.getElementById(id),form=$('contractForm'),status=$('contractStatus'),f=form.elements;const params=new URLSearchParams(location.search);let clients=[],dossiers=[],spaceId='',selectionVersion=0;let initialTariff=null;const db=window.getMadicSupabase?.();const isInitial=document.body.dataset.contractKind==='initial';
// Logos personnalisables, séparés par espace CRIC et conservés dans ce navigateur.
const logoSlots=[{key:'cric',input:'contractLogoCric',image:'contractLogoCricPreview',reset:'contractLogoCricReset'},{key:'professional',input:'contractLogoProfessional',image:'contractLogoProfessionalPreview',reset:'contractLogoProfessionalReset'}];
const logoDefaults={};
function logoStorageKey(slot){return 'madic:contract-logo:'+spaceId+':'+slot.key}
function logoNotice(text,bad=false){const el=$('contractLogoStatus');if(el){el.textContent=text;el.style.color=bad?'#b42318':''}}
function syncProfessionalPageLogos(){for(const [id,cls] of [['contractLogoCricPreview','.madic-logo-cric-repeat'],['contractLogoProfessionalPreview','.madic-logo-professional-repeat']]){const src=$(id)?.getAttribute('src')||'';document.querySelectorAll(cls).forEach(img=>{if(src)img.src=src;else img.removeAttribute('src')});}}
function applyLogo(slot,data){const image=$(slot.image);if(image){const src=data||logoDefaults[slot.key];if(src)image.src=src;else image.removeAttribute('src');syncProfessionalPageLogos()}}
function setupLogos(){
 for(const slot of logoSlots){
  const image=$(slot.image),input=$(slot.input),reset=$(slot.reset);if(!image||!input||!reset)continue;
  logoDefaults[slot.key]=slot.key==='professional'?'':image.getAttribute('src');
  try{applyLogo(slot,slot.key==='professional'?null:localStorage.getItem(logoStorageKey(slot)))}catch(e){logoNotice('Stockage local indisponible : les logos ne seront pas conservés.',true)}
  input.addEventListener('change',()=>{if(slot.key==='professional'){input.value='';logoNotice('Modifiez le logo dans Mon profil professionnel.');return;}const file=input.files?.[0];if(!file)return;
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)){logoNotice('Format non pris en charge : utilisez PNG, JPG ou WEBP.',true);input.value='';return}
   if(file.size>1024*1024){logoNotice('Image trop volumineuse : maximum 1 Mo par logo.',true);input.value='';return}
   const reader=new FileReader();reader.onerror=()=>logoNotice('Impossible de lire cette image.',true);reader.onload=()=>{
    const data=reader.result;try{localStorage.setItem(logoStorageKey(slot),data);applyLogo(slot,data);if(slot.key==='professional')logoReady=true;logoNotice('Logo mis à jour et conservé sur ce navigateur pour cet espace CRIC.')}catch(e){logoNotice('Espace de stockage insuffisant : choisissez une image plus légère.',true)}
   };reader.readAsDataURL(file);
  });
  reset.addEventListener('click',()=>{if(slot.key==='professional'){logoNotice('Le logo du cabinet se modifie dans Mon profil professionnel.');return;}try{localStorage.removeItem(logoStorageKey(slot))}catch(e){};applyLogo(slot,null);if(slot.key==='professional')logoReady=false;input.value='';logoNotice('Logo par défaut rétabli pour cet espace CRIC.')});
 }
}

// Identité et coordonnées synchronisées avec le profil professionnel Supabase.
const professionalKeys=['proNom','proNumero','proEntreprise','proAdresse','proTelephone','proCourriel','proSite','proPaiement'];
let profileRecord=null, officialIdentity=null, professionalVerified=false, logoReady=false;
let saveTimer=null, saveInProgress=false, lastSavedFields='';
const profileFields={proEntreprise:'business_name',proTelephone:'phone',proSite:'website_url'};
 function professionalCity(){return String(profileRecord?.address_city||'').trim()}
 function signatureCity(){return String($('cricSignatureCity')?.value||'').trim()}
function validValue(v){const s=String(v||'').trim();return s&&!/^[,;./\\\s-]+$/.test(s)&&!/^à compléter$/i.test(s)}
function setupProfessional(){
 for(const key of professionalKeys){if(f[key])f[key].readOnly=key==='proNom'||key==='proNumero'||key==='proCourriel'||key==='proPaiement'}
 for(const key of Object.keys(profileFields)){
  f[key]?.addEventListener('input',()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveProfessional().catch(e=>message('Enregistrement du profil impossible : '+e.message)),850)});
  f[key]?.addEventListener('change',()=>{clearTimeout(saveTimer);saveProfessional().catch(e=>message('Enregistrement du profil impossible : '+e.message))});
 }
}
async function saveProfessional(){
 if(!profileRecord||!spaceId||saveInProgress)return;
 const record={};for(const [key,column] of Object.entries(profileFields))record[column]=f[key]?.value.trim()||null;
 if(record.website_url){let url;try{url=new URL(record.website_url)}catch{throw Error('Le site Web doit être une URL HTTPS valide.')}if(url.protocol!=='https:'||!url.hostname||url.username||url.password)throw Error('Le site Web doit être une URL HTTPS valide.')}
 const serialized=JSON.stringify(record);if(serialized===lastSavedFields)return;
 saveInProgress=true;
 try{
  const {data,error}=await db.from('madic_cric_professional_profiles').update(record).eq('space_id',spaceId).select('space_id').maybeSingle();
  if(error)throw error;if(!data)throw Error('Profil professionnel introuvable ou modification non autorisée.');
  lastSavedFields=serialized;logoNotice('Coordonnées du cabinet enregistrées dans votre profil professionnel.');
 }finally{saveInProgress=false;}
 // Une modification pendant l'enregistrement doit également être sauvegardée.
 const current={};for(const [key,column] of Object.entries(profileFields))current[column]=f[key]?.value.trim()||null;
 if(JSON.stringify(current)!==lastSavedFields){clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveProfessional().catch(e=>message('Enregistrement du profil impossible : '+e.message)),500)}
}
async function loadOfficialIdentity(uid){
 const {data:application,error:ae}=await db.from('madic_cric_applications').select('full_name,license_number,professional_email,status').eq('user_id',uid).maybeSingle();
 if(ae)throw ae;if(!application||application.status!=='approved')throw Error('Inscription CRIC approuvée introuvable.');
 const {data:profile,error:pe}=await db.from('madic_cric_professional_profiles').select('*').eq('space_id',spaceId).maybeSingle();
 if(pe)throw pe;if(!profile)throw Error('Profil professionnel introuvable. Complétez votre profil professionnel avant de créer un contrat.');
 profileRecord=profile;
 const name=String(application.full_name||[profile.first_name,profile.last_name].filter(Boolean).join(' ')).trim();
 const number=String(application.license_number||profile.license_number||'').trim();
 const email=String(application.professional_email||'').trim();
 const values={proNom:name,proNumero:number,proCourriel:email,proEntreprise:profile.business_name||'',proAdresse:profile.business_address||'',proTelephone:profile.phone||'',proSite:profile.website_url||'',proPaiement:profile.payment_details||''};
 for(const [key,value] of Object.entries(values))if(f[key])f[key].value=value;
 const current={};for(const [key,column] of Object.entries(profileFields))current[column]=f[key]?.value.trim()||null;lastSavedFields=JSON.stringify(current);
 officialIdentity={name,number,uid,spaceId};professionalVerified=Boolean(name&&number&&email);const signatureInput=$('cricSignatureName');if(signatureInput){signatureInput.value=name;signatureInput.readOnly=true;}
 const header=document.querySelector('.intro .eyebrow');if(header)header.textContent=`${profile.business_name||'Cabinet CRIC'} · CRIC ${number||'À compléter'}`;
 const image=$('contractLogoProfessionalPreview');
 if(image){image.removeAttribute('src');logoReady=false;
  if(profile.logo_path){const {data,error}=await db.storage.from('madic-cric-branding').download(profile.logo_path);
   if(error)logoNotice('Logo professionnel inaccessible : '+error.message,true);
   else if(data){const reader=new FileReader();const dataUrl=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Lecture du logo impossible'));reader.readAsDataURL(data)});image.src=dataUrl;logoReady=true;syncProfessionalPageLogos();}
  }
 }
 preview();
}
function verifyIdentity(){
 if(!professionalVerified||!officialIdentity||officialIdentity.spaceId!==spaceId)throw Error('Identité CRIC non vérifiée.');
 if(f.proNom?.value.trim()!==officialIdentity.name||f.proNumero?.value.trim()!==officialIdentity.number)throw Error('Identité CRIC modifiée : rechargez la page.');
 for(const key of ['proEntreprise','proAdresse','proTelephone','proCourriel','proPaiement'])if(!validValue(f[key]?.value))throw Error('Coordonnées professionnelles incomplètes : '+key);
 if(!logoReady)throw Error('Logo professionnel non chargé. Vérifiez le profil CRIC.');
}
async function embedLogo(image){
  const src=image?.getAttribute('src')||'';
  if(!src)return '';
  if(src.startsWith('data:image/'))return src;
  const absolute=new URL(src,document.baseURI).href;
  const response=await fetch(absolute,{credentials:'same-origin'});
  if(!response.ok)throw Error('Logo inaccessible : '+absolute);
  const blob=await response.blob();
  if(!['image/png','image/jpeg','image/webp','image/svg+xml'].includes(blob.type))throw Error('Format de logo non reconnu.');
  return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Impossible de convertir le logo.'));reader.readAsDataURL(blob)});
}
function consultantSignature(){
  const typed=$('cricSignatureName')?.value.trim()||'';
  const accepted=$('cricSignatureConsent')?.checked===true;
  if(!accepted||!officialIdentity?.name||typed!==officialIdentity.name)throw Error('Veuillez confirmer votre signature avant de transmettre le contrat.');
  return {name:officialIdentity.name,license_number:officialIdentity.number,accepted:true,signed_at:new Date().toISOString(),city:signatureCity()};
}
// Le fuseau doit etre configure explicitement dans le profil; a defaut, utiliser celui du navigateur du CRIC.
function consultantTimeZone(){
  const candidate=profileRecord?.timezone||profileRecord?.time_zone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  try{new Intl.DateTimeFormat('fr-CA',{timeZone:candidate});return candidate}catch{return 'UTC'}
}
function showConsultantSignature(doc,signature){
  const target=doc.querySelector('#cricSignatureOnDocument');
  if(!target)throw Error('Emplacement de signature du CRIC introuvable.');
  target.textContent=signature.name;
  target.style.cssText='font-family:cursive;font-size:17px;font-weight:600;white-space:normal;overflow-wrap:anywhere';
  const stamp=doc.querySelector('#cricSignatureTimestamp');
  if(stamp)stamp.textContent='Signature électronique du consultant · '+(signature.city?signature.city+' · ':'')+new Intl.DateTimeFormat('fr-CA',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:consultantTimeZone(),timeZoneName:'short'}).format(new Date(signature.signed_at));
}


let publishedSignature=null; // Affichage local uniquement; la preuve officielle reste dans Supabase.
// Afficher la signature dans l'aperçu sans enregistrer une signature avant publication.
function updateConsultantSignaturePreview(){
  if(document.body.dataset.contractKind!=='initial')return;
  const target=$('cricSignatureOnDocument'),stamp=$('cricSignatureTimestamp');
  if(!target)return;
  if(publishedSignature){showConsultantSignature(document,publishedSignature);return;}
  const typed=$('cricSignatureName')?.value.trim()||'';
  const accepted=$('cricSignatureConsent')?.checked===true;
  const valid=Boolean(officialIdentity?.name&&typed===officialIdentity.name&&accepted);
  target.textContent=valid?officialIdentity.name:'';
  if(valid){
    target.style.fontFamily='cursive';
    target.style.fontSize='17px';
    target.style.fontWeight='600';
    target.style.whiteSpace='normal';
    target.style.overflowWrap='anywhere';
  }else{
    target.removeAttribute('style');
  }
  if(stamp)stamp.textContent=valid?'Signature électronique du consultant (aperçu, non encore publiée)':'';
}

  let existingContract=null,existingCheckVersion=0,existingCheckFailed=false,existingCheckPending=false;
  function updateContractActions(){
   const btn=$('contractActivate'),notice=$('contractExistingNotice'),signature=document.querySelector('.madic-cric-signature');
   const existing=Boolean(existingContract),blocked=existingCheckFailed||existingCheckPending;
   btn.disabled=blocked;
   btn.textContent=existing?'Signer et transmettre une nouvelle version':'Signer et transmettre au client';
   if(signature)signature.hidden=false;
   for(const id of ['contractPreview','contractPrint']){const el=$(id);if(el)el.hidden=false;}
   if(notice){
    notice.textContent='';
    if(existing)notice.textContent='Une version précédente existe et restera conservée. Vous pouvez publier une nouvelle version.';
    else if(existingCheckFailed)notice.textContent='Impossible de vérifier les contrats existants. La transmission est temporairement bloquée.';
   }
  }
  async function checkExistingInitialContract(){
   const version=++existingCheckVersion,clientId=$('contractClient').value,dossierId=$('contractDossier').value;
   existingContract=null;existingCheckFailed=false;existingCheckPending=Boolean(clientId&&dossierId);
   updateContractActions();
   if(!clientId||!dossierId)return;
   try{
    const {data,error}=await db.from('madic_initial_contracts').select('id,status,created_at').eq('space_id',spaceId).eq('client_id',clientId).eq('dossier_id',dossierId).in('status',['publie','signe']).order('created_at',{ascending:false}).limit(1);
    if(version!==existingCheckVersion)return;
    if(error)throw error;
    existingContract=data?.[0]||null;
   }catch(error){
    if(version!==existingCheckVersion)return;
    existingCheckFailed=true;
    console.error('Vérification du contrat initial :',error);
   }finally{
    if(version===existingCheckVersion){existingCheckPending=false;updateContractActions();}
   }
  }
  function openExistingInitialContract(){
   if(!existingContract?.id)return;
   window.open('contrat-initial-client.html?id='+encodeURIComponent(existingContract.id),'_blank','noopener');
  }
function formatTarifLettres(value){
 const n=Number(value);if(!Number.isFinite(n)||n<0||value==='')return 'À convenir';
 const words={0:'zéro',1:'un',2:'deux',3:'trois',4:'quatre',5:'cinq',6:'six',7:'sept',8:'huit',9:'neuf',10:'dix',11:'onze',12:'douze',13:'treize',14:'quatorze',15:'quinze',16:'seize',20:'vingt',30:'trente',40:'quarante',50:'cinquante',60:'soixante'};
 const under100=x=>{if(words[x])return words[x];if(x<20)return 'dix-'+words[x-10];if(x<70){const d=Math.floor(x/10)*10,r=x%10;return words[d]+(r===1?' et ': '-')+words[r]}if(x<80)return 'soixante-'+under100(x-60);return 'quatre-vingt'+(x===80?'s':'-'+under100(x-80))};
 const integer=x=>{if(x<100)return under100(x);if(x<1000){const h=Math.floor(x/100),r=x%100;return (h===1?'cent':words[h]+' cent')+(r?' '+under100(r):(h>1?'s':''))}if(x<1000000){const t=Math.floor(x/1000),r=x%1000;return (t===1?'mille':integer(t)+' mille')+(r?' '+integer(r):'')}return String(x)};
 const amount=n.toLocaleString('fr-CA',{maximumFractionDigits:2,minimumFractionDigits:Number.isInteger(n)?0:2});
 const cents=Math.round((n-Math.floor(n))*100);return integer(Math.floor(n))+(cents?' et '+integer(cents)+' cents':'')+' ('+amount+' $ CA)';
}

function updateInitialTariffDisplay(){
 if(!isInitial)return;
 const field=$('madicInitialTariffDisplay');
 if(field)field.value=initialTariff?.label||'Aucune formule enregistrée : publication bloquée';
 const title=$('madicInitialContractTitle');
 if(title)title.textContent=initialTariff?.type==='forfaitaire'?'CONTRAT DE CONSULTATION INITIALE À TAUX FORFAITAIRE':initialTariff?.type==='horaire'?'CONTRAT DE CONSULTATION INITIALE À TAUX HORAIRE':'Contrat de consultation initiale';
 if(f.tarif)f.tarif.value=initialTariff?String(initialTariff.amount):'';
}
function updateSource(){
 updateInitialTariffDisplay();
 const values={};for(const key of professionalKeys)values[key]=f[key]?.value?.trim()||(key==='proSite'?'':'À compléter');
 Object.assign(values,{clientNom:[f.prenom.value,f.nom.value].filter(Boolean).join(' ')||'À compléter',date:f.date.value||'À compléter',naissance:f.naissance.value||'À compléter',adresse:f.adresse.value||'À compléter',lieu:f.lieu.value||'À compléter',proLieu:signatureCity()||'À compléter',telephone:f.telephone.value||'À compléter',courriel:f.courriel.value||'À compléter',objet:f.objet.value?.trim()||'À compléter',tarif:f.tarif.value||'À convenir',nom:f.nom.value?.trim()||'À compléter',prenom:f.prenom.value?.trim()||'À compléter',tarifLettres:isInitial&&initialTariff?initialTariff.label:formatTarifLettres(f.tarif.value)});
 for(const node of document.querySelectorAll('[data-contract-template]'))node.textContent=node.dataset.contractTemplate.replace(/\{([a-zA-Z]+)\}/g,(_,key)=>values[key]??'À compléter');
}

async function loadIntake(clientId,profile){return window.MADIC_CONTRAT_PREFILL.load(db,clientId,profile)};
function message(s){status.textContent=s}function option(sel,id,label){const o=new Option(label,id);sel.add(o)}function clientName(c){return [c.first_name,c.last_name].filter(Boolean).join(' ')||c.email||'Client'}async function chooseClient(){
  publishedSignature=null;
  if(isInitial)initialTariff=null;
 const version=++selectionVersion;
 const select=$('contractClient'), dossierSelect=$('contractDossier');
 const c=clients.find(x=>String(x.id)===select.value);
 dossierSelect.replaceChildren(new Option('Sélectionner un dossier',''));
 for(const d of dossiers.filter(x=>x.client_id===c?.id))option(dossierSelect,d.id,`${d.reference}-${d.category||''}`);
 const keys=['nom','prenom','courriel','telephone','adresse','naissance','lieu',...(isInitial?['objet']:[])];
 for(const key of keys)if(f.namedItem(key))f.namedItem(key).value='';
 if(!c){initialTariff=null;preview();return;}
 // Afficher les informations du profil immédiatement, sans attendre la requête du formulaire préliminaire.
 const profileValues=window.MADIC_CONTRAT_PREFILL?.from?.({},c)||{
  nom:c.last_name||c.nom||'',prenom:c.first_name||c.prenom||'',courriel:c.email||'',telephone:c.phone||''
 };
 const applyValues=(values)=>{
  if(version!==selectionVersion)return;
  for(const key of keys){const input=f.namedItem(key),value=values?.[key];if(input&&value!==undefined&&value!==null&&String(value).trim())input.value=String(value).trim();}
  preview();
 };
 applyValues(profileValues);
 message('Profil du client chargé. Recherche des renseignements du formulaire préliminaire…');
 try{
  const result=await loadIntake(c.id,c);
  if(version!==selectionVersion)return;
  applyValues(result.values);
  if(isInitial){
    try{
      if(typeof window.MADIC_CONTRAT_PREFILL?.loadTariff !== 'function')throw Error('Module de tarification indisponible.');
      initialTariff=await window.MADIC_CONTRAT_PREFILL.loadTariff(db,c.id);
      if(version!==selectionVersion)return;
      if(!initialTariff)message('Aucune formule de consultation enregistrée pour ce client. Le contrat ne peut pas être publié.');
    }catch(tariffError){
      if(version!==selectionVersion)return;
      initialTariff=null;
      message('Formule tarifaire inaccessible : '+(tariffError?.message||tariffError));
    }
    preview();
  }
  if(result.error)message('Profil chargé; formulaire préliminaire non accessible : '+result.error);
  else if(!result.intake)message('Profil du client chargé. Aucun formulaire préliminaire accessible; complétez les champs manquants.');
  else message('Profil et formulaire préliminaire chargés. Vérifiez les renseignements avant signature.');
 }catch(error){
  if(version!==selectionVersion)return;
  message('Profil chargé, mais lecture du formulaire préliminaire impossible : '+(error?.message||error));
 }
 if(params.get('dossier')&&dossiers.some(d=>d.id===params.get('dossier')&&d.client_id===c.id))dossierSelect.value=params.get('dossier');
 preview();if(isInitial)await checkExistingInitialContract();
}
function updateInitialLetterhead(){
 if(document.body.dataset.contractKind!=='initial')return;
 const val=(key)=>f[key]?.value?.trim()||'À compléter';
 const set=(id,value)=>{const node=$(id);if(node)node.textContent=value};
 set('letterheadConsultant',val('proNom')+', CRIC '+val('proNumero'));
 set('letterheadAddress',val('proAdresse'));
 set('letterheadPhone','Tél. : '+val('proTelephone'));
 set('letterheadEmail','Courriel : '+val('proCourriel'));
 set('letterheadWebsite',f.proSite?.value?.trim()||'');
 set('letterheadCity',signatureCity()||'Ville de signature');
 const raw=f.date?.value||'';
 let date=raw||'À compléter';
 if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){
  const [year,month,day]=raw.split('-').map(Number);
  const names=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  date=`${String(day).padStart(2,'0')}-${names[month-1]}-${year}`;
 }
 set('letterheadDate',date);
}
function preview(){const d=dossiers.find(x=>x.id===$('contractDossier').value);const fields=[['Client',[f.prenom.value,f.nom.value].filter(Boolean).join(' ')],['Courriel',f.courriel.value],['Téléphone',f.telephone.value],['Adresse',f.adresse.value],['Date de naissance',f.naissance.value],['Date du contrat',f.date.value],['Lieu',f.lieu.value],['Dossier',d?.reference||''],['Objet',f.objet.value],['Honoraires',f.tarif.value?f.tarif.value+' '+(isInitial&&initialTariff?.currency==='USD'?'$ US':'$ CA')+(isInitial&&initialTariff?.type==='horaire'?' / heure':''):'À convenir']];if(f.avance)fields.push(['Avance',f.avance.value?f.avance.value+' $ CA':'À convenir']);if(f.langue)fields.push(['Langue des services',f.langue.value]);if(f.conseils)fields.push(['Conseils préliminaires',f.conseils.value]);if(document.body.dataset.contractKind==='initial'){updateInitialLetterhead();updateSource();updateConsultantSignaturePreview();return}updateConsultantSignaturePreview();const target=$('contractFilled');if(!target){updateSource();return}target.replaceChildren();for(const [k,v] of fields){const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=k+' : ';p.append(strong,document.createTextNode(v||'À compléter'));target.append(p)}if(document.body.dataset.contractKind==='initial')updateSource()}
// Controle de completude : aucune version contenant « A completer » ne peut etre publiee.
const fieldLabels={client_id:'Client associe',dossier_id:'Dossier',nom:'Nom du client',prenom:'Prenom du client',courriel:'Courriel du client',telephone:'Telephone du client',adresse:'Adresse de residence',naissance:'Date de naissance',date:'Date du contrat',lieu:'Lieu de signature',objet:isInitial?'Objet de la consultation':'Objet du mandat',proNom:'Nom du consultant',proNumero:'Numero CRIC',proEntreprise:'Entreprise / cabinet',proAdresse:'Adresse professionnelle',proTelephone:'Telephone professionnel',proCourriel:'Courriel professionnel',proSite:'Site Web professionnel',proPaiement:'Coordonnees de paiement',cricSignatureCity:'Lieu de signature du consultant',tarif:'Honoraires convenus',avance:'Avance convenue',conseils:'Résumé des conseils préliminaires',registreQuebec:'Permis du registre québécois',phase1:'Honoraires – phase 1',phase2:'Honoraires – phase 2',phase3:'Honoraires – phase 3',fraisBio:'Frais biométriques',fraisPermis:'Frais permis d’études'};
let reminderDismissed=false;
function missingContractFields(){
 const required=['client_id','dossier_id','nom','prenom','courriel','telephone','adresse','naissance','date','lieu','objet','proNom','proNumero','proEntreprise','proAdresse','proTelephone','proCourriel','proSite','proPaiement'];
 const missing=required.filter(k=>{const input=k==='client_id'?$('contractClient'):k==='dossier_id'?$('contractDossier'):f.namedItem(k);return !validValue(input?.value)});
 if(isInitial&&!initialTariff)missing.push('tarif');
  if(!isInitial){for(const key of ['tarif','avance','conseils',...Array.from({length:Number($('madicPhaseCount')?.value||2)},(_,i)=>'phase'+(i+1)),'fraisBio','fraisPermis'])if(!validValue(f.namedItem(key)?.value))missing.push(key);for(let i=1;i<=Number($('madicPhaseCount')?.value||1);i++){for(const key of ['phaseTitre'+i,'phaseDeclencheur'+i])if(!validValue(f.namedItem(key)?.value))missing.push(key);}}
 return missing;
}
function ensureGuide(){
 let overlay=$('madicCompletionOverlay');if(overlay)return overlay;
 const style=document.createElement('style');style.textContent=`#madicCompletionOverlay{position:fixed;inset:0;z-index:99999;background:rgba(4,16,30,.78);display:flex;align-items:center;justify-content:center;padding:16px}#madicCompletionOverlay[hidden]{display:none}#madicCompletionDialog{width:min(620px,100%);max-height:88vh;overflow:auto;background:#fff;color:#14253a;border-radius:14px;padding:25px;box-shadow:0 18px 70px #0007}#madicCompletionDialog h2{margin:0 0 12px;color:#14253a}#madicCompletionDialog p{line-height:1.5}#madicCompletionList{display:grid;gap:7px;margin:14px 0}#madicCompletionList button{width:100%;padding:10px 12px;text-align:left;border:1px solid #bfd5e0;border-radius:8px;background:#f1f8fb;color:#123b52;cursor:pointer}#madicCompletionClose{padding:11px 17px;border:0;border-radius:8px;background:#176c85;color:white;cursor:pointer}@media print{#madicCompletionOverlay{display:none!important}body.madic-incomplete-print #contractDocument{display:none!important}body.madic-incomplete-print:after{content:'IMPRESSION BLOQUEE : CONTRAT INCOMPLET';display:block;font-size:24pt;color:#000}}`;
 document.head.append(style);
 overlay=document.createElement('div');overlay.id='madicCompletionOverlay';overlay.hidden=true;overlay.innerHTML='<section id="madicCompletionDialog" role="dialog" aria-modal="true" aria-labelledby="madicCompletionTitle"><h2 id="madicCompletionTitle">Renseignements à compléter</h2><p id="madicCompletionText"></p><div id="madicCompletionList"></div><button type="button" id="madicCompletionClose">Continuer la saisie</button></section>';
 document.body.append(overlay);
 $('madicCompletionClose').addEventListener('click',()=>{overlay.hidden=true;reminderDismissed=true});
 return overlay;
}
function showCompletionGuide(force=false){
 if(document.body.dataset.contractKind!=='initial')return true;
 preview();const missing=missingContractFields();
 const hasPlaceholder=($('contractDocument')?.textContent||'').includes('À compléter');
 const incomplete=missing.length>0||hasPlaceholder;
 document.body.classList.toggle('madic-incomplete-print',incomplete);
 if(!incomplete){const modal=$('madicCompletionOverlay');if(modal)modal.hidden=true;reminderDismissed=false;return true}
 if(!force&&reminderDismissed)return false;
 const modal=ensureGuide(),list=$('madicCompletionList');list.replaceChildren();
 $('madicCompletionText').textContent=`Veuillez compléter les ${missing.length} renseignement(s) ci-dessous avant de poursuivre.`;
 for(const key of missing){const btn=document.createElement('button');btn.type='button';btn.textContent='Compléter : '+(fieldLabels[key]||key);btn.addEventListener('click',()=>{modal.hidden=true;const input=key==='client_id'?$('contractClient'):key==='dossier_id'?$('contractDossier'):(key==='cricSignatureCity'?$('cricSignatureCity'):f.namedItem(key));input?.scrollIntoView({behavior:'smooth',block:'center'});if(!input?.readOnly)input?.focus();else message('Champ issu du profil CRIC : modifiez-le dans Mon profil professionnel, puis rechargez le contrat.');});list.append(btn)}
 if(hasPlaceholder&&!missing.length){const p=document.createElement('p');p.textContent='Le document contient encore « À compléter ». Verifiez les champs et les informations du profil CRIC.';list.append(p)}
 modal.hidden=false;$('madicCompletionClose').focus();return false;
}

async function activateInitialContract(){
 const btn=$('contractActivate'),notice=$('contractActivationStatus');
   await checkExistingInitialContract();
   if(existingCheckFailed){notice.textContent='Transmission bloquée : vérification indisponible.';return;}
  if(!showCompletionGuide(true)){notice.textContent='Complétez les renseignements indiqués pour transmettre le contrat.';return}
  clearTimeout(saveTimer);try{await saveProfessional()}catch(e){notice.textContent='Publication bloquée : profil non enregistré : '+e.message;return}
 try{verifyIdentity()}catch(e){notice.textContent='Publication bloquee : '+e.message;return}
 if(!form.reportValidity())return;
 let signature;try{signature=consultantSignature()}catch(e){notice.textContent=e.message;return}
 const clientId=$('contractClient').value,dossierId=$('contractDossier').value;
 if(!clientId||!dossierId){notice.textContent='Sélectionnez un client et un dossier avant la publication.';return}
 if(!confirm('Publier cette version du contrat dans l’espace du client ? Elle ne pourra plus être modifiée après activation.'))return;
 btn.disabled=true;notice.textContent='Publication en cours…';
 try{
  preview();
  const documentNode=$('contractDocument').cloneNode(true);
   showConsultantSignature(documentNode,signature);
  // Les logos enregistrés dans le navigateur sont intégrés à la version publiée.
  for(const id of ['contractLogoCricPreview','contractLogoProfessionalPreview']){
   const original=$(id),copy=documentNode.querySelector('#'+id);
   if(copy&&original)copy.setAttribute('src',await embedLogo(original));
  }
  const snapshot={html:documentNode.outerHTML,consultant:{name:f.proNom.value,number:f.proNumero.value},client:{first_name:f.prenom.value,last_name:f.nom.value,email:f.courriel.value},date:f.date.value,tariff:initialTariff,consultant_signature:signature};
  const {data,error}=await db.rpc('madic_activate_initial_contract',{p_space_id:spaceId,p_client_id:clientId,p_dossier_id:dossierId,p_snapshot:snapshot});
  if(error)throw error;
  publishedSignature=signature;
  showConsultantSignature(document,signature);
  notice.textContent='Nouvelle version publiée pour le client. Référence : '+data;await checkExistingInitialContract();
 }catch(e){notice.textContent=/Un contrat initial est deja publie ou signe pour ce dossier/i.test(e.message||'')?'Ce contrat est déjà transmis au client.':'Transmission impossible : '+(e.message||e)}finally{updateContractActions()}
}
window.addEventListener('beforeprint',()=>{{preview();document.body.classList.toggle('madic-incomplete-print',missingContractFields().length>0||($('contractDocument')?.textContent||'').includes('À compléter'))}});

// Tarifs gouvernementaux : source IRCC vérifiée par la fonction Supabase.
// Ne jamais remplacer une saisie manuelle ou un montant déjà présent.
let irccFeeRates=null;
const irccEdited=new Set();
function setupIrccFees(){
 if(isInitial)return;
 for(const key of ['fraisBio','fraisPermis']){
  f.namedItem(key)?.addEventListener('input',()=>irccEdited.add(key));
 }
 $('madicBioCategory')?.addEventListener('change',()=>applyIrccFees(true));
 loadIrccFees().catch(e=>irccNotice('Tarifs IRCC non vérifiés : '+(e?.message||e),true));
}
function irccNotice(text,error=false){const node=$('madicIrccStatus');if(node){node.textContent=text;node.dataset.error=String(error)}}
function applyIrccFees(categoryChanged=false){
 if(!irccFeeRates)return;
 const category=$('madicBioCategory')?.value||'personne';
 const rates={fraisBio:irccFeeRates.biometrie?.[category],fraisPermis:irccFeeRates.permisEtudes};
 for(const [key,amount] of Object.entries(rates)){
  const input=f.namedItem(key);
  if(!input||!Number.isFinite(amount)||amount<0)continue;
  if(irccEdited.has(key)||String(input.value).trim()){
   // Un changement explicite de catégorie remplace seulement le montant biométrique
   // déjà rempli automatiquement, jamais une valeur saisie manuellement.
   if(!(categoryChanged&&key==='fraisBio'&&!irccEdited.has(key)&&input.dataset.irccAuto==='true'))continue;
  }
  input.value=amount.toFixed(2);input.dataset.irccAuto='true';
  input.dispatchEvent(new Event('change',{bubbles:true}));
 }
}
async function loadIrccFees(){
 if(!db?.functions?.invoke)throw Error('Fonctions Supabase indisponibles.');
 const {data,error}=await db.functions.invoke('ircc-fees',{method:'GET'});
 if(error)throw error;
 if(!data||data.verified!==true||!Number.isFinite(data.permisEtudes)||!['personne','famille','groupe'].every(k=>Number.isFinite(data.biometrie?.[k])))throw Error('Réponse IRCC invalide.');
 irccFeeRates=data;
 applyIrccFees();
 irccNotice('Tarifs vérifiés auprès d’IRCC le '+new Date(data.checkedAt).toLocaleString('fr-CA')+'. Vérifiez la catégorie et les exemptions applicables.');
}

async function init(){if(!db){message('Configuration Supabase indisponible.');return}try{const {data:auth,error:ae}=await db.auth.getUser();if(ae||!auth?.user)throw Error('Connexion professionnelle requise.');const uid=auth.user.id;const {data:app,error:ap}=await db.from('madic_cric_applications').select('status').eq('user_id',uid).maybeSingle();if(ap||app?.status!=='approved')throw Error('Compte CRIC non approuvé.');const {data:spaces,error:se}=await db.from('madic_cric_spaces').select('id,access_status').eq('owner_user_id',uid).limit(1);if(se||!spaces?.length||spaces[0].access_status!=='active')throw Error('Espace professionnel indisponible.');spaceId=spaces[0].id;setupLogos();setupProfessional();setupIrccFees();const {data:allowed,error:pe}=await db.rpc('madic_can_manage_cric_space',{p_space_id:spaceId});if(pe||allowed!==true)throw Error('Accès non autorisé.');await loadOfficialIdentity(uid);const {data:associations,error:ce}=await db.from('madic_cric_clients').select('client_id').eq('space_id',spaceId);if(ce)throw ce;const ids=[...new Set((associations||[]).map(x=>x.client_id))];if(ids.length){const {data:profiles,error:pr}=await db.from('profiles').select('*').in('id',ids);if(pr)throw pr;clients=profiles||[]}const {data:ds,error:de}=await db.from('dossiers').select('id,client_id,reference,category').eq('space_id',spaceId);if(de)throw de;dossiers=(ds||[]).filter(x=>ids.includes(x.client_id));for(const c of clients)option($('contractClient'),c.id,clientName(c));$('contractClient').addEventListener('change',async()=>{await chooseClient();reminderDismissed=false});$('contractDossier').addEventListener('change',()=>{publishedSignature=null;preview();if(isInitial)checkExistingInitialContract().catch(e=>message('Vérification du contrat : '+e.message))});$('contractPreview').addEventListener('click',preview);form.addEventListener('input',()=>{publishedSignature=null;preview()});$('contractPrint').addEventListener('click',async()=>{if(!showCompletionGuide(true))return;clearTimeout(saveTimer);try{await saveProfessional()}catch(e){message('Impression bloquée : profil non enregistré : '+e.message);return}try{verifyIdentity()}catch(e){message('Impression bloquée : '+e.message);return}if(!form.reportValidity())return;preview();window.print()});$('cricSignatureCity')?.addEventListener('input',()=>{publishedSignature=null;preview()});$('cricSignatureConsent')?.addEventListener('change',()=>{publishedSignature=null;preview()});if(isInitial)$('contractActivate')?.addEventListener('click',activateInitialContract);f.date.value=new Date().toLocaleDateString('en-CA');if(params.get('client')&&clients.some(c=>c.id===params.get('client')))$('contractClient').value=params.get('client');await chooseClient();$('contractWorkspace').hidden=false;setTimeout(()=>showCompletionGuide(false),0)}catch(e){message('Accès impossible : '+(e.message||e))}}init()})();