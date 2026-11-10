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

/* MADIC - Professional client page: all page logic and dependencies. */
(function(){'use strict';
const dictionary={fr:{first:'Prénom',last:'Nom',email:'Courriel',phone:'Téléphone',birth:'Date de naissance',address:'Adresse',city:'Ville',project:'Projet d’immigration',empty:'À compléter',loading:'Chargement de votre formulaire préliminaire…',missing:'Aucun formulaire préliminaire trouvé : données du profil affichées.',loaded:'Renseignements récupérés depuis votre formulaire préliminaire.',unavailable:'Formulaire préliminaire indisponible : données du profil affichées.',error:'Impossible de charger vos renseignements : ',config:'Configuration Supabase indisponible',login:'Veuillez vous connecter à votre espace client'},en:{first:'First name',last:'Last name',email:'Email',phone:'Phone',birth:'Date of birth',address:'Address',city:'City',project:'Immigration project',empty:'To be completed',loading:'Loading your preliminary intake form…',missing:'No preliminary intake form found: profile information shown.',loaded:'Information retrieved from your preliminary intake form.',unavailable:'Preliminary intake form unavailable: profile information shown.',error:'Unable to load your information: ',config:'Supabase configuration unavailable',login:'Please sign in to your client workspace'}};
let lang='fr',loadedResult=null,loadError=null;const $=id=>document.getElementById(id);const status=$('madic-client-prefill-status');
function tr(k){return dictionary[lang][k]||k}
function language(value){lang=value==='en'?'en':'fr';document.documentElement.lang=lang==='fr'?'fr-CA':'en-CA';try{localStorage.setItem('madic-language',lang)}catch(_){}document.querySelectorAll('[data-fr][data-en]').forEach(el=>{el.textContent=el.dataset[lang]});document.querySelectorAll('[data-aria-label-fr][data-aria-label-en]').forEach(el=>el.setAttribute('aria-label',el.dataset['ariaLabel'+(lang==='en'?'En':'Fr')]));document.querySelectorAll('[data-title-fr][data-title-en]').forEach(el=>el.title=el.dataset['title'+(lang==='en'?'En':'Fr')]);document.querySelectorAll('[data-lang]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.lang===lang)));render();}
function render(){const box=$('madic-client-prefill');if(!box)return;box.replaceChildren();if(loadError){status.textContent=tr('error')+loadError;return;}if(!loadedResult){status.textContent=tr('loading');return;}status.textContent=tr(loadedResult.error?'unavailable':loadedResult.intake?'loaded':'missing');const labels={prenom:'first',nom:'last',courriel:'email',telephone:'phone',naissance:'birth',adresse:'address',lieu:'city',objet:'project'};for(const [key,label] of Object.entries(labels)){const p=document.createElement('p'),b=document.createElement('strong');b.textContent=tr(label)+' : ';p.append(b,document.createTextNode(loadedResult.values?.[key]||tr('empty')));box.append(p)}}
function loadScript(url){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(Error('Unable to load '+url));document.head.append(s)})}
async function start(){try{if(!window.supabase)await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');const db=window.getMadicSupabase?.();if(!db)throw Error(tr('config'));const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user)throw Error(tr('login'));const {data:profile,error:profileError}=await db.from('profiles').select('*').eq('id',user.id).maybeSingle();if(profileError)throw profileError;loadedResult=await window.MADIC_CONTRAT_PREFILL.load(db,user.id,profile||{email:user.email});}catch(e){loadError=e?.message||String(e)}render()}
for(const btn of document.querySelectorAll('[data-lang]'))btn.addEventListener('click',()=>language(btn.dataset.lang));$('madicHeaderSignout')?.addEventListener('click',async e=>{e.preventDefault();try{await window.getMadicSupabase?.()?.auth.signOut()}finally{location.href='connexion-client-cric.html'}});try{lang=localStorage.getItem('madic-language')==='en'?'en':'fr'}catch(_){}language(lang);start();
})();
