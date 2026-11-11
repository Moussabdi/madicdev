/* MADIC Finances : lecture des registres et creation controlee des comptes. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const sections = [
    ['temps', 'Temps et honoraires', 'madic_finance_time_entries', ['activity_date','client_id','description','minutes_worked','hourly_rate_cents','billable']],
    ['factures', 'Facturation', 'madic_cric_invoices', ['invoice_number','issued_on','description','amount_cents','paid_cents','status']],
    ['paiements', 'Paiements', 'madic_cric_invoices', ['invoice_number','issued_on','amount_cents','paid_cents','status']],
    ['fiducie', 'Fidéicommis', 'madic_finance_accounts', ['name','account_type','currency','created_at']],
    ['compta', 'Comptabilité', 'madic_finance_ledger_entries', ['transaction_date','account_id','description','entry_type','amount_cents','reference']],
    ['rapports', 'Rapports', 'madic_cric_invoices', ['invoice_number','issued_on','amount_cents','paid_cents','status']]
  ];
  const context = {};
  let current = 'temps';
  let requestNumber = 0;
  const labels = {activity_date:'Date',client_id:'Client',description:'Description',minutes_worked:'Minutes',hourly_rate_cents:'Taux horaire (¢)',billable:'Facturable',invoice_number:'Facture',issued_on:'Émise le',amount_cents:'Montant HT (¢)',paid_cents:'Payé (¢)',status:'Statut',name:'Compte',account_type:'Type',currency:'Devise',created_at:'Création',transaction_date:'Date',account_id:'Compte',entry_type:'Mouvement',reference:'Référence'};
  function setStatus(message, error=false) { $('status').textContent = message; $('status').className = error ? 'error' : 'muted'; }
  function node(tag, text, className) { const e=document.createElement(tag); if(text!==undefined)e.textContent=String(text); if(className)e.className=className; return e; }
  const money = (value) => (Number(value || 0) / 100).toLocaleString('fr-CA', {style:'currency',currency:'CAD'});
  const displayValue = (key, value) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    if (['amount_cents','paid_cents','hourly_rate_cents'].includes(key)) return money(value);
    if (key === 'status') return ({draft:'Brouillon',issued:'Émise',cancelled:'Annulée'})[value] || value;
    if (key === 'account_type') return ({operating:'Exploitation',trust:'Fidéicommis'})[value] || value;
    return value;
  };
  function renderTable(rows, columns) {
    const wrap=node('div',undefined,'scroll'), table=node('table'), head=node('thead'), hr=node('tr');
    columns.forEach(c=>hr.append(node('th',labels[c]||c))); head.append(hr); table.append(head);
    const body=node('tbody');
    rows.forEach(row=>{ const tr=node('tr'); columns.forEach(c=>tr.append(node('td',displayValue(c,row[c])))); body.append(tr); });
    table.append(body);wrap.append(table);return wrap;
  }
  function empty(text){return node('p',text,'muted');}
  function accountForm() {
    const panel = node('div', undefined, 'finance-account-panel');
    const toggle = node('button', 'Ajouter un compte');
    toggle.type = 'button';
    toggle.className = 'secondary';
    toggle.setAttribute('aria-expanded', 'false');
    const form = document.createElement('form');
    form.hidden = true;
    form.style.marginTop = '1rem';
    const title = node('label', 'Nom du compte');
    const name = document.createElement('input');
    name.type = 'text'; name.required = true; name.maxLength = 150;
    name.placeholder = 'Ex. Compte bancaire d’exploitation';
    title.append(document.createElement('br'), name);
    const typeLabel = node('label', 'Type de compte');
    const type = document.createElement('select');
    type.required = true;
    for (const [value, label] of [['operating','Exploitation'],['trust','Fidéicommis']]) {
      const option = document.createElement('option');
      option.value = value; option.textContent = label; type.append(option);
    }
    typeLabel.append(document.createElement('br'), type);
    const currency = node('p', 'Devise : CAD');
    const save = node('button', 'Enregistrer le compte');
    save.type = 'submit';
    const feedback = node('p', '', 'muted');
    feedback.setAttribute('role', 'status');
    form.append(title, document.createElement('br'), typeLabel, currency, save, feedback);
    toggle.addEventListener('click', () => {
      form.hidden = !form.hidden;
      toggle.setAttribute('aria-expanded', String(!form.hidden));
      if (!form.hidden) name.focus();
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const accountName = name.value.trim();
      if (!accountName || accountName.length > 150) {
        feedback.textContent = 'Veuillez saisir un nom valide (150 caractères maximum).';
        return;
      }
      save.disabled = true;
      feedback.textContent = 'Enregistrement en cours…';
      try {
        const {data, error} = await context.supabase.rpc('madic_finance_create_account', {
          p_space_id: context.spaceId,
          p_name: accountName,
          p_account_type: type.value,
          p_currency: 'CAD'
        });
        if (error) throw error;
        if (!data) throw Error('Aucun identifiant de compte retourné.');
        form.reset();
        form.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        await select('fiducie');
        setStatus('Compte financier créé avec succès.');
      } catch (error) {
        feedback.textContent = 'Création impossible : ' + (error?.message || 'Erreur inconnue');
      } finally {
        save.disabled = false;
      }
    });
    panel.append(toggle, form);
    return panel;
  }
  function modelSettings() {
    const panel=node('div',undefined,'finance-account-panel');
    const heading=node('h3','Méthode de gestion des fonds clients');
    const explanation=node('p','Sélectionnez le modèle utilisé par votre cabinet pour l’année de vérification. Ce paramètre ne déplace pas de fonds et ne modifie aucune écriture existante.','muted');
    const form=document.createElement('form');
    const yearLabel=node('label','Année de vérification ');
    const year=document.createElement('input');year.type='number';year.min='2000';year.max='2100';year.value=String(new Date().getFullYear());year.required=true;year.style.maxWidth='7rem';
    yearLabel.append(year);
    const modelLabel=node('label',' Modèle de compte client ');
    const model=document.createElement('select');
    [['model1','Modèle 1 - Tous les fonds reçus des clients passent par le compte client'],['model2','Modèle 2 - Fonds non gagnés et non facturés dans le compte client']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;model.append(o);});
    modelLabel.append(model);
    const save=node('button','Enregistrer le modèle');save.type='submit';
    const feedback=node('p','', 'muted');feedback.setAttribute('role','status');
    const caution=node('p','Le modèle choisi doit être appliqué uniformément pendant l’année de vérification, sous réserve des règles actuellement applicables. La modification d’une année comportant des écritures est bloquée.','muted');
    form.append(yearLabel,document.createElement('br'),modelLabel,document.createElement('br'),save,feedback);
    async function load() {
      feedback.textContent='Chargement du modèle…';
      const {data,error}=await context.supabase.from('madic_finance_models').select('model').eq('space_id',context.spaceId).eq('audit_year',Number(year.value)).maybeSingle();
      if(error){feedback.textContent='Paramètres indisponibles : '+error.message;save.disabled=true;return;}
      save.disabled=false;
      model.value=data?.model||'model1';
      feedback.textContent=data?'Modèle enregistré pour '+year.value+'.':'Aucun modèle enregistré pour '+year.value+'.';
    }
    year.addEventListener('change',load);
    form.addEventListener('submit',async e=>{
      e.preventDefault();save.disabled=true;feedback.textContent='Enregistrement en cours…';
      try {
        const {error}=await context.supabase.rpc('madic_finance_set_model',{p_space_id:context.spaceId,p_audit_year:Number(year.value),p_model:model.value});
        if(error)throw error;
        feedback.textContent='Modèle '+(model.value==='model1'?'1':'2')+' enregistré pour '+year.value+'.';
      }catch(error){feedback.textContent='Enregistrement impossible : '+(error?.message||'Erreur inconnue');}
      finally{save.disabled=false;}
    });
    panel.append(heading,explanation,form,caution);
    load();
    return panel;
  }
  async function select(key){
    current=key;
    const requestId = ++requestNumber;
    document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===key)));
    const entry=sections.find(s=>s[0]===key), body=$('section-body');
    $('section-title').textContent=entry[1];body.replaceChildren(empty('Chargement…'));
    if(!context.supabase || !context.spaceId){body.replaceChildren(empty('Connexion au cabinet requise. Voir les instructions du fichier JavaScript.'));setStatus('Intégration au portail existant nécessaire.',true);return;}

    try{
      const {data,error}=await context.supabase.from(entry[2]).select(entry[3].join(',')).eq('space_id',context.spaceId).limit(100).order(['factures','paiements','rapports'].includes(key)?'issued_on':key==='temps'?'activity_date':key==='compta'?'transaction_date':'created_at',{ascending:false});
      if(error)throw error;
      if(current!==key || requestId!==requestNumber)return;
      body.replaceChildren();
      if (key === 'fiducie') {
        body.append(modelSettings());
        body.append(node('p', 'Comptes d’exploitation et comptes en fidéicommis de votre cabinet. La création d’un compte ici ne réalise aucune opération bancaire.', 'muted'));
        body.append(accountForm());
      }
      if (key === 'paiements' || key === 'rapports') {
        const invoices = data || [];
        const valid = invoices.filter(i => i.status !== 'cancelled');
        const paid = valid.reduce((n,i) => n + Number(i.paid_cents || 0), 0);
        const billed = valid.reduce((n,i) => n + Math.round(Number(i.amount_cents || 0) * (1 + Number(i.tax_rate || 0))), 0);
        const summary = node('div',undefined,'finance-summary');
        for (const [label,value] of [['Factures consultées',String(invoices.length)],['Paiements cumulés déclarés',money(paid)],['Montants HT des factures actives',money(valid.reduce((n,i)=>n+Number(i.amount_cents||0),0))]]) {
          const card=node('div',undefined,'finance-summary-card');card.append(node('span',label),node('strong',value));summary.append(card);
        }
        body.append(summary);
        body.append(empty('Ces montants proviennent des factures du cabinet (100 dernières au maximum). Les paiements représentent des cumuls enregistrés, et non un journal de transactions ni un rapprochement bancaire.'));
        if (key === 'rapports') body.append(empty('Rapport de consultation uniquement : aucune attestation comptable ou fiscale n’est produite.'));
        if (key === 'paiements') body.append(node('a','Ouvrir la facturation pour enregistrer les paiements','finance-action-link'));
        if (key === 'paiements') body.lastChild.href='facturation-cric.html';
      }
      body.append(data?.length?renderTable(data,entry[3]):empty('Aucune donnée enregistrée pour ce cabinet.'));
      if ((data?.length || 0) === 100) body.append(empty('Affichage limité aux 100 enregistrements les plus récents.'));

      setStatus('Consultation - '+(data?.length||0)+' ligne(s) affichée(s).');
    }catch(e){if(requestId!==requestNumber)return;body.replaceChildren(empty('Impossible de charger les données : '+(e?.message||'Erreur inconnue')));setStatus('Vérifiez les autorisations Supabase et le contexte du cabinet.',true);}
  }
  sections.forEach(([key,title])=>{const b=node('button',title);b.type='button';b.dataset.tab=key;b.setAttribute('aria-selected',String(key===current));b.addEventListener('click',()=>select(key));$('tabs').append(b);});
  $('cabinet').textContent=context.spaceName||context.spaceId||'Non sélectionné';
  (async () => {
    try {
      if (!window.MADIC_CONFIG?.url || !window.MADIC_CONFIG?.anonKey || !window.getMadicSupabase) throw Error('Configuration Supabase manquante.');
      const db = window.getMadicSupabase();
      const {data:auth,error:authError}=await db.auth.getUser();
      if (authError || !auth?.user) { location.replace('connexion-cric.html'); return; }
      const {data:spaces,error:spaceError}=await db.from('madic_cric_spaces').select('id,name,access_status').eq('owner_user_id',auth.user.id).limit(1);
      if(spaceError) throw spaceError;
      const space=spaces?.[0];
      if(!space || space.access_status!=='active') throw Error('Aucun espace CRIC actif accessible.');
      const {data:allowed,error:permissionError}=await db.rpc('madic_can_manage_cric_space',{p_space_id:space.id});
      if(permissionError) throw permissionError;
      if(allowed!==true) throw Error('Accès financier non autorisé pour ce cabinet.');
      context.supabase=db;context.spaceId=space.id;context.spaceName=space.name;
      $('cabinet').textContent=space.name;
      await select(current);
    } catch(e) {setStatus(e?.message || 'Accès impossible.',true);$('section-body').replaceChildren(empty('Accès aux données financières indisponible.'));}
  })();
})();

/* MADIC : navigation CRIC uniforme. Icones Heroicons identiques au tableau de bord. */
(() => {
  "use strict";
  const init = () => {
    const sidebar = document.querySelector(".madic-unified-sidebar");
    if (!sidebar || !sidebar.querySelector(".madic-unified-brand small")?.textContent.includes("Espace professionnel")) return;
    const nav = sidebar.querySelector("nav");
    if (!nav) return;
    const iconBase = "https://raw.githubusercontent.com/tailwindlabs/heroicons/v2.2.0/optimized/24/outline/";
    const items = [
      ["cric-dashboard.html", "Vue d’ensemble", "squares-2x2", ""],
      ["gestion-clients-cric.html", "Clients", "users", "madic-v2-group-start"],
      ["gestion-dossiers-cric.html", "Outils CRIC", "folder-open", ""],
      ["messagerie-cric.html", "Messagerie", "chat-bubble-left-right", "madic-v2-group-start"],
      ["rendez-vous-cric.html", "Rendez-vous", "calendar-days", ""],
      ["demandes-documents-cric.html", "Documents", "document-text", ""],
      ["echeances-cric.html", "Échéances", "calendar-days", ""],
      ["facturation-cric.html", "Facturation", "receipt-percent", "madic-v2-group-start"],
      ["finances-cric.html", "Finances", "banknotes", ""],
      ["profil-professionnel-cric.html", "Mon profil professionnel", "identification", ""]
    ];
    const current = (location.pathname.split("/").pop() || "cric-dashboard").replace(/\.html$/, "") + ".html";
    const fragment = document.createDocumentFragment();
    for (const [href, label, iconName, group] of items) {
      const link = document.createElement("a");
      link.href = href;
      link.dataset.madicPage = href;
      if (group) link.className = group;
      if (current === href) link.setAttribute("aria-current", "page");
      const holder = document.createElement("span");
      holder.setAttribute("aria-hidden", "true");
      const img = document.createElement("img");
      img.className = "madic-heroicon";
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.loading = "eager";
      img.decoding = "async";
      img.src = iconBase + iconName + ".svg";
      holder.appendChild(img);
      link.append(holder, document.createTextNode(label));
      fragment.appendChild(link);
    }
    nav.replaceChildren(fragment);
    const brand = sidebar.querySelector(".madic-unified-monogram");
    if (brand) {
      const logo = document.createElement("img");
      logo.src = "img/logo-madic.svg";
      logo.alt = "Logo MADIC";
      brand.replaceChildren(logo);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();

/* MADIC bilingual RCIC workspace. UI-only: no Supabase calls, no mutation of business data. */
(() => {
  'use strict';
  const dictionary = {"Espace professionnel":"Professional workspace","NAVIGATION":"NAVIGATION","Vue d’ensemble":"Overview","Clients":"Clients","Outils CRIC":"RCIC tools","Messagerie":"Messages","Rendez-vous":"Appointments","Documents":"Documents","Échéances":"Deadlines","Facturation":"Invoicing","Finances":"Finances","Mon profil professionnel":"My professional profile","Espace sécurisé MADIC":"Secure MADIC workspace","Mon espace":"My space","Aller au contenu principal":"Skip to main content","Gestion des clients CRIC":"RCIC client management","Demandes de documents →":"Document requests →","Vérification de votre espace…":"Checking your workspace…","← Retour à mon espace CRIC":"← Back to my RCIC workspace","Déconnexion":"Sign out","Clients associés":"Associated clients","Dans votre espace professionnel":"In your professional workspace","Dossiers associés":"Associated cases","Pour les clients autorisés":"For authorized clients","Résultats de recherche":"Search results","Clients affichés ci-dessous":"Clients shown below","Répertoire des clients":"Client directory","Inviter un client":"Invite a client","Importer une liste":"Import a list","Dossiers CRIC":"RCIC cases","RÉPERTOIRE CLIENTS":"CLIENT DIRECTORY","Uniquement les clients autorisés dans votre espace CRIC.":"Only clients authorized in your RCIC workspace.","Nom":"Name","Courriel":"Email","Téléphone":"Phone","Dossiers":"Cases","Factures":"Invoices","Action":"Action","Actions":"Actions","INVITATIONS INDIVIDUELLES":"INDIVIDUAL INVITATIONS","Inviter un client dans votre cabinet":"Invite a client to your practice","Une invitation privée lie le client exclusivement à votre espace CRIC.":"A private invitation links the client exclusively to your RCIC workspace.","Vérification du profil professionnel…":"Checking professional profile…","Courriel du client":"Client email","Envoyer l’invitation par courriel":"Send invitation by email","Lien personnel (copie de secours)":"Personal link (backup copy)","Copier le lien":"Copy link","Le courriel est envoyé automatiquement par MADIC PORTAIL. L’invitation est personnelle et valable pendant 7 jours.":"The email is sent automatically by MADIC PORTAIL. The personal invitation is valid for 7 days.","IMPORTATION GROUPÉE":"BULK IMPORT","Importer des invitations clients (CSV / Excel)":"Import client invitations (CSV / Excel)","Modèle Excel MADIC :":"MADIC Excel template:","Télécharger le modèle Excel à remplir (.xlsx)":"Download the Excel template (.xlsx)","Fichier de clients (colonne courriel ou email obligatoire)":"Client file (email column required)","Seuls les courriels sont utilisés pour les invitations. Les autres colonnes ne sont pas transmises.":"Only email addresses are used for invitations. Other columns are not transmitted.","Vérification du profil professionnel avant les invitations…":"Checking professional profile before invitations…","Vérification":"Verification","Résultat":"Result","Confirmer et envoyer les invitations":"Confirm and send invitations","Annuler / effacer":"Cancel / clear","Outils professionnels CRIC":"Professional RCIC tools","ESPACE PROFESSIONNEL CRIC":"RCIC PROFESSIONAL WORKSPACE","Préparez vos formulaires, contrats et analyses à partir des dossiers autorisés de votre cabinet.":"Prepare forms, contracts and analyses using authorized cases in your practice.","CENTRE DE TRAVAIL · CRIC":"RCIC WORKSPACE","Vos dossiers. Vos outils. Un seul espace.":"Your cases. Your tools. One workspace.","Sélectionnez un client, puis son dossier pour préparer les documents et les analyses professionnelles.":"Select a client and their case to prepare professional documents and analyses.","Clients autorisés":"Authorized clients","Associés à votre cabinet":"Associated with your practice","Dossiers accessibles":"Accessible cases","Dans votre espace CRIC":"In your RCIC workspace","Dossier sélectionné":"Selected case","Aucun":"None","Pour préparer les outils":"To prepare tools","Formulaires IRCC":"IRCC forms","Contrats":"Contracts","Analyse préliminaire":"Preliminary analysis","Suivi Kanban des dossiers":"Kanban case tracking","Centre des outils professionnels":"Professional tools center","Sélectionnez un client et son dossier pour préparer vos documents de travail. Les résultats doivent être vérifiés et approuvés par le consultant avant toute utilisation.":"Select a client and case to prepare working documents. The consultant must review and approve results before use.","Client associé au cabinet":"Client associated with the practice","Sélectionner un client":"Select a client","Dossier":"Case","Sélectionner un dossier":"Select a case","1. Formulaires IRCC automatisés":"1. Automated IRCC forms","Préparation des renseignements à partir du profil du client. Les PDF officiels ne sont pas générés à ce stade.":"Prepare information from the client profile. Official PDFs are not generated at this stage.","Formulaire IRCC":"IRCC form","Autre formulaire-à définir":"Other form—to be determined","Préparer la fiche de renseignements":"Prepare information sheet","OUTILS CRIC · GESTION CONTRACTUELLE":"RCIC TOOLS · CONTRACT MANAGEMENT","2. Contrats":"2. Contracts","Choisissez le contrat adapté à votre mandat. Les informations du client et du dossier sélectionnés seront transmises à la page de préparation.":"Choose the contract for your mandate. The selected client and case information will be passed to the preparation page.","PREMIÈRE CONSULTATION":"INITIAL CONSULTATION","Contrat de consultation initiale":"Initial consultation agreement","Encadrez la première consultation, son objet, les honoraires et les conditions de prestation.":"Set out the initial consultation, its purpose, fees and terms of service.","Préparer le contrat":"Prepare contract","MANDAT DE REPRÉSENTATION":"REPRESENTATION MANDATE","Contrat de services professionnels":"Professional services agreement","Définissez les services convenus, les responsabilités, les honoraires et les modalités du mandat.":"Define agreed services, responsibilities, fees and mandate terms.","Sélectionnez un client et un dossier ci-dessus avant d’ouvrir un contrat.":"Select a client and case above before opening a contract.","Les clauses, les honoraires et les signatures doivent être vérifiés et validés avant transmission au client.":"Clauses, fees and signatures must be checked and approved before sending to the client.","3. Résultat de l’analyse préliminaire":"3. Preliminary analysis results","Rédigez une évaluation professionnelle provisoire, sans décision automatique d’admissibilité.":"Draft a provisional professional assessment, without an automatic eligibility decision.","Programme ou voie d’immigration":"Immigration program or pathway","Appréciation préliminaire":"Preliminary assessment","Analyse à compléter":"Analysis pending","Éléments favorables à vérifier":"Favorable factors to verify","Renseignements supplémentaires requis":"Additional information required","Critères potentiellement non satisfaits":"Potentially unmet criteria","Constats et critères examinés":"Findings and criteria reviewed","Documents manquants et prochaines étapes":"Missing documents and next steps","Préparer le compte rendu":"Prepare report","Messagerie sécurisée":"Secure messaging","Échangez avec vos clients et retrouvez vos conversations et pièces jointes dans un espace sécurisé.":"Communicate with clients and access conversations and attachments in a secure workspace.","Vérification des autorisations…":"Checking permissions…","Conversations":"Conversations","Client du cabinet":"Practice client","Choisir un client…":"Choose a client…","Objet":"Subject","Nouvelle conversation":"New conversation","Actualiser":"Refresh","Sélectionnez une conversation":"Select a conversation","Votre message":"Your message","Envoyer":"Send","Rendez-vous et consultations":"Appointments and consultations","Gérez vos créneaux et les demandes de vos clients.":"Manage your availability and client requests.","Gestion des clients →":"Client management →","Vérification des accès…":"Checking access…","Publier une disponibilité":"Publish availability","Date de début (heure de Montréal)":"Start date (Montreal time)","Heure de début (heure de Montréal)":"Start time (Montreal time)","Choisir une heure":"Choose a time","Durée de consultation":"Consultation duration","1 heure":"1 hour","2 heures":"2 hours","3 heures":"3 hours","4 heures":"4 hours","5 heures":"5 hours","6 heures":"6 hours","7 heures":"7 hours","8 heures":"8 hours","Fin calculée automatiquement (heure de Montréal)":"Automatically calculated end (Montreal time)","Type de consultation":"Consultation type","Visioconférence":"Video call","En personne":"In person","Lieu ou lien (facultatif)":"Location or link (optional)","Publier le créneau":"Publish time slot","AGENDA PROFESSIONNEL":"PROFESSIONAL CALENDAR","Calendrier des consultations":"Consultation calendar","Visualisez les créneaux et les réservations, puis sélectionnez une journée pour publier une disponibilité.":"View time slots and bookings, then select a day to publish availability.","Aujourd'hui":"Today","Disponible":"Available","Demandé":"Requested","Confirmé":"Confirmed","Fermé":"Closed","Lun":"Mon","Mar":"Tue","Mer":"Wed","Jeu":"Thu","Ven":"Fri","Sam":"Sat","Dim":"Sun","Mes disponibilités":"My availability","Les nouveaux créneaux commencent à l’heure juste. Les anciens rendez-vous conservent leurs horaires.":"New slots start on the hour. Existing appointments retain their scheduled times.","Début":"Start","Fin":"End","Type":"Type","État":"State","Réservations et demandes":"Bookings and requests","Client":"Client","Statut":"Status","Gestion documentaire du client":"Client document management","← Retour à la gestion des clients":"← Back to client management","Choisissez un dossier, examinez les pièces reçues et suivez les documents demandés.":"Choose a case, review received files and track requested documents.","Chargement…":"Loading…","Étape 1 · Dossier":"Step 1 · Case","Choisir le client et le dossier":"Choose client and case","+ Demander une nouvelle pièce au client":"+ Request a new document from the client","Cette demande apparaîtra dans l'espace du client.":"This request will appear in the client's workspace.","Document demandé":"Requested document","Instructions":"Instructions","Date limite (facultatif)":"Due date (optional)","Envoyer la demande":"Send request","+ Envoyer un document au client":"+ Send a document to the client","Fichier à transmettre (PDF, JPG ou PNG, 10 Mo maximum)":"File to send (PDF, JPG or PNG, 10 MB maximum)","Nom du document (facultatif)":"Document name (optional)","Envoyer le document":"Send document","Étape 2 · Vérification":"Step 2 · Review","Documents reçus":"Received documents","Téléchargez et évaluez chaque document. En cas de refus, précisez le motif qui sera visible par le client.":"Download and review each document. If rejected, provide a reason visible to the client.","Fichier":"File","Reçu le":"Received on","Évaluation":"Assessment","Motif du refus":"Reason for rejection","Étape 3 · Suivi":"Step 3 · Tracking","Demandes envoyées":"Sent requests","Demandes concernant uniquement le dossier sélectionné. Le statut d'une demande est distinct de l'évaluation d'un fichier.":"Requests for the selected case only. Request status is separate from file assessment.","Pièce demandée":"Requested item","Date limite":"Due date","Mettre à jour":"Update","Échéances de mon cabinet":"Practice deadlines","← Mon espace CRIC":"← My RCIC workspace","Échéances et rappels":"Deadlines and reminders","Suivez les dates importantes de vos dossiers et les actions à réaliser.":"Track important case dates and required actions.","Vérification de votre cabinet…":"Checking your practice…","Ajouter une échéance":"Add a deadline","Dossier *":"Case *","Description de l’échéance *":"Deadline description *","Date limite *":"Due date *","Enregistrer l'échéance":"Save deadline","Mes échéances":"My deadlines","Description":"Description","Date":"Date","Situation":"Status","Les échéances sont affichées dans votre espace CRIC. Vérifiez régulièrement vos dates limites et les notifications applicables.":"Deadlines are shown in your RCIC workspace. Regularly check due dates and relevant notifications.","Facturation de mon cabinet":"Practice invoicing","Vérification de votre accès…":"Checking your access…","Paiements Stripe Connect":"Stripe Connect payments","Connectez le compte Stripe de votre cabinet pour recevoir directement les paiements de vos clients.":"Connect your practice's Stripe account to receive client payments directly.","Vérification de la connexion Stripe…":"Checking Stripe connection…","Connecter mon compte Stripe":"Connect my Stripe account","Créer une facture":"Create an invoice","Client *":"Client *","Dossier (facultatif)":"Case (optional)","Aucun dossier":"No cases","Nom du cabinet *":"Practice name *","Adresse du cabinet":"Practice address","Numéros de taxes (si applicables)":"Tax numbers (if applicable)","Logo du cabinet (PNG ou JPG, max. 100 Ko)":"Practice logo (PNG or JPG, max. 100 KB)","Lignes de facturation":"Invoice line items","Quantité":"Quantity","Prix unitaire (CAD)":"Unit price (CAD)","Montant":"Amount","+ Ajouter une ligne":"+ Add a line","Sous-total : 0,00 $":"Subtotal: $0.00","Taux total de taxes applicable (%)":"Total applicable tax rate (%)","Date d'échéance":"Due date","Notes":"Notes","Créer la facture":"Create invoice","Mes factures":"My invoices","Numéro":"Number","Émission":"Issued","Total":"Total","Payé":"Paid","Gestion financière CRIC":"RCIC financial management","Gestion financière du cabinet CRIC":"RCIC practice financial management","Temps et honoraires · Facturation · Paiements · Fidéicommis · Comptabilité · Rapports":"Time and fees · Invoicing · Payments · Trust accounts · Accounting · Reports","Cabinet :":"Practice:","Non sélectionné":"Not selected","Initialisation…":"Initializing…","Retour à mon espace professionnel CRIC":"Back to my RCIC professional workspace","Temps et honoraires":"Time and fees","Ces renseignements identifient votre cabinet dans les invitations à vos clients.":"This information identifies your practice in client invitations.","Renseignements du cabinet":"Practice information","Les champs marqués d’un astérisque sont obligatoires. Vos informations sont enregistrées dans votre espace professionnel.":"Fields marked with an asterisk are required. Your information is saved in your professional workspace.","Nom déclaré à l’inscription CRIC":"Name provided during RCIC registration","Courriel professionnel déclaré à l’inscription":"Professional email provided during registration","Prénom *":"First name *","Nom *":"Last name *","Titre professionnel *":"Professional title *","Numéro de permis CRIC *":"RCIC licence number *","Nom de l’entreprise *":"Business name *","Site Web de l’entreprise (facultatif)":"Business website (optional)","Téléphone professionnel *":"Business phone *","Adresse professionnelle du cabinet":"Professional practice address","Numéro civique *":"Street number *","Rue *":"Street *","Bureau, suite ou local (facultatif)":"Office, suite or unit (optional)","Ville *":"City *","Province, État ou district *":"Province, state or district *","Code postal (facultatif)":"Postal code (optional)","Pays *":"Country *","Sélectionner un pays":"Select a country","Enregistrer":"Save","Annuler":"Cancel","Fermer":"Close","Continuer":"Continue","Confirmer":"Confirm","Refuser":"Decline","Supprimer":"Delete","Modifier":"Edit","Voir":"View","Télécharger":"Download","En attente":"Pending","Annulé":"Cancelled","Annulée":"Cancelled","Accepté":"Accepted","Acceptée":"Accepted","Rejeté":"Rejected","Rejetée":"Rejected","Validé":"Approved","Validée":"Approved","Approuvé":"Approved","Approuvée":"Approved","Oui":"Yes","Non":"No","Aucun résultat":"No results","Aucune donnée":"No data","Aucun client":"No clients","Aucun rendez-vous":"No appointments","En cours":"In progress","Terminé":"Completed","Terminée":"Completed","Envoyé":"Sent","Envoyée":"Sent","Brouillon":"Draft","Enregistrer les modifications":"Save changes","Profil mis à jour":"Profile updated","© MAD Immigration Canadienne · Portail sécurisé":"© MAD Immigration Canadienne · Secure portal","© MADIC · Plateforme professionnelle":"© MADIC · Professional platform","Île de l’Ascension":"Ascension Island","Andorre":"Andorra","Émirats arabes unis":"United Arab Emirates","Afghanistan":"Afghanistan","Antigua-et-Barbuda":"Antigua & Barbuda","Anguilla":"Anguilla","Albanie":"Albania","Arménie":"Armenia","Angola":"Angola","Antarctique":"Antarctica","Argentine":"Argentina","Samoa américaines":"American Samoa","Autriche":"Austria","Australie":"Australia","Aruba":"Aruba","Îles Åland":"Åland Islands","Azerbaïdjan":"Azerbaijan","Bosnie-Herzégovine":"Bosnia & Herzegovina","Barbade":"Barbados","Bangladesh":"Bangladesh","Belgique":"Belgium","Burkina Faso":"Burkina Faso","Bulgarie":"Bulgaria","Bahreïn":"Bahrain","Burundi":"Burundi","Bénin":"Benin","Saint-Barthélemy":"St. Barthélemy","Bermudes":"Bermuda","Brunei":"Brunei","Bolivie":"Bolivia","Pays-Bas caribéens":"Caribbean Netherlands","Brésil":"Brazil","Bahamas":"Bahamas","Bhoutan":"Bhutan","Île Bouvet":"Bouvet Island","Botswana":"Botswana","Biélorussie":"Belarus","Belize":"Belize","Canada":"Canada","Îles Cocos":"Cocos (Keeling) Islands","Congo-Kinshasa":"Congo - Kinshasa","République centrafricaine":"Central African Republic","Congo-Brazzaville":"Congo - Brazzaville","Suisse":"Switzerland","Côte d’Ivoire":"Côte d’Ivoire","Îles Cook":"Cook Islands","Chili":"Chile","Cameroun":"Cameroon","Chine":"China","Colombie":"Colombia","Île Clipperton":"Clipperton Island","Costa Rica":"Costa Rica","Cuba":"Cuba","Cap-Vert":"Cape Verde","Curaçao":"Curaçao","Île Christmas":"Christmas Island","Chypre":"Cyprus","Tchéquie":"Czechia","Allemagne":"Germany","Diego Garcia":"Diego Garcia","Djibouti":"Djibouti","Danemark":"Denmark","Dominique":"Dominica","République dominicaine":"Dominican Republic","Algérie":"Algeria","Ceuta et Melilla":"Ceuta & Melilla","Équateur":"Ecuador","Estonie":"Estonia","Égypte":"Egypt","Sahara occidental":"Western Sahara","Érythrée":"Eritrea","Espagne":"Spain","Éthiopie":"Ethiopia","Union européenne":"European Union","zone euro":"Eurozone","Finlande":"Finland","Fidji":"Fiji","Îles Malouines":"Falkland Islands","Micronésie":"Micronesia","Îles Féroé":"Faroe Islands","France":"France","Gabon":"Gabon","Royaume-Uni":"United Kingdom","Grenade":"Grenada","Géorgie":"Georgia","Guyane française":"French Guiana","Guernesey":"Guernsey","Ghana":"Ghana","Gibraltar":"Gibraltar","Groenland":"Greenland","Gambie":"Gambia","Guinée":"Guinea","Guadeloupe":"Guadeloupe","Guinée équatoriale":"Equatorial Guinea","Grèce":"Greece","Géorgie du Sud-et-les Îles Sandwich du Sud":"South Georgia & South Sandwich Islands","Guatemala":"Guatemala","Guam":"Guam","Guinée-Bissau":"Guinea-Bissau","Guyana":"Guyana","R.A.S. chinoise de Hong Kong":"Hong Kong SAR China","Îles Heard-et-MacDonald":"Heard & McDonald Islands","Honduras":"Honduras","Croatie":"Croatia","Haïti":"Haiti","Hongrie":"Hungary","Îles Canaries":"Canary Islands","Indonésie":"Indonesia","Irlande":"Ireland","Israël":"Israel","Île de Man":"Isle of Man","Inde":"India","Territoire britannique de l’océan Indien":"British Indian Ocean Territory","Irak":"Iraq","Iran":"Iran","Islande":"Iceland","Italie":"Italy","Jersey":"Jersey","Jamaïque":"Jamaica","Jordanie":"Jordan","Japon":"Japan","Kenya":"Kenya","Kirghizstan":"Kyrgyzstan","Cambodge":"Cambodia","Kiribati":"Kiribati","Comores":"Comoros","Saint-Christophe-et-Niévès":"St. Kitts & Nevis","Corée du Nord":"North Korea","Corée du Sud":"South Korea","Koweït":"Kuwait","Îles Caïmans":"Cayman Islands","Kazakhstan":"Kazakhstan","Laos":"Laos","Liban":"Lebanon","Sainte-Lucie":"St. Lucia","Liechtenstein":"Liechtenstein","Sri Lanka":"Sri Lanka","Liberia":"Liberia","Lesotho":"Lesotho","Lituanie":"Lithuania","Luxembourg":"Luxembourg","Lettonie":"Latvia","Libye":"Libya","Maroc":"Morocco","Monaco":"Monaco","Moldavie":"Moldova","Monténégro":"Montenegro","Saint-Martin":"St. Martin","Madagascar":"Madagascar","Îles Marshall":"Marshall Islands","Macédoine du Nord":"North Macedonia","Mali":"Mali","Myanmar (Birmanie)":"Myanmar (Burma)","Mongolie":"Mongolia","R.A.S. chinoise de Macao":"Macao SAR China","Îles Mariannes du Nord":"Northern Mariana Islands","Martinique":"Martinique","Mauritanie":"Mauritania","Montserrat":"Montserrat","Malte":"Malta","Maurice":"Mauritius","Maldives":"Maldives","Malawi":"Malawi","Mexique":"Mexico","Malaisie":"Malaysia","Mozambique":"Mozambique","Namibie":"Namibia","Nouvelle-Calédonie":"New Caledonia","Niger":"Niger","Île Norfolk":"Norfolk Island","Nigeria":"Nigeria","Nicaragua":"Nicaragua","Pays-Bas":"Netherlands","Norvège":"Norway","Népal":"Nepal","Nauru":"Nauru","Niue":"Niue","Nouvelle-Zélande":"New Zealand","Oman":"Oman","Panama":"Panama","Pérou":"Peru","Polynésie française":"French Polynesia","Papouasie-Nouvelle-Guinée":"Papua New Guinea","Philippines":"Philippines","Pakistan":"Pakistan","Pologne":"Poland","Saint-Pierre-et-Miquelon":"St. Pierre & Miquelon","Îles Pitcairn":"Pitcairn Islands","Porto Rico":"Puerto Rico","Territoires palestiniens":"Palestinian Territories","Portugal":"Portugal","Palaos":"Palau","Paraguay":"Paraguay","Qatar":"Qatar","régions éloignées de l’Océanie":"Outlying Oceania","La Réunion":"Réunion","Roumanie":"Romania","Serbie":"Serbia","Russie":"Russia","Rwanda":"Rwanda","Arabie saoudite":"Saudi Arabia","Îles Salomon":"Solomon Islands","Seychelles":"Seychelles","Soudan":"Sudan","Suède":"Sweden","Singapour":"Singapore","Sainte-Hélène":"St. Helena","Slovénie":"Slovenia","Svalbard et Jan Mayen":"Svalbard & Jan Mayen","Slovaquie":"Slovakia","Sierra Leone":"Sierra Leone","Saint-Marin":"San Marino","Sénégal":"Senegal","Somalie":"Somalia","Suriname":"Suriname","Soudan du Sud":"South Sudan","Sao Tomé-et-Principe":"São Tomé & Príncipe","Salvador":"El Salvador","Saint-Martin (partie néerlandaise)":"Sint Maarten","Syrie":"Syria","Eswatini":"Eswatini","Tristan da Cunha":"Tristan da Cunha","Îles Turques-et-Caïques":"Turks & Caicos Islands","Tchad":"Chad","Terres australes françaises":"French Southern Territories","Togo":"Togo","Thaïlande":"Thailand","Tadjikistan":"Tajikistan","Tokelau":"Tokelau","Timor oriental":"Timor-Leste","Turkménistan":"Turkmenistan","Tunisie":"Tunisia","Tonga":"Tonga","Turquie":"Türkiye","Trinité-et-Tobago":"Trinidad & Tobago","Tuvalu":"Tuvalu","Taïwan":"Taiwan","Tanzanie":"Tanzania","Ukraine":"Ukraine","Ouganda":"Uganda","Îles mineures éloignées des États-Unis":"U.S. Outlying Islands","Nations Unies":"United Nations","États-Unis":"United States","Uruguay":"Uruguay","Ouzbékistan":"Uzbekistan","État de la Cité du Vatican":"Vatican City","Saint-Vincent-et-les Grenadines":"St. Vincent & Grenadines","Venezuela":"Venezuela","Îles Vierges britanniques":"British Virgin Islands","Îles Vierges des États-Unis":"U.S. Virgin Islands","Viêt Nam":"Vietnam","Vanuatu":"Vanuatu","Wallis-et-Futuna":"Wallis & Futuna","Samoa":"Samoa","pseudo-accents":"Pseudo-Accents","pseudo-bidi":"Pseudo-Bidi","Kosovo":"Kosovo","Yémen":"Yemen","Mayotte":"Mayotte","Afrique du Sud":"South Africa","Zambie":"Zambia","Zimbabwe":"Zimbabwe","région indéterminée":"Unknown Region","Le fichier sera accessible dans l’espace du client, sous « Historique et évaluations de mes documents », pour le dossier sélectionné ci-dessus.":"The file will be available in the client workspace under “History and assessments of my documents” for the selected case.","La fin est calculée automatiquement à partir du début et de la durée choisie. Le lien ou lieu est communiqué au client après confirmation. Aucun lien Teams n'est créé automatiquement.":"The end time is calculated automatically from the start and selected duration. The link or location is shared with the client after confirmation. No Teams link is created automatically.","Le logo est enregistré dans chaque nouvelle facture. Sélectionnez-le de nouveau pour les factures suivantes.":"The logo is saved in each new invoice. Select it again for subsequent invoices.","Saisissez le taux applicable à votre situation. MADIC ne détermine pas les obligations fiscales de votre cabinet.":"Enter the rate applicable to your situation. MADIC does not determine your practice’s tax obligations.","Modèles 1 et 2 disponibles dans Fidéicommis. Les paramètres du modèle et les comptes peuvent être enregistrés. Les écritures financières restent en lecture seule. Les rapports et paiements affichent des données de consultation, sans rapprochement bancaire.":"Models 1 and 2 are available under Trust accounts. Model settings and accounts can be saved. Financial entries remain read-only. Reports and payments display information for review, without bank reconciliation.","Le nom complet et le courriel proviennent de votre inscription CRIC. Vérifiez la répartition prénom/nom lors du premier remplissage.":"Your full name and email come from your RCIC registration. Check the first and last name fields when completing this form for the first time.","Renseignez les champs ci-dessous. L’ancienne adresse est conservée jusqu’à votre premier enregistrement.":"Complete the fields below. The previous address is retained until you save for the first time.","Préparez des invitations à partir d'un fichier CSV, XLSX ou XLS. Aucun client n'est créé automatiquement : chaque personne doit accepter son invitation personnelle.":"Prepare invitations from a CSV, XLSX or XLS file. No client is created automatically: each person must accept their personal invitation.",". Remplissez l’onglet « Clients » avec les courriels des personnes à inviter, puis importez le fichier ci-dessous. Seuls les courriels servent à envoyer les invitations.":". Fill in the “Clients” sheet with the email addresses of people to invite, then import the file below. Only email addresses are used to send invitations.","IMM 5476-Recours aux services d’un représentant":"IMM 5476 – Use of a Representative","IMM 0008-Demande générique pour le Canada":"IMM 0008 – Generic Application Form for Canada","IMM 5406-Renseignements additionnels sur la famille":"IMM 5406 – Additional Family Information","IMM 5669-Antécédents / Déclaration":"IMM 5669 – Schedule A: Background / Declaration","Gestion financière CRIC | MADIC":"RCIC financial management | MADIC","Échéances de mon cabinet | MADIC":"My practice deadlines | MADIC","Les modifications de votre profil professionnel ont été enregistrées avec succès.":"Changes to your professional profile have been saved successfully.","Le paiement par Portail MADIC n'est pas encore activé : cette option ne déclenche aucun encaissement.":"Payments through MADIC Portail are not yet enabled: this option does not collect payments.","Recevez un virement par courriel ou téléphone":"Receive an e-transfer by email or phone","Choisissez les moyens de paiement acceptés par votre cabinet. Ils seront repris automatiquement dans vos contrats.":"Choose the payment methods accepted by your practice. They will automatically appear in your contracts.","Courriel ou numéro pour recevoir les virements":"Email address or phone number for e-transfers","Lors d’une modification, le logo déjà enregistré est conservé si vous ne sélectionnez pas de nouveau fichier.":"When editing, the saved logo is retained unless you select a new file.","Adresse complète (générée automatiquement)":"Full address (generated automatically)","Vos modifications ne sont enregistrées qu’après confirmation.":"Your changes are only saved after confirmation."};
  Object.assign(dictionary, {
    "Espace chargé. Les données sont soumises aux autorisations Supabase.": "Workspace loaded. Data is subject to Supabase permissions.",
    "Outils de préparation disponibles. Aucun document n’est automatiquement enregistré.": "Preparation tools available. No document is saved automatically.",
    "Messagerie du cabinet chargée.": "Practice messaging loaded.",
    "Dernière vérification automatique": "Last automatic check",
    "Rechercher une conversation": "Search conversations",
    "Nom du client ou objet...": "Client name or subject...",
    "Conversation générale": "General conversation",
    "Disponibilités et réservations actualisées.": "Availability and bookings updated.",
    "Notifications de rendez-vous": "Appointment notifications",
    "Aucune notification non lue.": "No unread notifications.",
    "Nouvelle demande de rendez-vous": "New appointment request",
    "Demandes chargées.": "Requests loaded.",
    "Choisissez un dossier, examinez les pièces reçues et suivez les documents demandés.": "Choose a case, review received files and track requested documents.",
    "Téléchargez et évaluez chaque document. En cas de refus, précisez le motif qui sera visible par le client.": "Download and review each document. If rejected, provide a reason visible to the client.",
    "Documents du dossier": "Case documents",
    "document(s) reçu(s).": "document(s) received.",
    "Ex. Date limite de transmission": "E.g. submission deadline",
    "Compte Stripe créé. Configuration ou vérification en attente.": "Stripe account created. Setup or verification pending.",
    "Continuer la configuration Stripe": "Continue Stripe setup",
    "Aucune donnée enregistrée pour ce cabinet.": "No data recorded for this practice.",
    "Profil enregistré. Vous pouvez le modifier.": "Profile saved. You can edit it.",
    "Ces renseignements identifient votre cabinet dans les invitations à vos clients.": "This information identifies your practice in invitations to clients.",
    "Le nom complet et le courriel proviennent de votre inscription CRIC. Vérifiez la répartition prénom/nom lors du premier remplissage.": "Your full name and email come from your RCIC registration. Check the first and last name fields when filling out the form for the first time.",
    "Choisir un fichier": "Choose a file",
    "Aucun fichier choisi": "No file selected",
    "Fidéicommis": "Trust accounting",
    "Comptabilité": "Accounting",
    "Rapports": "Reports",
    "Paiements": "Payments",
    "Cabinet": "Practice",
    "Temps et honoraires": "Time and fees",
    "Aucune donnée enregistrée pour ce cabinet.": "No data recorded for this practice."
  });
  const key = 'madic_ui_language';
  let lang = 'fr';
  try { lang = localStorage.getItem(key) === 'en' ? 'en' : 'fr'; } catch (_) {}
  const normalized = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const reverse = new Map();
  Object.entries(dictionary).forEach(([fr, en]) => {
    if (fr !== en && !reverse.has(normalized(en))) reverse.set(normalized(en), fr);
  });
  const originals = new WeakMap();
  const rendered = new WeakMap();
  const originalAttrs = new WeakMap();
  const renderedAttrs = new WeakMap();
  const attrs = ['placeholder', 'title', 'aria-label'];
  const ignored = node => !!node.parentElement?.closest('script,style,code,pre,textarea,[contenteditable="true"],.madic-lang-controls');
  const patterns = [
    [/^Nouvelle demande de rendez-vous\s*-\s*/i, 'New appointment request - '],
    [/^Dernière vérification automatique\s*:/i, 'Last automatic check:'],
    [/^Documents du dossier\s*:/i, 'Case documents:'],
    [/^Espace professionnel\s*:/i, 'Professional workspace:'],
    [/^Espace de facturation du cabinet\s*:/i, 'Practice invoicing workspace:'],
    [/^Cabinet\s*:/i, 'Practice:'],
    [/^\d+\s+document\(s\) reçu\(s\)\./i, s => s.replace('document(s) reçu(s)', 'document(s) received')],
    [/^\d+\s+échéances?\s*·/i, s => s.replace(/échéances?/, 'deadlines').replace(/dépassée?s?/, 'overdue').replace(/à traiter dans les/, 'due within the').replace(/prochains jours/, 'next days')],
    [/^\d+\s+ligne\(s\) affichée\(s\)\./i, s => s.replace('ligne(s) affichée(s)', 'row(s) displayed')],
    [/^Consultation\s*-\s*\d+\s+ligne\(s\) affichée\(s\)/i, s => s.replace('ligne(s) affichée(s)', 'row(s) displayed')]
  ];
  function toFrench(value) {
    const text = normalized(value);
    return reverse.get(text) || value;
  }
  function toEnglish(value) {
    const text = normalized(value);
    if (Object.prototype.hasOwnProperty.call(dictionary, text)) return dictionary[text];
    for (const [pattern, replacement] of patterns) {
      if (pattern.test(text)) return text.replace(pattern, replacement);
    }
    return value;
  }
  function localized(original) {
    const trimmed = normalized(original);
    const output = lang === 'en' ? toEnglish(trimmed) : toFrench(trimmed);
    if (output === trimmed) return original;
    const start = original.indexOf(trimmed);
    return start < 0 ? output : original.slice(0, start) + output + original.slice(start + trimmed.length);
  }
  function translateText(node) {
    if (!node?.parentElement || ignored(node)) return;
    const current = node.nodeValue;
    if (!normalized(current)) return;
    if (!originals.has(node) || rendered.get(node) !== current) originals.set(node, current);
    const next = localized(originals.get(node));
    if (next !== current) node.nodeValue = next;
    rendered.set(node, next);
  }
  function translateElement(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.matches('.madic-lang-controls button[data-lang]')) {
      el.disabled = false;
      el.removeAttribute('aria-disabled');
      el.setAttribute('aria-pressed', String(el.dataset.lang === lang));
      el.classList.toggle('madic-lang-active', el.dataset.lang === lang);
      el.setAttribute('aria-label', el.dataset.lang === 'fr' ? 'Français' : 'English');
      el.title = el.dataset.lang === 'fr' ? 'Français' : 'English';
      return;
    }
    if (ignored({parentElement:el})) return;
    let source = originalAttrs.get(el);
    let previous = renderedAttrs.get(el);
    if (!source) { source = {}; originalAttrs.set(el, source); }
    if (!previous) { previous = {}; renderedAttrs.set(el, previous); }
    for (const attr of attrs) {
      if (!el.hasAttribute(attr)) continue;
      const current = el.getAttribute(attr);
      if (!(attr in source) || previous[attr] !== current) source[attr] = current;
      const next = localized(source[attr]);
      if (next !== current) el.setAttribute(attr, next);
      previous[attr] = next;
    }
  }
  let observer;
  let scheduled = false;
  function render() {
    if (observer) observer.disconnect();
    document.documentElement.lang = lang === 'en' ? 'en-CA' : 'fr-CA';
    const root = document.body;
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) translateText(node);
      else translateElement(node);
    }
    document.querySelectorAll('.madic-lang-controls button[data-lang]').forEach(translateElement);
    if (observer) observer.observe(root, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attrs});
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; render(); });
  }
  function selectLanguage(next) {
    if (next !== 'fr' && next !== 'en') return;
    lang = next;
    try { localStorage.setItem(key, lang); } catch (_) {}
    render();
    document.dispatchEvent(new CustomEvent('madic:languagechange', {detail:{lang}}));
  }
  function init() {
    document.addEventListener('click', event => {
      const button = event.target.closest?.('.madic-lang-controls button[data-lang]');
      if (!button) return;
      event.preventDefault();
      selectLanguage(button.dataset.lang);
    }, true);
    observer = new MutationObserver(schedule);
    render();
    window.MadicCricLanguage = {set:selectLanguage, get:()=>lang, refresh:render};
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();

/* Footer commun MADIC : traduction des libellés sur les pages sans gestionnaire FR/EN. */
(function(){"use strict";function apply(lang){lang=lang==="en"?"en":"fr";document.querySelectorAll(".madic-footer [data-fr][data-en]").forEach(function(el){el.textContent=el.getAttribute("data-"+lang);});}var lang="fr";try{lang=new URLSearchParams(location.search).get("lang")||localStorage.getItem("madic-lang")||"fr";}catch(e){}apply(lang);window.addEventListener("storage",function(e){if(e.key==="madic-lang")apply(e.newValue);});})();

/* Sign out using the existing Supabase session and shared configuration. */
(()=>{'use strict';const init=()=>{const btn=document.getElementById('cricLogout');if(!btn)return;btn.addEventListener('click',async()=>{btn.disabled=true;try{const db=window.getMadicSupabase?.();if(!db)throw Error('Supabase unavailable');const {error}=await db.auth.signOut();if(error)throw error;location.href='connexion.html';}catch(e){btn.disabled=false;console.error('MADIC sign out:',e);alert(document.documentElement.lang.startsWith('en')?'Unable to sign out. Please try again.':'Déconnexion impossible. Veuillez réessayer.');}})};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();})();

/* Libelle officiel de l'en-tete : Mon espace / My space. */
(() => {
  const apply = () => {
    const link = document.querySelector('.toplinks a[data-fr="Mon espace"]');
    if (!link) return;
    const en = (() => { try { return localStorage.getItem('madic_ui_language') === 'en'; } catch (_) { return document.documentElement.lang.toLowerCase().startsWith('en'); } })();
    const expected = en ? 'My space' : 'Mon espace';
    if (link.textContent.trim() !== expected) link.textContent = expected;
    link.setAttribute('data-en', 'My space');
    link.setAttribute('data-madic-en', 'My space');
  };
  const init = () => {
    apply();
    const link = document.querySelector('.toplinks a[data-fr="Mon espace"]');
    if (link) new MutationObserver(apply).observe(link, {childList:true, characterData:true, subtree:true});
    document.querySelectorAll('.madic-lang-controls button').forEach(b => b.addEventListener('click', () => { queueMicrotask(apply); setTimeout(apply, 0); }));
    window.addEventListener('storage', apply);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
