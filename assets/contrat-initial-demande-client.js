(async()=>{'use strict';
let madicLanguage='fr';
const madicTranslations={
 'Configuration Supabase indisponible':'Supabase configuration unavailable',
 'Chargement…':'Loading…',
 'Préparation du nouveau contrat…':'Preparing the new agreement…',
 'Nouveau contrat préparé. Vérifiez le document avant de signer.':'New agreement prepared. Review the document before signing.',
 'Aucun espace CRIC associé':'No associated RCIC workspace',
 'Aucun dossier associé à votre demande':'No case file associated with your request',
 'En attente de la signature du CRIC':'Awaiting the RCIC signature',
 'Contrat signé par le client':'Agreement signed by the client',
 'Deux signatures enregistrées':'Both signatures recorded',
 'En attente de la signature du CRIC':'Awaiting the RCIC signature',
 'Ouvrir le PDF final signé':'Open the final signed PDF',
 'Formule enregistrée':'Registered fee option',
 'Signature du client enregistrée. Référence':'Client signature recorded. Reference',
 'Contrat contresigné.':'Agreement countersigned.',
 'En attente de la contresignature du CRIC.':'Awaiting the RCIC countersignature.',
 'Contrat indisponible':'Agreement unavailable',
 'Signature impossible':'Unable to sign',
 'Accès impossible':'Access unavailable',
 'Confirmer la signature et la transmission de ce nouveau contrat au CRIC ?':'Confirm signing and sending this new agreement to the RCIC?'
};
function madicTranslate(text){if(madicLanguage==='fr')return text;let result=String(text);for(const [fr,en] of Object.entries(madicTranslations))result=result.replaceAll(fr,en);return result;}
function madicApplyLanguage(lang){
 madicLanguage=lang==='en'?'en':'fr';document.documentElement.lang=madicLanguage==='en'?'en-CA':'fr-CA';
 document.querySelectorAll('[data-fr][data-en]').forEach(el=>{el.textContent=el.getAttribute('data-'+madicLanguage);});
 document.querySelectorAll('[data-title-fr][data-title-en]').forEach(el=>{el.title=el.getAttribute('data-title-'+madicLanguage);});
 document.querySelectorAll('[data-aria-label-fr][data-aria-label-en]').forEach(el=>{el.setAttribute('aria-label',el.getAttribute('data-aria-label-'+madicLanguage));});
 document.querySelectorAll('#madicHeroLanguage [data-lang]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.lang===madicLanguage)));
 try{localStorage.setItem('madic_ui_language',madicLanguage);}catch(_){}
 const st=document.getElementById('status');if(st?.dataset.originalFr)st.textContent=madicTranslate(st.dataset.originalFr);
 const tariff=document.getElementById('tariff');if(tariff?.dataset.originalFr){const pdfLink=tariff.querySelector('a');tariff.textContent=madicTranslate(tariff.dataset.originalFr);if(pdfLink){pdfLink.textContent=madicTranslate('Ouvrir le PDF final signé');tariff.append(' · ',pdfLink);}}
}
function madicInitLanguage(){let saved='fr';try{saved=localStorage.getItem('madic_ui_language')||'fr';}catch(_){};
 document.querySelectorAll('#madicHeroLanguage [data-lang]').forEach(el=>el.addEventListener('click',()=>madicApplyLanguage(el.dataset.lang)));
 madicApplyLanguage(saved);
}
madicInitLanguage();
async function madicEnsureSupabase(){if(window.supabase?.createClient)return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';s.onload=resolve;s.onerror=()=>reject(Error('Supabase library unavailable'));document.head.append(s);});}
try{await madicEnsureSupabase();}catch(error){document.getElementById('status').textContent=error.message;return;}

const $=id=>document.getElementById(id),db=window.getMadicSupabase?.(),status=$('status');
const say=s=>{status.dataset.originalFr=s;status.textContent=madicTranslate(s);};
if(!db){say('Configuration Supabase indisponible');return;}
const {data:{user},error:ue}=await db.auth.getUser();if(ue||!user){location.href='connexion-client-cric.html';return;}
let profile=null,context=null,docHtml='',dossierSpaces=new Map();
const clean=s=>String(s??'').trim();
const esc=s=>clean(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tariffLabels={hourly:'À taux horaire - 159 $ US/heure',single:'À taux forfaitaire - Personne célibataire : 599 $ US',couple:'À taux forfaitaire - Couple : 749 $ US'};
function cityFromAddress(address){
 const parts=clean(address).split(',').map(x=>x.trim()).filter(Boolean);
 const provinceIndex=parts.findIndex(x=>/^(Québec|Quebec|QC|Ontario|ON|Alberta|AB|British Columbia|Colombie-Britannique|BC|Manitoba|MB|Saskatchewan|SK|Nova Scotia|Nouvelle-Écosse|NS|New Brunswick|Nouveau-Brunswick|NB)$/i.test(x));
 if(provinceIndex>0)return parts[provinceIndex-1];
 const postalIndex=parts.findIndex(x=>/\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b/i.test(x));
 if(postalIndex>0)return parts[postalIndex-1];
 return parts.length>=3?parts[parts.length-3]:'';
}
function professionalCity(ctx){
 const city=clean(ctx.address_city||ctx.business_city||ctx.city||cityFromAddress(ctx.business_address));
 const province=clean(ctx.address_province||ctx.business_province||'');
 return city+(province&&!city.toLowerCase().includes(province.toLowerCase())?' ('+province+')':'');
}
function readableDate(value){if(!value)return '';const d=new Date(value);return Number.isFinite(d.getTime())&&d.getTime()>0?d.toLocaleString('fr-CA'):'';}
function setCricLocation(parsed,city){
 const letter=parsed.querySelector('#letterheadCity');if(letter)letter.textContent=city;
 const party=parsed.querySelector('.madic-contract-page-two .contract-signature-party:first-child');
 for(const row of party?.querySelectorAll('.contract-form-row')||[]){if(row.firstElementChild?.textContent.trim()==='Lieu :'){const field=row.querySelector('.contract-sign-value');if(field)field.textContent=city||'À compléter';}}
}
function clientSignatureDetails(parsed,item){
 const block=parsed.createElement('div');
 block.className='madic-client-signature-stamp';
 const add=(label,value)=>{if(!value)return;const line=parsed.createElement('div');const title=parsed.createElement('strong');title.textContent=label+' : ';line.append(title,parsed.createTextNode(String(value)));block.append(line);};
 add('Signature électronique','Consentement confirmé dans MADIC Portail');
 add('Signataire',item.client_signed_name);
 add('Lieu',item.client_signature_city);
 add('Date et heure de signature',readableDate(item.client_signed_at));
 add('Méthode','Acceptation électronique du contrat');
 add('Référence du contrat',item.id);
 return block;
}
// Logo professionnel : acces limite au logo du CRIC associe au client.
// La fonction SQL et la politique Storage correspondantes sont fournies avec ce correctif.
async function loadProfessionalLogo(ctx,contract,spaceId){
 const img=contract.querySelector('#contractLogoProfessionalPreview');
 if(!img)return;
 img.removeAttribute('src');
 const isImageData=src=>/^data:image\/(png|jpeg|webp);base64,/i.test(src);
 const isHttps=src=>{try{const url=new URL(src);return url.protocol==='https:'&&url.username===''&&url.password==='';}catch{return false;}};
 for(const value of [ctx?.professional_logo_data_url,ctx?.logo_data_url,ctx?.professional_logo_url,ctx?.logo_url]){
  const src=clean(value);
  if(isImageData(src)||isHttps(src)){img.src=src;return;}
 }
 let path=clean(ctx?.logo_path||ctx?.professional_logo_path);
 if(!path&&spaceId){
  const {data,error}=await db.rpc('madic_client_first_logo_path',{p_space_id:spaceId});
  if(error){console.warn('Logo CRIC : autorisation Supabase indisponible :',error.message);return;}
  path=clean(data);
 }
 if(!path)return;
 const {data,error}=await db.storage.from('madic-cric-branding').download(path);
 if(error||!data){console.warn('Logo CRIC : telechargement non autorise :',error?.message||'fichier absent');return;}
 if(data.size>2*1024*1024)return;
 const dataUrl=await new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(reader.result);
  reader.onerror=()=>reject(Error('Lecture du logo impossible'));
  reader.readAsDataURL(data);
 });
 if(isImageData(dataUrl))img.src=dataUrl;
}
function signedDocument(item){
 const parsed=new DOMParser().parseFromString(item.document_snapshot?.html||'','text/html');
 const second=parsed.querySelector('.madic-contract-page-two');
 if(!second)throw Error('Document signé incomplet');
 const boxes=[...second.querySelectorAll('.contract-sign-box')];
 if(boxes.length<3)throw Error('Zones de signature introuvables');
 const stamp=(el,value)=>{el.textContent=value||'';el.classList.add('madic-electronic-signature');};
 stamp(boxes[0],item.client_initials);
 stamp(boxes[boxes.length-1],item.client_signed_name);
 const clientStamp=clientSignatureDetails(parsed,item);
 boxes[boxes.length-1].closest('.contract-form-row')?.insertAdjacentElement('afterend',clientStamp);
 setCricLocation(parsed,professionalCity(item.document_snapshot||{})||cityFromAddress(parsed.querySelector('#letterheadAddress')?.textContent||''));
  const cric=parsed.querySelector('#cricSignatureOnDocument');
 if(cric)stamp(cric,item.status==='deux_signatures'?item.cric_signed_name:'En attente de la signature du CRIC');
 const cricStamp=parsed.querySelector('#cricSignatureTimestamp');
 if(cricStamp)cricStamp.textContent=item.cric_signed_at?'Signature électronique CRIC · '+(item.cric_signature_city||'')+' · '+readableDate(item.cric_signed_at):'';
 return parsed.body.innerHTML;
}
function displayDocument(html){
 const base=esc(new URL('.',location.href).href);
 $('preview').srcdoc='<!doctype html><html lang="'+(document.documentElement.lang||'fr-CA')+'"><head><meta charset="utf-8"><base href="'+base+'"><link rel="stylesheet" href="assets/contrat-initial-demande-client.css"></head><body class="madic-client-first-preview" data-contract-kind="initial">'+html+'</body></html>';
 $('preview').hidden=false;
}
async function showExisting(item){
 $('signForm').hidden=true;
 displayDocument(signedDocument(item));
 $('tariff').dataset.originalFr='Contrat signé par le client · '+(item.status==='deux_signatures'?'Deux signatures enregistrées':'En attente de la signature du CRIC');$('tariff').textContent=madicTranslate($('tariff').dataset.originalFr);
 if(item.status==='deux_signatures'){
  const path='contrats-client-cric/'+user.id+'/'+item.id+'.pdf';
  const {data:pdf}=await db.storage.from('madic-documents').createSignedUrl(path,120);
  if(pdf?.signedUrl){const a=document.createElement('a');a.href=pdf.signedUrl;a.target='_blank';a.rel='noopener';a.textContent='Ouvrir le PDF final signé';$('tariff').append(' · ',a);}
 }
 say('Signature du client enregistrée. Référence : '+item.id+(item.status==='deux_signatures'?' · Contrat contresigné.':' · En attente de la contresignature du CRIC.'));
}
async function render(){
 const dossier=$('dossier').value;if(!dossier)return;
 say('Préparation du nouveau contrat…');
 const {data:ctx,error:ce}=await db.rpc('madic_client_first_context',{p_dossier_id:dossier});if(ce)throw ce;context=ctx;
 const {data:old,error:oe}=await db.from('madic_initial_contracts').select('*').eq('client_id',user.id).eq('payment_updated_at',ctx.payment_updated_at).eq('signature_flow','client_to_cric').maybeSingle();if(oe)throw oe;
 if(old){await showExisting(old);return;}
 $('signForm').hidden=false;$('preview').hidden=false;
 const {data:intake,error:ie}=await db.from('madic_client_intake').select('answers').eq('user_id',user.id).maybeSingle();if(ie)throw ie;
 const answers=typeof intake?.answers==='string'?JSON.parse(intake.answers):intake?.answers||{};
 const {data:p,error:pe}=await db.from('profiles').select('*').eq('id',user.id).maybeSingle();if(pe)throw pe;profile=p||{};
 const pick=(...keys)=>{for(const key of keys){const val=answers?.[key]??profile?.[key];if(val&&String(val).trim())return String(val).trim();}return '';};
 const firstname=pick('prenom','first_name'),lastname=pick('nom','last_name');$('fullName').value=[firstname,lastname].filter(Boolean).join(' ');
 const address=pick('adresse','adresse_complete','full_address','address')||[pick('no_rue'),pick('rue'),pick('ville'),pick('province'),pick('code_postale'),pick('pays')].filter(Boolean).join(', ');
 const values={clientNom:[firstname,lastname].filter(Boolean).join(' '),nom:lastname,prenom:firstname,courriel:pick('courriel','email'),telephone:pick('telephone','phone'),adresse:address,naissance:pick('date_naissance','birth_date','date_of_birth'),date:new Date().toLocaleDateString('en-CA'),lieu:pick('ville'),objet:'un avis professionnel de la part du consultant sur mes projets ou objectifs d’immigration au Canada.',proNom:ctx.consultant_name,proNumero:ctx.license_number,proEntreprise:ctx.business_name,proAdresse:ctx.business_address,proTelephone:ctx.phone,proCourriel:ctx.email,proSite:ctx.website_url,proPaiement:ctx.payment_details,proLieu:professionalCity(ctx),tarifLettres:tariffLabels[ctx.tariff_code]};
 const response=await fetch('contrat-initial-cric.html',{cache:'no-store'});if(!response.ok)throw Error('Modèle du contrat CRIC inaccessible');
 const parsed=new DOMParser().parseFromString(await response.text(),'text/html');const contract=parsed.querySelector('#contractDocument');if(!contract)throw Error('Modèle du contrat introuvable');
 contract.querySelectorAll('[data-contract-template]').forEach(el=>{el.textContent=el.dataset.contractTemplate.replace(/\{([a-zA-Z]+)\}/g,(_,k)=>values[k]||'À compléter');});
 const title=contract.querySelector('#madicInitialContractTitle');if(title)title.textContent=ctx.tariff_code==='hourly'?'CONTRAT DE CONSULTATION INITIALE À TAUX HORAIRE':'CONTRAT DE CONSULTATION INITIALE À TAUX FORFAITAIRE';
 const fill={letterheadConsultant:ctx.consultant_name,letterheadAddress:ctx.business_address,letterheadPhone:ctx.phone,letterheadEmail:ctx.email,letterheadWebsite:ctx.website_url,letterheadCity:professionalCity(ctx),letterheadDate:values.date};
 for(const [id,v] of Object.entries(fill)){const el=contract.querySelector('#'+id);if(el)el.textContent=v||'';}
 // Client -> CRIC uniquement : le modele partage CRIC -> Client reste intact.
 const clientParty=contract.querySelector('.madic-contract-page-two .contract-signature-party:last-child');
 if(clientParty){
  const rows=[...clientParty.querySelectorAll('.contract-form-row')];
  const dateRow=rows.find(row=>row.firstElementChild?.textContent.trim()==='Date :');
  const cityRow=rows.find(row=>row.firstElementChild?.textContent.trim()==='Lieu :');
  const signatureRow=rows.find(row=>row.firstElementChild?.textContent.trim()==='Signature client :');
  if(dateRow&&signatureRow)signatureRow.before(dateRow);
  if(cityRow&&signatureRow)signatureRow.before(cityRow);
 }
 const sig=contract.querySelector('#cricSignatureOnDocument');if(sig)sig.textContent='En attente de la signature du CRIC';
 const stamp=contract.querySelector('#cricSignatureTimestamp');if(stamp)stamp.textContent='';
 // Conserver le logo professionnel et tenter son chargement depuis les ressources autorisees.
 try{await loadProfessionalLogo(ctx,contract,dossierSpaces.get(dossier));}catch(error){console.warn("Logo professionnel non accessible :",error);}
 contract.querySelectorAll('script,form,button,input,textarea,select').forEach(n=>n.remove());
 docHtml=contract.outerHTML;
 $('tariff').dataset.originalFr='Formule enregistrée : '+tariffLabels[ctx.tariff_code];$('tariff').textContent=madicTranslate($('tariff').dataset.originalFr);
 displayDocument(docHtml);say('Nouveau contrat préparé. Vérifiez le document avant de signer.');
}
try{
 const {data:assocs,error:ae}=await db.from('madic_cric_clients').select('space_id').eq('client_id',user.id);if(ae)throw ae;
 const spaces=(assocs||[]).map(x=>x.space_id);if(!spaces.length)throw Error('Aucun espace CRIC associé');
 const {data:dossiers,error:de}=await db.from('dossiers').select('id,reference,space_id').eq('client_id',user.id).in('space_id',spaces);if(de)throw de;
 if(!dossiers?.length)throw Error('Aucun dossier associé à votre demande');
 for(const d of dossiers){dossierSpaces.set(d.id,d.space_id);$('dossier').add(new Option(d.reference||d.id,d.id));}
 $('workspace').hidden=false;await render();
 $('dossier').addEventListener('change',()=>render().catch(e=>say('Contrat indisponible : '+e.message)));
 $('signForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!context||!docHtml||!$('signForm').reportValidity())return;
 if(!confirm(madicTranslate('Confirmer la signature et la transmission de ce nouveau contrat au CRIC ?')))return;
 const btn=$('submit');btn.disabled=true;
 try{
  const snapshot={html:docHtml,client_id:user.id,dossier_id:context.dossier_id,tariff_code:context.tariff_code,consultant_name:context.consultant_name,consultant_license:context.license_number,business_address:context.business_address,address_city:context.address_city||context.business_city||context.city||'',address_province:context.address_province||context.business_province||''};
  const {data:id,error}=await db.rpc('madic_client_first_sign',{p_dossier_id:context.dossier_id,p_snapshot:snapshot,p_full_name:$('fullName').value.trim(),p_initials:$('initials').value.trim(),p_city:$('city').value.trim(),p_accept:$('accept').checked});if(error)throw error;
  const {data:signed,error:readError}=await db.from('madic_initial_contracts').select('*').eq('id',id).eq('client_id',user.id).single();if(readError)throw Error('Signature enregistrée, mais lecture du document impossible : '+readError.message);await showExisting(signed);
 }catch(err){say('Signature impossible : '+err.message);btn.disabled=false;}
 });
}catch(err){say('Accès impossible : '+err.message);}
})();
