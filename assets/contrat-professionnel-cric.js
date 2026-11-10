/* MADIC - Contrat professionnel : code consolide de la page. */
(function(){'use strict';
function loadScript(url){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(new Error('Chargement impossible : '+url));document.head.appendChild(s);});}
async function start(){try{
 await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
 await loadScript('assets/config.js');

/* Source actuelle : madic-contrat-prefill(20261110-051441).js */
/* MADIC - Renseignements issus du formulaire preliminaire, sans stockage local. */
window.MADIC_CONTRAT_PREFILL = (() => {
  const pick = (obj, keys) => {
    for (const key of keys) {
      const v = obj?.[key];
      if (v !== undefined && v !== null && String(v).trim())
        return String(v).trim();
    }
    return "";
  };
  const from = (answers = {}, profile = {}) => {
    const a = answers && typeof answers === "object" ? answers : {},
      p = profile || {};
    const field = (ak, pk) => pick(a, ak) || pick(p, pk);
    const directAddress = field(
      ["adresse", "adresse_complete", "address", "full_address"],
      ["address", "full_address"],
    );
    const street = [
      field(["no_rue", "numero_rue"], ["address_number"]),
      field(["rue", "nom_rue", "address_street"], ["address_street", "street"]),
    ]
      .filter(Boolean)
      .join(" ");
    const apartment = field(
      ["no_appart", "appartement"],
      ["address_apartment"],
    );
    const address = [
      apartment ? `App./unité ${apartment}` : "",
      street,
      field(["ville"], ["address_city"]),
      field(["province"], ["address_region"]),
      field(["code_postale"], ["address_postal_code"]),
      field(["pays"], ["country"]),
    ]
      .filter(Boolean)
      .join(", ");
    const temporary = field(["residence_temporaire"], []),
      permanent = field(["residence_permanente"], []);
    const project = [
      temporary !== "aucun" ? temporary : "",
      permanent !== "aucun" ? permanent : "",
    ]
      .filter(Boolean)
      .join(" / ")
      .replaceAll("_", " ");
    return {
      nom: field(["nom"], ["last_name", "nom", "family_name", "surname"]),
      prenom: field(["prenom"], ["first_name", "prenom", "given_name"]),
      courriel: field(["courriel", "email"], ["email", "courriel"]),
      telephone: field(
        ["telephone", "phone", "numero_telephone"],
        ["phone", "telephone"],
      ),
      naissance: field(
        ["date_naissance", "naissance", "birth_date"],
        ["date_of_birth", "birth_date", "dob"],
      ).slice(0, 10),
      adresse: directAddress || address,
      lieu:
        field(["lieu_signature", "ville_signature"], []) ||
        field(["ville"], ["address_city"]),
      objet: project,
    };
  };
  async function load(db, userId, profile = {}) {
    if (!userId)
      return {
        values: from({}, profile),
        intake: false,
        error: "Client non identifié",
      };
    const { data, error } = await db
      .from("madic_client_intake")
      .select("answers,status")
      .eq("user_id", userId)
      .maybeSingle();
    if (error)
      return { values: from({}, profile), intake: false, error: error.message };
    let answers = data?.answers || {};
    if (typeof answers === "string") {
      try {
        answers = JSON.parse(answers);
      } catch (_) {
        answers = {};
      }
    }
    if (Array.isArray(answers))
      answers = Object.fromEntries(
        answers.filter((x) => x && x.name).map((x) => [x.name, x.value]),
      );
    if (
      answers &&
      typeof answers === "object" &&
      answers.answers &&
      typeof answers.answers === "object"
    )
      answers = answers.answers;
    return {
      values: from(answers, profile),
      intake: !!data?.answers,
      submitted: data?.status === "submitted",
    };
  }
  async function loadTariff(db, userId) {
    const { data, error } = await db
      .from("madic_initial_service_requests")
      .select("service_type,tariff_code")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data?.service_type !== "consultation") return null;
    const options = {
      hourly: {
        amount: 159,
        label: "À taux horaire - 159 $ US/heure",
        type: "horaire",
      },
      single: {
        amount: 599,
        label: "À taux forfaitaire - Personne célibataire : 599 $ US",
        type: "forfaitaire",
      },
      couple: {
        amount: 749,
        label: "À taux forfaitaire - Couple : 749 $ US",
        type: "forfaitaire",
      },
    };
    return options[data.tariff_code]
      ? {
          code: data.tariff_code,
          ...options[data.tariff_code],
          currency: "USD",
        }
      : null;
  }
  return { load, from, loadTariff };
})();


/* Source actuelle : contrats-cric(20261110-051433).js */
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

/* Source actuelle : madic-mandats-cric(20261110-051426).js */
(() => {
  "use strict";
  const models = {
      etudes: [
        [
          "Phase 1 :",
          "Ouverture du dossier.",
          "Évaluation préliminaire de la situation personnelle et de l'admissibilité de la cliente.",
          "Collecte et examen des documents requis.",
          "Vérification des antécédents d'immigration, le cas échéant.",
          "Préparation de la liste de contrôle des documents.",
        ],
        [
          "Phase 2 :",
          "Vérification de l'admissibilité du programme d'études choisi.",
          "Vérification de la lettre d'acceptation de l'établissement d'enseignement désigné (EED).",
          "Vérification des exigences provinciales applicables.",
          "Vérification des preuves financières.",
          "Préparation du plan d'études.",
          "Préparation des observations écrites et lettres explicatives.",
        ],
        [
          "Phase 3 :",
          "Préparation des formulaires de la demande du permis d’étude.",
          "Soumission de la demande en ligne du permis d’étude en ligne.",
          "Valider et téléverser l’ensemble des documents.",
          "Suivi du dossier du permis d’étude auprès de l’IRCC, les autres services concernés et le client jusqu’à une décision soit prise.",
          "Expliquer la décision au client.",
        ],
      ],
      humanitaire: [
        [
          "Responsabilités et prestations du CRIC :",
          "Ouverture du dossier.",
          "Évaluation du dossier.",
          "Préparation des formulaires de la demande de considérations d’ordre humanitaire.",
          "Préparation du dossier et documents requis (document d’identités, preuves financières).",
          "Rédaction du rapport pour appuyer la demande du client.",
          "Soumission du dossier en ligne.",
          "Valider et téléverser l’ensemble des documents.",
          "Expliquer la décision du gouvernement du Québec.",
        ],
      ],
      famille: [
        [
          "Phase 1 :",
          "Ouverture officielle du dossier du client.",
          "Évaluation complète du dossier de parrainage du client (admissibilité du répondant et de la personne parrainée).",
          "Analyse de la relation conjugale et de la conformité déclarative.",
          "Préparation du dossier et des documents requis :",
          "Documents d’identité ;",
          "Preuves de la relation ;",
          "Preuves financières, le cas échéant.",
          "Remplissage, vérification et validation des formulaires fédéraux requis par IRCC.",
          "Rédaction, s’il y a lieu, d’une lettre explicative ou de soutien afin d’appuyer la demande.",
          "Soumission simultanée de la demande de parrainage et de la demande de résidence permanente au niveau fédéral, via le portail en ligne de l’IRCC.",
          "Réception et vérification de l’accusé de réception de l’IRCC.",
          "Suivi du dossier auprès de l’IRCC, des services concernés et du client jusqu’à ce qu’une décision soit rendue.",
          "Explication claire et détaillée des communications et décisions de l’IRCC au client.",
        ],
        [
          "Phase 2 :",
          "Information et accompagnement concernant les examens médicaux requis.",
          "Information et suivi relatifs à la collecte des données biométriques, le cas échéant.",
          "Préparation du client et de la personne parrainée à une entrevue, si exigée par l’IRCC.",
          "Validation et téléversement de tout document additionnel demandé par l’IRCC.",
          "Suivi continu du traitement du dossier auprès de l’IRCC jusqu’à la décision finale.",
          "Explication de la décision rendue par l’IRCC au client.",
        ],
        [
          "Phase 3 :",
          "Suivi du dépôt du visa de résidence permanente, lorsque la demande est approuvée.",
          "Accompagnement relatif à la confirmation de résidence permanente (CRP).",
          "Validation et transmission de toute instruction finale émise par l’IRCC.",
          "Suivi du dossier auprès de l’IRCC, des services concernés et du client jusqu’à la clôture administrative du dossier.",
          "Explication des prochaines étapes au client, incluant les démarches liées à l’établissement au Canada.",
          "Le CRIC devra fournir au client une copie finale et signée du présent contrat de service professionnel.",
        ],
      ],
      travail: [
        [
          "Phase :",
          "Ouverture du dossier.",
          "Conseil et évaluation du dossier.",
          "Préparation du dossier et documents requis (document d’identités, les autres preuves, etc.).",
          "Rédaction des lettres explicatives en soumettant avec les preuves de la situation complexe pour appuyer la demande de la cliente.",
          "Préparation des formulaires de la demande du permis de travail.",
          "Soumission de la demande en ligne du permis de travail en ligne ou format papier.",
          "Valider et téléverser l’ensemble des documents.",
          "Suivi du dossier du permis de travail auprès de l’IRCC, les autres services concernés et la cliente jusqu’à une décision soit prise.",
          "Expliquer la décision à la cliente.",
        ],
      ],
      retablissement: [
        [
          "Phase :",
          "Ouvrir et administrer le dossier du client ;",
          "Fournir des conseils professionnels et procéder à l’évaluation juridique du dossier ;",
          "Identifier, vérifier et préparer les documents requis (documents d’identité, preuves de statut, pièces justificatives, etc.) ;",
          "Rédiger les lettres explicatives détaillées afin d’appuyer la demande de rétablissement de statut ;",
          "Préparer et compléter les formulaires requis pour la demande de rétablissement de statut ;",
          "Soumettre la demande de rétablissement de statut en ligne ou en format papier, selon le cas ;",
          "Valider et téléverser l’ensemble des documents exigés par IRCC ;",
          "Assurer le suivi du dossier auprès d’IRCC jusqu’à la prise d’une décision ;",
          "Informer la cliente de toute communication ou décision et expliquer le résultat de la demande.",
        ],
      ],
    },
    names = {
      etudes: "Permis d’étude",
      humanitaire: "Considérations d’ordre humanitaire",
      famille: "Regroupement familial",
      travail: "Permis de travail",
      retablissement: "Rétablissement de statut temporaire",
      erar: "Examen des risques avant renvoi (ERAR)",
      supervisa: "Super visa",
      visiteur: "Visiteur",
      asile: "Demandeur d’asile",
      qualifie: "Travailleur qualifié",
      sejour: "Permis de séjour temporaire",
      ave: "Autorisation de voyage électronique (AVE)",
      eic: "Expérience internationale Canada",
      affaires: "Programme d’immigration des gens d’affaires",
    };
  Object.assign(models, {
    humanitaire: [
      [
        "Phase 1 : Ouverture et évaluation du dossier",
        "Ouverture officielle et administration du dossier du client.",
        "Évaluation de la situation personnelle, familiale et migratoire du client.",
        "Analyse des circonstances humanitaires justifiant la demande de résidence permanente.",
        "Vérification des antécédents d’immigration et des décisions antérieures, le cas échéant.",
        "Identification des facteurs humanitaires pertinents, notamment l’établissement au Canada, les liens familiaux, l’intérêt supérieur des enfants concernés et les difficultés en cas de retour.",
        "Préparation de la liste des documents et des éléments de preuve requis.",
      ],
      [
        "Phase 2 : Préparation et soumission de la demande",
        "Collecte, vérification et organisation des documents justificatifs.",
        "Préparation et validation des formulaires requis par IRCC.",
        "Analyse des preuves personnelles, familiales, médicales, sociales et financières pertinentes.",
        "Rédaction des observations écrites et des arguments humanitaires à l’appui de la demande.",
        "Préparation des lettres explicatives et des déclarations nécessaires.",
        "Vérification finale de la conformité et de l’intégralité du dossier.",
        "Soumission de la demande auprès d’IRCC par le canal applicable.",
      ],
      [
        "Phase 3 : Suivi et décision",
        "Vérification de la réception de la demande et des communications d’IRCC.",
        "Suivi administratif du dossier auprès d’IRCC.",
        "Préparation et transmission des documents supplémentaires demandés, le cas échéant.",
        "Accompagnement relatif aux examens médicaux et aux données biométriques, si requis.",
        "Information du client concernant les étapes et les communications officielles.",
        "Explication de la décision rendue par IRCC et des prochaines démarches possibles.",
        "Clôture administrative du dossier et remise des documents pertinents au client.",
      ],
    ],
    erar: [
      [
        "Phase 1 : Évaluation et préparation du dossier",
        "Ouverture officielle et administration du dossier du client.",
        "Analyse de l’avis d’admissibilité à l’ERAR remis par l’Agence des services frontaliers du Canada (ASFC).",
        "Vérification des délais applicables à la présentation de la demande.",
        "Évaluation des risques personnels auxquels le client pourrait être exposé en cas de renvoi dans son pays de nationalité ou de résidence habituelle.",
        "Examen des demandes d’asile, décisions et procédures d’immigration antérieures, le cas échéant.",
        "Identification des nouveaux éléments de preuve admissibles, lorsque des restrictions s’appliquent.",
        "Préparation de la liste des documents et des preuves nécessaires.",
      ],
      [
        "Phase 2 : Préparation et soumission de la demande",
        "Préparation, vérification et validation du formulaire de demande d’ERAR (IMM 5508).",
        "Collecte et examen des documents d’identité, des documents personnels et des pièces justificatives.",
        "Analyse des rapports sur les droits de la personne et de la situation dans le pays d’origine.",
        "Préparation des témoignages écrits, déclarations et documents démontrant les risques personnels.",
        "Rédaction des observations écrites détaillées exposant les risques de persécution, de torture, de menace à la vie ou de traitements cruels et inusités, selon les critères applicables.",
        "Vérification des traductions et des documents justificatifs.",
        "Soumission de la demande dans les délais prescrits, par le canal autorisé.",
      ],
      [
        "Phase 3 : Suivi et décision",
        "Suivi du dossier auprès d’IRCC et des autorités concernées.",
        "Réception et analyse des communications officielles.",
        "Préparation et transmission de renseignements ou de preuves supplémentaires, lorsque permis ou demandés.",
        "Préparation du client à une éventuelle audience, si celle-ci est prévue au mandat et relève des activités autorisées du CRIC.",
        "Information du client sur l’évolution de sa demande.",
        "Communication et explication de la décision rendue.",
        "Information concernant les prochaines étapes et les recours éventuels, sans inclure une nouvelle procédure de représentation non prévue au contrat.",
        "Clôture administrative du dossier.",
      ],
    ],
    supervisa: [
      [
        "Phase 1 : Évaluation et préparation du dossier",
        "Ouverture officielle du dossier.",
        "Évaluation de l’admissibilité du demandeur au programme de super visa.",
        "Vérification du statut de citoyen canadien ou de résident permanent de l’enfant ou du petit-enfant invitant.",
        "Vérification des exigences financières applicables à la personne invitante.",
        "Analyse des documents démontrant le lien de parenté.",
        "Vérification des exigences relatives à l’assurance médicale privée.",
        "Préparation de la liste des documents nécessaires, notamment la lettre d’invitation, les preuves financières et les documents d’identité.",
        "Examen des antécédents d’immigration du demandeur, le cas échéant.",
      ],
      [
        "Phase 2 : Préparation, soumission et suivi",
        "Collecte et validation de l’ensemble des documents requis.",
        "Préparation des formulaires et de la demande de super visa.",
        "Vérification de la lettre d’invitation et des preuves de soutien financier.",
        "Vérification des documents d’assurance médicale et des autres exigences applicables.",
        "Rédaction des lettres explicatives, au besoin.",
        "Soumission de la demande dans le portail approprié d’IRCC.",
        "Accompagnement concernant les données biométriques et l’examen médical, le cas échéant.",
        "Suivi du dossier auprès d’IRCC jusqu’à la décision.",
        "Explication de la décision et des formalités nécessaires avant le voyage.",
      ],
    ],
    visiteur: [
      [
        "Phase 1 : Évaluation et préparation de la demande",
        "Ouverture officielle du dossier du client.",
        "Évaluation de l’admissibilité à une demande de visa de visiteur.",
        "Analyse du motif du séjour au Canada : tourisme, visite familiale, affaires ou autre motif admissible.",
        "Vérification des antécédents de voyage et d’immigration du client.",
        "Évaluation des preuves financières et des moyens de subsistance pendant le séjour.",
        "Analyse des attaches personnelles, familiales, professionnelles et économiques dans le pays de résidence.",
        "Préparation de la liste des documents requis.",
      ],
      [
        "Phase 2 : Soumission et suivi de la demande",
        "Préparation et validation des formulaires requis par IRCC.",
        "Collecte et vérification des documents d’identité et des justificatifs de voyage.",
        "Préparation des lettres explicatives et de soutien, si nécessaire.",
        "Vérification des lettres d’invitation et des preuves d’hébergement, le cas échéant.",
        "Validation et téléversement des documents.",
        "Soumission de la demande de visa de visiteur auprès d’IRCC.",
        "Accompagnement concernant la collecte des données biométriques, si applicable.",
        "Suivi du dossier jusqu’à la décision.",
        "Explication de la décision et des prochaines démarches au client.",
      ],
    ],
    asile: [
      [
        "Phase 1 : Évaluation et ouverture du dossier",
        "Ouverture officielle et administration du dossier du demandeur d’asile.",
        "Évaluation préliminaire de la situation personnelle et migratoire du client.",
        "Analyse des motifs invoqués à l’appui de la demande de protection.",
        "Vérification des conditions d’admissibilité et des restrictions applicables à la présentation d’une demande d’asile.",
        "Examen des antécédents d’immigration, des demandes antérieures et des documents disponibles.",
        "Identification des risques de persécution ou d’autres risques pertinents en cas de retour au pays d’origine.",
        "Préparation de la liste des documents et des éléments de preuve nécessaires.",
      ],
      [
        "Phase 2 : Préparation et présentation de la demande",
        "Collecte, examen et organisation des documents justificatifs.",
        "Assistance à la préparation du formulaire Fondement de la demande d’asile (FDA).",
        "Préparation et vérification des renseignements personnels et des antécédents du demandeur.",
        "Assistance à la rédaction du récit personnel exposant les événements et les risques invoqués, conformément aux déclarations du client.",
        "Examen des documents de preuve, des témoignages et des renseignements pertinents sur le pays d’origine.",
        "Préparation et validation des formulaires nécessaires.",
        "Assistance à la présentation de la demande d’asile auprès d’IRCC ou de l’ASFC, selon la procédure applicable.",
        "Vérification des accusés de réception et des communications officielles.",
      ],
      [
        "Phase 3 : Préparation à l’audience et suivi",
        "Suivi administratif du dossier auprès des autorités compétentes.",
        "Vérification des communications et des échéances de la Section de la protection des réfugiés (SPR).",
        "Préparation des documents et éléments de preuve complémentaires.",
        "Accompagnement du client dans la préparation de son témoignage.",
        "Explication du déroulement de l’audience et des obligations procédurales.",
        "Représentation du client devant la SPR, uniquement si le CRIC possède l'autorisation professionnelle requise et si cette prestation est expressément prévue au mandat.",
        "Communication et explication de la décision rendue.",
        "Information du client sur les prochaines étapes et les recours éventuels.",
        "Clôture administrative du dossier.",
      ],
    ],
    qualifie: [
      [
        "Phase 1 : Évaluation de l’admissibilité et sélection du programme",
        "Ouverture officielle du dossier du client.",
        "Évaluation du profil personnel, professionnel et migratoire du client.",
        "Analyse de l’expérience professionnelle selon la Classification nationale des professions (CNP).",
        "Vérification des compétences linguistiques et des résultats des tests reconnus.",
        "Analyse des diplômes et des évaluations des diplômes d’études (EDE), le cas échéant.",
        "Vérification des exigences financières applicables.",
        "Évaluation de l’admissibilité au programme des travailleurs qualifiés fédéral ou à un autre programme approprié.",
        "Analyse des critères de sélection et du système de classement applicable.",
        "Préparation d’une stratégie d’immigration et de la liste des documents requis.",
      ],
      [
        "Phase 2 : Préparation du profil et démarches de sélection",
        "Collecte et vérification des documents personnels, professionnels et scolaires.",
        "Vérification des attestations d’emploi et des preuves d’expérience professionnelle.",
        "Validation des résultats linguistiques et des évaluations des diplômes.",
        "Calcul et vérification des points de sélection applicables.",
        "Préparation et soumission du profil Entrée express, lorsque ce programme est retenu.",
        "Suivi du profil et des rondes d’invitations.",
        "Mise à jour du profil en cas de modification de la situation du client.",
        "Analyse de l’invitation à présenter une demande de résidence permanente, si reçue.",
      ],
      [
        "Phase 3 : Demande de résidence permanente et suivi",
        "Préparation des formulaires de résidence permanente après réception d’une invitation, lorsque applicable.",
        "Collecte et validation des documents justificatifs définitifs.",
        "Vérification des preuves financières, des certificats de police et des autres documents requis.",
        "Préparation des lettres explicatives et des observations écrites, au besoin.",
        "Soumission de la demande de résidence permanente auprès d’IRCC.",
        "Accompagnement concernant les données biométriques et les examens médicaux, le cas échéant.",
        "Suivi du dossier auprès d’IRCC jusqu’à la décision finale.",
        "Explication de la décision et des formalités relatives à la confirmation de résidence permanente.",
        "Clôture administrative du dossier.",
      ],
    ],
    sejour: [
      [
        "Phase 1 : Évaluation et préparation du dossier",
        "Ouverture officielle du dossier.",
        "Évaluation de la situation personnelle et migratoire du client.",
        "Analyse des motifs d’interdiction de territoire ou de non-conformité aux exigences d’immigration, selon le cas.",
        "Évaluation des circonstances justifiant une demande de permis de séjour temporaire.",
        "Examen des antécédents d’immigration et des décisions antérieures.",
        "Identification des éléments démontrant les motifs impérieux ou les circonstances particulières justifiant la demande.",
        "Préparation de la liste des documents et des preuves nécessaires.",
      ],
      [
        "Phase 2 : Préparation, soumission et suivi",
        "Collecte et validation des documents d’identité et des pièces justificatives.",
        "Préparation des formulaires applicables à la demande de permis de séjour temporaire.",
        "Rédaction d’une lettre explicative détaillée présentant les circonstances particulières du client.",
        "Préparation des observations écrites et des preuves à l’appui de la demande.",
        "Vérification de la conformité et de l’intégralité du dossier.",
        "Soumission de la demande auprès de l’autorité compétente, selon le lieu de présentation et la procédure applicable.",
        "Suivi du dossier auprès d’IRCC ou de l’ASFC, selon le cas.",
        "Réponse aux demandes de renseignements supplémentaires.",
        "Communication et explication de la décision rendue.",
        "Information du client sur les conditions et la durée du permis, en cas d’approbation.",
      ],
    ],
    ave: [
      [
        "Phase 1 : Évaluation, préparation et soumission",
        "Ouverture et administration du dossier du client.",
        "Vérification de l’admissibilité à une autorisation de voyage électronique (AVE).",
        "Vérification de la nationalité et de la validité du passeport du demandeur.",
        "Analyse des antécédents d’immigration et de voyage, le cas échéant.",
        "Vérification des renseignements personnels nécessaires à la demande.",
        "Préparation et remplissage du formulaire électronique d’AVE.",
        "Validation des renseignements saisis avant la soumission.",
        "Soumission de la demande d’AVE sur le site officiel du gouvernement du Canada.",
        "Vérification de la réception de la confirmation de soumission.",
        "Suivi de la demande et communication de la décision au client.",
        "Vérification des renseignements de l’AVE approuvée et explication des conditions applicables au voyage.",
      ],
    ],
    eic: [
      [
        "Phase 1 : Évaluation et création du profil",
        "Ouverture officielle du dossier du client.",
        "Évaluation de l’admissibilité au programme Expérience internationale Canada.",
        "Vérification des conditions liées à la nationalité, à l’âge et aux ententes applicables.",
        "Analyse de la catégorie appropriée : Vacances-travail, Jeunes professionnels ou Stage coop international.",
        "Vérification des exigences relatives à l’offre d’emploi ou au stage, lorsque applicable.",
        "Collecte et vérification des documents personnels requis.",
        "Préparation et soumission du profil EIC dans le bassin approprié.",
        "Vérification de la confirmation de soumission du profil.",
      ],
      [
        "Phase 2 : Invitation et demande de permis de travail",
        "Suivi du profil EIC et des communications d’IRCC.",
        "Vérification de l’invitation à présenter une demande de permis de travail, si reçue.",
        "Information du client sur les délais applicables à l’acceptation de l’invitation et à la soumission de la demande.",
        "Préparation et validation des formulaires de demande de permis de travail.",
        "Collecte et vérification des documents justificatifs.",
        "Vérification de l’offre d’emploi et des renseignements de l’employeur, lorsque requis.",
        "Préparation des lettres explicatives, si nécessaire.",
        "Soumission de la demande de permis de travail auprès d’IRCC.",
      ],
      [
        "Phase 3 : Suivi et décision",
        "Vérification de la réception de la demande.",
        "Accompagnement concernant les données biométriques, le cas échéant.",
        "Suivi du dossier auprès d’IRCC.",
        "Préparation et transmission des documents supplémentaires demandés.",
        "Communication des mises à jour au client.",
        "Explication de la décision rendue par IRCC.",
        "Vérification de la lettre d'introduction au point d'entrée, en cas d'approbation.",
        "Information du client concernant les documents nécessaires à son arrivée au Canada.",
        "Clôture administrative du dossier.",
      ],
    ],
    affaires: [
      [
        "Phase 1 : Évaluation du profil et admissibilité",
        "Ouverture officielle et administration du dossier du client.",
        "Évaluation de la situation personnelle, professionnelle, financière et migratoire.",
        "Analyse de l’expérience entrepreneuriale, de gestion ou de travail autonome du client.",
        "Vérification de l’admissibilité au programme d’immigration des gens d’affaires applicable.",
        "Évaluation des exigences relatives aux actifs, aux investissements et à la provenance des fonds, selon le programme.",
        "Analyse des critères linguistiques, professionnels et financiers applicables.",
        "Vérification des exigences particulières du programme québécois ou fédéral retenu.",
        "Préparation de la stratégie d’immigration et de la liste des documents requis.",
      ],
      [
        "Phase 2 : Préparation et soumission du dossier de sélection",
        "Collecte et vérification des documents personnels, professionnels et financiers.",
        "Analyse des preuves d’expérience en gestion ou en entrepreneuriat.",
        "Vérification des documents relatifs aux entreprises, aux actifs et aux investissements.",
        "Préparation et validation des formulaires exigés par le programme sélectionné.",
        "Préparation des lettres explicatives et des observations écrites.",
        "Assistance à la préparation des documents relatifs au projet d’affaires, lorsque requis.",
        "Préparation et soumission du dossier auprès de l’autorité provinciale ou fédérale compétente.",
        "Suivi du dossier de sélection et des demandes de documents complémentaires.",
        "Explication de la décision de sélection, le cas échéant.",
      ],
      [
        "Phase 3 : Demande de résidence permanente et suivi",
        "Vérification de l’obtention du Certificat de sélection du Québec (CSQ), lorsque requis.",
        "Préparation des formulaires fédéraux de résidence permanente.",
        "Collecte et validation des documents d’identité, des certificats de police et des documents familiaux.",
        "Vérification des documents financiers et des preuves supplémentaires exigées.",
        "Préparation et soumission de la demande de résidence permanente auprès d’IRCC.",
        "Accompagnement concernant les données biométriques et les examens médicaux, le cas échéant.",
        "Suivi du traitement du dossier auprès d’IRCC.",
        "Préparation et transmission des documents additionnels demandés.",
        "Communication et explication de la décision finale.",
        "Accompagnement relatif à la confirmation de résidence permanente.",
        "Clôture administrative du dossier.",
      ],
    ],
  });
  const form = document.getElementById("contractForm"),
    select = document.getElementById("madicTypeService"),
    textarea = document.getElementById("madicPrestations"),
    target = document.getElementById("madicPrestationsDocument"),
    service = document.getElementById("madicServiceDocument");
  if (!form || !select || !textarea || !target) return;
  const objet = form.elements.namedItem("objet");
  const formatted = (k) =>
    (
      models[k] || [
        ["Responsabilités et prestations du CRIC :", "À compléter."],
      ]
    )
      .map(
        (group) =>
          group[0] +
          "\n" +
          group
            .slice(1)
            .map((x) => "• " + x)
            .join("\n"),
      )
      .join("\n\n");
  const saved = new Map();
  let previous = select.value;
  function update() {
    service.textContent =
      "Type de service d’immigration : " + names[select.value];
    target.replaceChildren();
    const lines = textarea.value.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const p = document.createElement("p");
      if (
        /^Phase(?:\s+\d+)?\s*:/i.test(line) ||
        line === "Responsabilités et prestations du CRIC :"
      ) {
        p.className = "contract-phase";
        p.textContent = line;
      } else if (line.startsWith("•")) {
        p.className = "contract-bullet";
        p.textContent = line;
      } else {
        p.textContent = line;
      }
      target.append(p);
    }
    document.querySelectorAll("[data-madic-study-only]").forEach((el) => {
      el.hidden = select.value !== "etudes";
    });
    document.querySelectorAll(".contract-fee-table").forEach((table) => {
      table.dataset.madicFeeReview = String(select.value !== "etudes");
    });
  }
  select.addEventListener("change", () => {
    saved.set(previous, { text: textarea.value, objet: objet.value });
    previous = select.value;
    const draft = saved.get(previous);
    textarea.value = draft ? draft.text : formatted(previous);
    objet.value = draft
      ? draft.objet
      : {
          etudes: "Demande de permis d’études",
          humanitaire:
            "Demande de résidence permanente pour considérations d’ordre humanitaire",
          famille: "Demande de regroupement familial",
          travail: "Demande de permis de travail",
          retablissement:
            "Demande de rétablissement du statut de résident temporaire",
          erar: "Demande d’examen des risques avant renvoi (ERAR)",
          supervisa: "Demande de super visa",
          visiteur: "Demande de visa de visiteur",
          asile: "Demande d’asile",
          qualifie: "Demande d’immigration à titre de travailleur qualifié",
          sejour: "Demande de permis de séjour temporaire",
          ave: "Demande d’autorisation de voyage électronique (AVE)",
          eic: "Demande dans le cadre d’Expérience internationale Canada",
          affaires:
            "Demande dans le cadre du Programme d’immigration des gens d’affaires",
        }[previous];
    update();
    form.dispatchEvent(new Event("input", { bubbles: true }));
  });
  textarea.addEventListener("input", update);
  form.addEventListener("input", () => queueMicrotask(update));
  document.getElementById("contractPreview")?.addEventListener("click", update);
  window.addEventListener("beforeprint", update);
  textarea.value = formatted(select.value);
  objet.value = objet.value || "Demande de permis d’études";
  update();
})();

/* MADIC : synchronisation des prestations et de la facturation, 1 à 3 phases. */
(() => {
  "use strict";
  const form = document.getElementById("contractForm"),
    count = document.getElementById("madicPhaseCount"),
    service = document.getElementById("madicTypeService"),
    prestations = document.getElementById("madicPrestations"),
    rows = document.getElementById("madicPhaseFeeRows"),
    balance = document.getElementById("madicPhaseBalance");
  if (!form || !count || !service || !prestations || !rows || !balance) return;
  const field = (k) => form.elements.namedItem(k);
  const defaults = {
    etudes: 3,
    humanitaire: 3,
    famille: 3,
    travail: 1,
    retablissement: 1,
    erar: 3,
    supervisa: 2,
    visiteur: 2,
    asile: 3,
    qualifie: 3,
    sejour: 2,
    ave: 1,
    eic: 3,
    affaires: 3,
  };
  const phaseTitlesByService = {
    "etudes": [
        "Ouverture et préparation du dossier",
        "Vérification des exigences et préparation des documents",
        "Soumission de la demande et suivi jusqu’à la décision"
    ],
    "humanitaire": [
        "Ouverture et évaluation du dossier",
        "Préparation et soumission de la demande",
        "Suivi du dossier et décision"
    ],
    "famille": [
        "Évaluation, préparation et soumission du dossier de parrainage",
        "Traitement de la demande et suivi auprès d’IRCC",
        "Confirmation de résidence permanente et finalisation du dossier"
    ],
    "travail": [
        "Évaluation, préparation, soumission et suivi de la demande"
    ],
    "retablissement": [
        "Évaluation, préparation, soumission et suivi de la demande"
    ],
    "erar": [
        "Évaluation des risques et préparation du dossier",
        "Préparation des observations et soumission de la demande",
        "Suivi de la procédure et décision"
    ],
    "supervisa": [
        "Évaluation de l’admissibilité et préparation du dossier",
        "Soumission de la demande et suivi jusqu’à la décision"
    ],
    "visiteur": [
        "Évaluation et préparation du dossier",
        "Soumission de la demande et suivi jusqu’à la décision"
    ],
    "asile": [
        "Ouverture et évaluation du dossier de protection",
        "Préparation et présentation de la demande d’asile",
        "Préparation à l’audience, représentation autorisée et suivi"
    ],
    "qualifie": [
        "Évaluation de l’admissibilité et sélection du programme",
        "Préparation du profil et démarches de sélection",
        "Demande de résidence permanente et suivi"
    ],
    "sejour": [
        "Évaluation de l’admissibilité et préparation du dossier",
        "Soumission de la demande et suivi jusqu’à la décision"
    ],
    "ave": [
        "Évaluation, préparation, soumission et suivi de la demande"
    ],
    "eic": [
        "Évaluation de l’admissibilité et création du profil",
        "Invitation et préparation de la demande de permis de travail",
        "Suivi de la demande et décision"
    ],
    "affaires": [
        "Évaluation du profil et de l’admissibilité",
        "Préparation et soumission du dossier de sélection",
        "Demande de résidence permanente et suivi"
    ]
};
  const drafts = new Map();
  let currentService = service.value;
  let countManuallyChanged = false;
  const money = (v) => {
    const n = Number(v);
    return v !== "" && Number.isFinite(n) && n >= 0
      ? n.toLocaleString("fr-CA", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) + " $ CA"
      : "À convenir";
  };
  function headings() {
    return phaseTitlesByService[service.value] || [];
  }
  function modelCount() {
    return defaults[service.value] || 1;
  }
  function save() {
    drafts.set(currentService, {
      count: count.value,
      manual: countManuallyChanged,
      phases: [1, 2, 3].map((i) => ({
        trigger: field("phaseDeclencheur" + i).value,
        amount: field("phase" + i).value,
      })),
    });
  }
  function setService() {
    const saved = drafts.get(service.value),
      names = headings();
    countManuallyChanged = saved?.manual || false;
    count.value = saved?.count || String(modelCount());
    for (let i = 1; i <= 3; i++) {
      const old = saved?.phases[i - 1],
        title = field("phaseTitre" + i);
      // Intitulé fixe pour cette phase et ce service, sans liste déroulante.
      title.value = names[i - 1] || "Phase " + i;
      field("phaseDeclencheur" + i).value =
        old?.trigger ?? "À l’exécution des prestations de la phase " + i;
      field("phase" + i).value = old?.amount ?? "";
    }
    render();
  }
  function render() {
    const n = Math.max(1, Math.min(3, Number(count.value) || 1));
    for (let i = 1; i <= 3; i++) {
      const group = form.querySelector('[data-madic-phase="' + i + '"]');
      if (group) {
        group.hidden = i > n;
        for (const input of group.querySelectorAll("input, select"))
          input.disabled = i > n;
      }
    }
    rows.replaceChildren();
    let total = 0,
      complete = true;
    for (let i = 1; i <= n; i++) {
      const tr = document.createElement("tr"),
        title = field("phaseTitre" + i).value.trim() || "Phase " + i,
        trigger = field("phaseDeclencheur" + i).value.trim(),
        amount = field("phase" + i).value,
        parsed = Number(amount);
      if (amount === "" || !Number.isFinite(parsed) || parsed < 0)
        complete = false;
      else total += parsed;
      const cells = [
        title + (trigger ? " - " + trigger : ""),
        money(amount),
        i === 1 ? money(field("avance")?.value || "") : "-",
        i === n
          ? "Biométrie : " +
            money(field("fraisBio")?.value || "") +
            " ; autres frais gouvernementaux : " +
            money(field("fraisPermis")?.value || "")
          : "-",
      ];
      for (const value of cells) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      rows.append(tr);
    }
    const agreed = field("tarif")?.value || "";
    const amount = Number(agreed);
    if (agreed !== "" && Number.isFinite(amount)) {
      balance.textContent =
        "Total des phases : " +
        money(String(total)) +
        " ; total convenu incluant les frais gouvernementaux : " +
        money(agreed) +
        ".";
    } else {
      balance.textContent =
        "Total des phases : " +
        (complete
          ? money(String(total))
          : "renseignez les montants des phases actives") +
        ".";
    }
    // Signaler les écarts au lieu de présenter un total trompeur.
    const feeBio = field("fraisBio")?.value || "";
    const feePermit = field("fraisPermis")?.value || "";
    const extras = [feeBio, feePermit].reduce((sum, v) => sum + (v !== "" && Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) : 0), 0);
    const agreedCents = Math.round(Number(agreed) * 100);
    const calculatedCents = Math.round(total * 100) + extras;
    const mismatch = complete && agreed !== "" && Number.isFinite(agreedCents) && agreedCents !== calculatedCents;
    balance.dataset.mismatch = String(mismatch);
    if (mismatch) balance.textContent += " Attention : le total convenu ne correspond pas à la somme des phases et des frais.";
  }
  service.addEventListener("change", () => {
    save();
    currentService = service.value;
    queueMicrotask(setService);
  });
  count.addEventListener("change", () => {
    countManuallyChanged = true;
    render();
    save();
  });
  prestations.addEventListener("input", () => {
    // Phase titles are chosen from the service-specific list, independently
    // from editable professional prestations.
    if (!countManuallyChanged) count.value = String(modelCount());
    render();
  });
  form.addEventListener("input", (e) => {
    if (e.target !== prestations) render();
  });
  form.addEventListener("change", (e) => {
    render();
  });
  document.getElementById("contractPreview")?.addEventListener("click", render);
  window.addEventListener("beforeprint", render);
  setService();
})();

/* MADIC : total convenu = phases actives + frais de permis + biométrie. */
(() => {
  "use strict";
  const form = document.getElementById("contractForm"),
    count = document.getElementById("madicPhaseCount");
  if (!form || !count) return;
  const field = (k) => form.elements.namedItem(k),
    tarif = field("tarif");
  if (!tarif) return;
  tarif.readOnly = true;
  tarif.title =
    "Calcul automatique : phases actives + frais de permis d’études + frais biométriques";
  const number = (k) => {
    const el = field(k);
    if (!el || String(el.value).trim() === "") return null;
    const v = Number(el.value);
    return Number.isFinite(v) && v >= 0 ? v : null;
  };
  let scheduled = false;
  function calculate() {
    scheduled = false;
    const n = Math.max(1, Math.min(3, Number(count.value) || 1));
    let cents = 0,
      hasValue = false;
    for (let i = 1; i <= n; i++) {
      const v = number("phase" + i);
      if (v !== null) {
        cents += Math.round(v * 100);
        hasValue = true;
      }
    }
    for (const key of ["fraisPermis", "fraisBio"]) {
      const v = number(key);
      if (v !== null) {
        cents += Math.round(v * 100);
        hasValue = true;
      }
    }
    const next = hasValue ? (cents / 100).toFixed(2) : "";
    if (tarif.value !== next) {
      tarif.value = next;
      tarif.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(calculate);
  }
  form.addEventListener("input", (e) => {
    if (
      ["phase1", "phase2", "phase3", "fraisPermis", "fraisBio"].includes(
        e.target?.name,
      )
    )
      schedule();
  });
  form.addEventListener("change", (e) => {
    if (
      e.target === count ||
      e.target?.id === "madicTypeService" ||
      ["phase1", "phase2", "phase3", "fraisPermis", "fraisBio"].includes(
        e.target?.name,
      )
    )
      setTimeout(schedule, 0);
  });
  document
    .getElementById("contractPreview")
    ?.addEventListener("click", schedule);
  window.addEventListener("beforeprint", calculate);
  schedule();
})();


/* Scripts extraits de la page HTML */

      (() => {
        "use strict";
        const form = document.getElementById("contractForm"),
          doc = document.getElementById("contractDocument");
        if (!form || !doc) return;
        const nodes = [...doc.querySelectorAll("[data-contract-template]")];
        const val = (k) => form.elements.namedItem(k)?.value?.trim() || "";
        function render() {
          const clientNom = [val("prenom"), val("nom")]
            .filter(Boolean)
            .join(" ");
          const values = {};
          for (const e of form.elements) if (e.name) values[e.name] = e.value;
          const civ = val("civilite");
          const clientAppellation =
            [civ === "Autre" ? "" : civ, clientNom].filter(Boolean).join(" ") ||
            "À compléter";
          const clientDative =
            civ === "Madame"
              ? "Madame " + (clientNom || "À compléter")
              : civ === "Monsieur"
                ? "Monsieur " + (clientNom || "À compléter")
                : clientNom || "la personne cliente";
          const accordFeminin = civ === "Madame" ? "e" : "";
          Object.assign(values, {
            clientAppellation,
            clientDative,
            accordFeminin,
            clientNom,
            dateLong: val("date")
              ? new Date(val("date") + "T12:00:00").toLocaleDateString(
                  "fr-CA",
                  { day: "2-digit", month: "long", year: "numeric" },
                )
              : "À compléter",
            langueContrat: val("langue") === "Anglais" ? "anglais" : "français",
            civilite: val("civilite") || "Madame",
          });
          for (const node of nodes)
            node.textContent = node.dataset.contractTemplate.replace(
              /\{([a-zA-Z0-9]+)\}/g,
              (_, k) =>
                values[k] !== undefined &&
                values[k] !== null &&
                String(values[k]) !== ""
                  ? values[k]
                  : k === "accordFeminin"
                    ? ""
                    : "À compléter",
            );
        }
        form.addEventListener("input", () => queueMicrotask(render));
        form.addEventListener("change", () => queueMicrotask(render));
        document
          .getElementById("contractPreview")
          ?.addEventListener("click", () => queueMicrotask(render));
        document
          .getElementById("contractPrint")
          ?.addEventListener("click", render, true);
        window.addEventListener("beforeprint", render);
        new MutationObserver(() => {
          if (!document.getElementById("contractWorkspace").hidden) render();
        }).observe(document.getElementById("contractWorkspace"), {
          attributes: true,
          attributeFilter: ["hidden"],
        });
        render();
      })();
    

      /* MADIC : résumé préliminaire automatique, sans écraser une modification manuelle. */
      (() => {
        "use strict";
        const form = document.getElementById("contractForm");
        if (!form) return;
        const get = (k) => (form.elements.namedItem(k)?.value || "").trim();
        const input = form.elements.namedItem("conseils");
        if (!input) return;
        const service = document.getElementById("madicTypeService");
        let lastAutomatic = "";
        let manual = false;
        const drafts = new Map();
        let previousService = service?.value || "";
        function compose() {
          const nom = [get("prenom"), get("nom")].filter(Boolean).join(" ");
          const civ = get("civilite");
          const personne =
            [civ === "Autre" ? "" : civ, nom].filter(Boolean).join(" ") ||
            "la personne cliente";
          const libelle =
            service?.selectedOptions?.[0]?.textContent?.trim() ||
            "service d’immigration sélectionné";
          const objet =
            get("objet") || "la démarche de " + libelle.toLowerCase();
          const specifics = {
            etudes:
              "Les conditions d’admissibilité au permis d’études, la lettre d’acceptation d’un établissement d’enseignement désigné, les exigences provinciales applicables, les preuves financières, les documents à fournir et les conditions de séjour ont été abordés.",
            humanitaire:
              "Les facteurs humanitaires pertinents, les liens familiaux, l’établissement au Canada, l’intérêt supérieur des enfants concernés, les éléments de preuve et le caractère discrétionnaire de cette demande ont été expliqués.",
            famille:
              "Les critères d’admissibilité du répondant et de la personne parrainée, les preuves de la relation familiale, les engagements financiers, les étapes fédérales et provinciales applicables et les pièces justificatives ont été présentés.",
            travail:
              "Les catégories de permis de travail, les conditions d’admissibilité, les exigences relatives à une offre d’emploi et à une EIMT ou à une dispense, selon le cas, ainsi que les justificatifs requis ont été examinés.",
            retablissement:
              "Les conditions de rétablissement du statut temporaire, les délais applicables, les conséquences de la perte de statut, les restrictions possibles pendant le traitement et les documents justificatifs ont été expliqués.",
            erar: "L’admissibilité à l’examen des risques avant renvoi, les délais indiqués dans l’avis reçu, les risques personnels à démontrer, les preuves admissibles et les étapes de présentation ont été examinés.",
            supervisa:
              "Les conditions du super visa, le lien de parenté, les ressources financières de la personne invitante, les exigences d’assurance médicale, l’examen médical éventuel et les documents nécessaires ont été présentés.",
            visiteur:
              "Les critères du visa de visiteur, le motif et la durée envisagée du séjour, les ressources financières, les attaches au pays de résidence, les antécédents de voyage et les pièces justificatives ont été examinés.",
            asile:
              "Les critères de protection, les questions d’admissibilité, les risques personnels allégués, le formulaire Fondement de la demande d’asile, les éléments de preuve, les délais et les étapes devant les autorités compétentes ont été abordés.",
            qualifie:
              "Les programmes de travailleurs qualifiés potentiellement applicables, l’expérience professionnelle, les résultats linguistiques, les diplômes, les critères de sélection, les preuves financières et les étapes de résidence permanente ont été examinés.",
            sejour:
              "Les circonstances justifiant un permis de séjour temporaire, les questions d’interdiction de territoire, les preuves à fournir, le pouvoir discrétionnaire des autorités et les conditions éventuelles du permis ont été expliqués.",
            ave: "Les critères d’admissibilité à l’autorisation de voyage électronique, la validité du passeport, les renseignements à déclarer, les antécédents pertinents et les limites de cette autorisation de voyage ont été expliqués.",
            eic: "Les conditions du programme Expérience internationale Canada, les catégories possibles, les critères d’âge et de nationalité, les bassins, les invitations et les exigences du permis de travail ont été présentés.",
            affaires:
              "Les programmes d’immigration des gens d’affaires susceptibles de s’appliquer, les critères d’expérience entrepreneuriale, les exigences financières, la provenance des fonds et les étapes de sélection et de résidence permanente ont été abordés.",
          };
          const participe =
            civ === "Madame"
              ? "informée"
              : civ === "Monsieur"
                ? "informé"
                : "informée ou informé";
          return (
            "Une consultation initiale a été réalisée avec " +
            personne +
            " relativement à " +
            objet +
            ". " +
            (specifics[service?.value] ||
              "Les conditions d’admissibilité et les pièces justificatives applicables ont été examinées.") +
            " " +
            "Les délais de traitement, les frais applicables, les risques de refus et les obligations de fournir des renseignements exacts ont également été expliqués. " +
            personne +
            " a été " +
            participe +
            " qu’aucun résultat ne peut être garanti et que toute décision appartient aux autorités gouvernementales compétentes."
          );
        }
        function refresh() {
          if (manual) return;
          const existing = input.value.trim();
          if (existing && existing !== lastAutomatic) {
            manual = true;
            return;
          }
          const next = compose();
          if (input.value !== next) {
            input.value = next;
            lastAutomatic = next;
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
        input.addEventListener("input", (e) => {
          if (e.isTrusted) {
            manual = true;
          } else if (input.value !== lastAutomatic && input.value.trim())
            manual = true;
        });
        form.addEventListener("input", (e) => {
          if (e.target !== input) queueMicrotask(refresh);
        });
        form.addEventListener("change", (e) => {
          if (e.target !== input) {
            queueMicrotask(refresh);
            setTimeout(refresh, 0);
            setTimeout(refresh, 150);
          }
        });
        const workspace = document.getElementById("contractWorkspace");
        if (workspace)
          new MutationObserver(() => {
            if (!workspace.hidden) {
              refresh();
              setTimeout(refresh, 150);
            }
          }).observe(workspace, {
            attributes: true,
            attributeFilter: ["hidden"],
          });
        document
          .getElementById("contractPreview")
          ?.addEventListener("click", refresh);
        document
          .getElementById("contractPrint")
          ?.addEventListener("click", refresh, true);
        window.addEventListener("beforeprint", refresh);
        refresh();
      })();
    

      /* MADIC : pied de page dynamique sur chaque page PDF, sans changer les clauses. */
      (() => {
        "use strict";
        const form = document.getElementById("contractForm");
        if (!form) return;
        const style = document.createElement("style");
        style.id = "madicProfessionalPrintFooter";
        document.head.appendChild(style);
        const get = (name) =>
          (form.elements.namedItem(name)?.value || "").trim();
        const safe = (s) =>
          String(s)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/[\r\n\t]+/g, " ")
            .replace(/[\x00-\x1f]/g, " ")
            .trim();
        function update() {
          const details = [
            "Permis CRIC-CISR : " + (get("proNumero") || "À compléter"),
            get("registreQuebec")
              ? "Permis registre Québec : " + get("registreQuebec")
              : null,
            get("proAdresse") || "Adresse à compléter",
            "Tél. " + (get("proTelephone") || "À compléter"),
            "Courriel : " + (get("proCourriel") || "À compléter"),
          ]
            .filter(Boolean)
            .join(" | ");
          style.textContent =
            "@media print { @page { size:letter; margin:14mm 14mm 20mm; " +
            '@bottom-center { content:"' +
            safe(details) +
            '"; background:#10263b; color:#fff; font:bold 7.5pt/1.15 Arial,Helvetica,sans-serif; text-align:center; vertical-align:middle; padding:1.5mm 2mm; } ' +
            "@bottom-right { content:counter(page); background:#10263b; color:#fff; font:bold 13pt Arial,Helvetica,sans-serif; text-align:center; vertical-align:middle; width:9mm; } } }";
        }
        form.addEventListener("input", update);
        form.addEventListener("change", update);
        window.addEventListener("beforeprint", update);
        document
          .getElementById("contractPrint")
          ?.addEventListener("click", update, true);
        const workspace = document.getElementById("contractWorkspace");
        if (workspace)
          new MutationObserver(update).observe(workspace, {
            attributes: true,
            attributeFilter: ["hidden"],
          });
        update();
      })();
    
 initLanguage();
}catch(e){console.error(e);const s=document.getElementById("contractStatus");if(s)s.textContent="Erreur de chargement du contrat : "+e.message;}}

function initLanguage(){
 const dict={
 'Cabinet CRIC · Identité à vérifier':'RCIC practice · Identity verification required',
 'Contrat de services professionnels':'Professional services agreement',
 "Préparation d'un projet de contrat à partir du document transmis. Vérification et approbation par le consultant obligatoires avant toute signature.":'Preparation of a draft agreement from the submitted document. Consultant review and approval are required before signing.',
 'Renseignements du contrat':'Agreement information','Client associé':'Associated client','Dossier':'Case file','Civilité':'Title','Nom du client':'Client last name','Prénom du client':'Client first name','Courriel':'Email','Téléphone':'Phone','Adresse de résidence':'Residential address','Date de naissance':'Date of birth','Date du contrat':'Agreement date','Lieu de signature':'Signing location','Type de service d’immigration':'Immigration service type','Objet du mandat':'Scope of representation','Responsabilités et prestations du CRIC (modifiables)':'RCIC responsibilities and services (editable)','Langue des services':'Language of services','Honoraires convenus ($ CA)':'Agreed professional fees (CAD)','Avance convenue ($ CA)':'Agreed retainer (CAD)','Résumé des conseils préliminaires':'Summary of preliminary advice','Nombre de phases de facturation':'Number of billing phases','Intitulé de la phase 1':'Phase 1 title','Intitulé de la phase 2':'Phase 2 title','Intitulé de la phase 3':'Phase 3 title','Événement déclencheur de la facturation':'Billing trigger','Honoraires – phase 1 ($ CA)':'Phase 1 fees (CAD)','Honoraires – phase 2 ($ CA)':'Phase 2 fees (CAD)','Honoraires – phase 3 ($ CA)':'Phase 3 fees (CAD)','Frais biométriques ($ CA)':'Biometrics fees (CAD)','Frais permis d’études ($ CA)':'Study permit fees (CAD)','Logos du contrat':'Agreement logos','Logo CRIC–RCIC (gauche)':'RCIC logo (left)','Logo professionnel du CRIC (droite)':'Professional RCIC logo (right)','Rétablir le logo CRIC–RCIC':'Restore RCIC logo','Rétablir le logo professionnel':'Restore professional logo','Coordonnées professionnelles du CRIC':'RCIC professional contact details','Nom complet du consultant':'Consultant full name','Numéro CRIC':'RCIC number','Entreprise / cabinet':'Firm / practice','Adresse professionnelle':'Business address','Téléphone professionnel':'Business phone','Courriel professionnel':'Business email','Site Web':'Website','Coordonnées de paiement (Interac ou autres)':'Payment details (Interac or other)','Signature du consultant':'Consultant signature','Lieu de signature du consultant *':'Consultant signing location *','Nom du consultant (vérifié)':'Consultant name (verified)','Actualiser l’aperçu':'Refresh preview','Imprimer / enregistrer en PDF':'Print / save as PDF','Signer et transmettre au client (indisponible)':'Sign and send to client (unavailable)','Vérifier le tarif IRCC':'Check IRCC fees','Sélectionner un client':'Select a client','Sélectionner un dossier':'Select a case file','Madame':'Ms.','Monsieur':'Mr.','Autre':'Other','Français':'French','Anglais':'English','Par personne':'Per person','Famille admissible (maximum)':'Eligible family (maximum)','Groupe d’artistes admissible (maximum)':'Eligible performing artists group (maximum)','1 phase':'1 phase','2 phases':'2 phases','3 phases':'3 phases','Phase 1 - facturation':'Phase 1 - billing','Phase 2 - facturation':'Phase 2 - billing','Phase 3 - facturation':'Phase 3 - billing','Mon espace':'My workspace','Déconnexion':'Sign out','Espace client':'Client workspace','← Vue d’ensemble':'← Overview'};
 const original=new WeakMap(); const nodes=[];
 const excluded=(el)=>!!el.closest('#contractDocument');
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
 while((n=walker.nextNode())){if(!n.parentElement||excluded(n.parentElement)||['SCRIPT','STYLE'].includes(n.parentElement.tagName))continue;const raw=n.nodeValue;const key=raw.trim();if(dict[key]){original.set(n,{raw,key});nodes.push(n);}}
 const buttons=[...document.querySelectorAll('#madicHeroLanguage button[data-lang]')];
 function apply(lang){document.documentElement.lang=lang==='en'?'en-CA':'fr-CA';for(const node of nodes){const o=original.get(node);node.nodeValue=lang==='en'?o.raw.replace(o.key,dict[o.key]):o.raw;}
 document.querySelectorAll('[data-fr][data-en]').forEach(el=>{if(el.children.length===0)el.textContent=el.dataset[lang];});
 buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));
 try{localStorage.setItem('madic_ui_language',lang)}catch(_){}
 }
 buttons.forEach(b=>b.addEventListener('click',()=>apply(b.dataset.lang)));
 let lang='fr';try{lang=localStorage.getItem('madic_ui_language')==='en'?'en':'fr'}catch(_){}apply(lang);
}
 document.addEventListener('DOMContentLoaded',start,{once:true});
})();
