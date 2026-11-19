/* MADIC — provincial/federal intake pre-screening. Read-only, RLS enforced. */
(()=>{'use strict';
const $=id=>document.getElementById(id),run=$('madicProvRun');if(!run)return;
const regions=[
['Québec','Programme de sélection des travailleurs qualifiés (PSTQ)','https://www.quebec.ca/immigration'],
['Ontario','Ontario Immigrant Nominee Program (OINP)','https://www.ontario.ca/page/ontario-immigrant-nominee-program-oinp'],
['Alberta','Alberta Advantage Immigration Program (AAIP)','https://www.alberta.ca/immigration'],
['Colombie-Britannique','BC Provincial Nominee Program (BC PNP)','https://www.welcomebc.ca/immigrate-to-b-c'],
['Manitoba','Manitoba Provincial Nominee Program (MPNP)','https://immigratemanitoba.com/'],
['Saskatchewan','Saskatchewan Immigrant Nominee Program (SINP)','https://www.saskatchewan.ca/residents/moving-to-saskatchewan/immigrating-to-saskatchewan'],
['Nouveau-Brunswick','New Brunswick Provincial Nominee Program (NBPNP)','https://www.gnb.ca/en/topic/family-home-community/immigration.html'],
['Nouvelle-Écosse','Nova Scotia Nominee Program (NSNP)','https://liveinnovascotia.com/fr/Programme-des-candidats-Nouvelle-Ecosse'],
['Terre-Neuve-et-Labrador','Newfoundland and Labrador Provincial Nominee Program (NLPNP)','https://www.gov.nl.ca/immigration/fr/bienvenue-au-portail-dimmigration-de-terre-neuve-et-labrador/'],
['Île-du-Prince-Édouard','Prince Edward Island Provincial Nominee Program (PEI PNP)','https://www.princeedwardisland.ca/en/topic/immigrate-to-pei'],
['Yukon','Yukon Nominee Program','https://yukon.ca/en/immigration'],
['Territoires du Nord-Ouest','Northwest Territories Nominee Program','https://www.immigratenwt.ca/']];
const federal=[['Entrée express — catégorie de l’expérience canadienne / travailleurs qualifiés / métiers spécialisés','https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada/entree-express.html'],['Programme d’immigration au Canada atlantique','https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada/programme-immigration-atlantique.html']];
const clean=v=>String(v??'').trim(),lower=v=>clean(v).toLocaleLowerCase('fr');
const yes=v=>/^(oui|yes|true|1)$/i.test(clean(v));
const numeric=v=>{const n=Number(clean(v).replace(',','.'));return Number.isFinite(n)&&clean(v)!==''?n:null};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const language=()=>{try{return localStorage.getItem('madic_ui_language')==='en'?'en':'fr'}catch(_){return'fr'}};
const tr=(fr,en)=>language()==='en'?en:fr;
let reportText='';
function item(parent,label,value){const p=el('p');p.append(el('strong',label+': '),document.createTextNode(clean(value)||tr('Non fourni','Not provided')));parent.append(p)}
function renderCard(parent,name,program,url,answers,kind){
 const card=el('article',undefined,'madic-prov-card');card.append(el('h3',name),el('p',program));
 const destination=lower(answers.province_destination||answers.province);
 const relevant=destination&&lower(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'')===destination.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const signals=[];const missing=[];
 const exp=numeric(answers.nbr_annee_exp);
 if(exp!==null)signals.push(tr('Expérience déclarée : ','Declared experience: ')+exp+tr(' année(s)',' year(s)'));else missing.push(tr('Durée de l’expérience professionnelle','Length of work experience'));
 if(clean(answers.niveau_scolarite))signals.push(tr('Scolarité déclarée : ','Declared education: ')+answers.niveau_scolarite);else missing.push(tr('Niveau de scolarité','Education level'));
 if(clean(answers.niveau_francais)||clean(answers.niveau_anglais))signals.push(tr('Niveaux linguistiques autodéclarés (non vérifiés)','Self-reported language levels (unverified)'));else missing.push(tr('Résultats de tests linguistiques officiels','Official language test results'));
 if(clean(answers.offre_emploi))signals.push(tr('Réponse à la question sur l’offre d’emploi : ','Job-offer response: ')+answers.offre_emploi);else missing.push(tr('Offre d’emploi et admissibilité de l’employeur','Job offer and employer eligibility'));
 if(clean(answers.titre_emploi)||clean(answers.emploi_actuel))signals.push(tr('Emploi déclaré : ','Declared occupation: ')+(answers.titre_emploi||answers.emploi_actuel));else missing.push(tr('Profession et code CNP','Occupation and NOC code'));
 if(kind==='province'&&!destination)missing.push(tr('Province de destination','Intended province'));
 if(kind==='province'&&relevant)signals.unshift(tr('Province de destination déclarée','Declared intended province'));
 missing.push(tr('Volet ouvert, critères détaillés, documents et liens provinciaux','Open stream, detailed requirements, documents and provincial ties'));
 const label=relevant?tr('Province privilégiée — examen requis','Preferred province — review required'):tr('À vérifier — admissibilité non déterminée','To review — eligibility undetermined');
 card.append(el('p',label,'madic-prov-tag'));
 const good=el('ul');signals.forEach(s=>good.append(el('li',s)));card.append(el('h4',tr('Renseignements disponibles','Available information')),good);
 const need=el('ul');missing.forEach(s=>need.append(el('li',s)));card.append(el('h4',tr('Vérifications indispensables','Required checks')),need);
 const link=el('a',tr('Source officielle','Official source'));link.href=url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);parent.append(card);
 reportText+='\n'+name+' — '+program+'\n'+label+'\n'+signals.join('\n')+'\n'+missing.join('\n')+'\n'+url+'\n';
}
function render(answers,client,dossier,status){const output=$('madicProvResults');output.replaceChildren();output.hidden=false;reportText='';
 output.append(el('h3',tr('Analyse comparative — Canada','Comparative assessment — Canada')));
 item(output,tr('Client','Client'),client.options[client.selectedIndex]?.textContent);item(output,tr('Dossier','Case'),dossier.options[dossier.selectedIndex]?.textContent);item(output,tr('Statut du formulaire','Intake status'),status);
 const dob=clean(answers.date_naissance);if(dob)item(output,tr('Date de naissance déclarée','Declared date of birth'),dob);
 output.append(el('p',tr('Aucun programme n’est confirmé admissible automatiquement. Les résultats ci-dessous sont des pistes de vérification pour le CRIC.','No program is automatically confirmed eligible. The results below are review leads for the RCIC.')));
 reportText=tr('MADIC — Présélection professionnelle, non décision d’admissibilité','MADIC — Professional pre-screening, not an eligibility decision')+'\n'+client.options[client.selectedIndex]?.textContent+'\n'+dossier.options[dossier.selectedIndex]?.textContent+'\n';
 output.append(el('h3',tr('Programmes fédéraux','Federal programs')));for(const [program,url]of federal)renderCard(output,tr('Fédéral','Federal'),program,url,answers,'federal');
 output.append(el('h3',tr('Programmes provinciaux et territoriaux','Provincial and territorial programs')));for(const [name,program,url]of regions)renderCard(output,name,program,url,answers,'province');
 output.append(el('p',tr('Les réponses du formulaire ne suffisent pas à vérifier les critères de tous les volets, les rondes d’invitations, la recevabilité, les seuils linguistiques, les professions et les exigences des employeurs.','The intake responses do not establish all stream requirements, invitation rounds, admissibility, language thresholds, occupations or employer requirements.')));
 $('madicProvCopy').disabled=false;
}
run.addEventListener('click',async()=>{
 const client=$('toolClient'),dossier=$('toolDossier'),status=$('madicProvStatus');$('madicProvCopy').disabled=true;$('madicProvResults').hidden=true;
 if(!client?.value||!dossier?.value){status.textContent=tr('Sélectionnez un client et son dossier.','Select a client and case.');return}
 status.textContent=tr('Lecture sécurisée du formulaire…','Securely loading intake…');run.disabled=true;
 try{
 const db=typeof window.getMadicSupabase==='function'?window.getMadicSupabase():null;if(!db)throw Error('Supabase unavailable');
 // Never bypass RLS: selected client is already restricted by the existing CRIC workspace selector.
 const {data,error}=await db.from('madic_client_intake').select('answers,status').eq('user_id',client.value).maybeSingle();if(error)throw error;
 if(!data){status.textContent=tr('Formulaire inaccessible ou absent. Vérifiez que le client a enregistré ses réponses et que la politique RLS autorise ce CRIC.','Intake unavailable or absent. Check that the client saved responses and that RLS authorizes this RCIC.');return}
 if(!data.answers||typeof data.answers!=='object')throw Error(tr('Réponses absentes ou invalides.','Missing or invalid answers.'));
 render(data.answers,client,dossier,data.status||'—');status.textContent=tr('Analyse préparatoire affichée. Vérification professionnelle obligatoire.','Preliminary assessment displayed. Professional review required.');
 }catch(error){status.textContent=tr('Accès aux réponses impossible : ','Unable to access responses: ')+(error.message||String(error))}finally{run.disabled=false}
});
$('madicProvCopy').addEventListener('click',async()=>{if(!reportText)return;try{await navigator.clipboard.writeText(reportText);$('madicProvStatus').textContent=tr('Rapport copié.','Report copied.')}catch(_){$('madicProvStatus').textContent=tr('Copie impossible.','Copy failed.')}});
for(const id of ['toolClient','toolDossier'])$(id)?.addEventListener('change',()=>{$('madicProvResults').hidden=true;$('madicProvCopy').disabled=true;reportText='';$('madicProvStatus').textContent=''});
})();
