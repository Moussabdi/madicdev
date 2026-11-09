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
