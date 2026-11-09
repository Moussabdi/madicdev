(() => {
"use strict";
const translations = {
 brand:["PORTAIL","PORTAL"], "nav.login":["Connexion","Sign in"], "nav.signup":["Inscription","Register"], "nav.space":["Mon espace client","My client portal"],
 eyebrow:["PORTAIL CLIENT DE VOTRE CONSULTANT","YOUR CONSULTANT’S CLIENT PORTAL"],heading:["Connexion","Sign in"],
 description:["Consultez les dossiers associés au cabinet qui vous a invité.","View the cases associated with the firm that invited you."],
 email:["Courriel","Email"],password:["Mot de passe","Password"],submit:["Se connecter","Sign in"],forgot:["Mot de passe oublié ?","Forgot password?"],
 invite:["Votre consultant vous transmet un lien d’invitation personnel.","Your consultant will send you a personal invitation link."],
 footer:["© MAD Immigration Canadienne · Portail client sécurisé","© MAD Immigration Canadienne · Secure client portal"]
};
let lang="fr";try {if(localStorage.getItem("madic_ui_language")==="en")lang="en";}catch(_){}
const pass=document.getElementById("password"),toggle=document.getElementById("password-toggle");
function render(){
 document.documentElement.lang=lang==="en"?"en-CA":"fr-CA";
 document.querySelectorAll("[data-i18n]").forEach(el=>{const v=translations[el.dataset.i18n];if(v)el.textContent=v[lang==="en"?1:0];});
 document.querySelectorAll(".madic-lang-switch [data-lang]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.lang===lang)));
 if(toggle&&pass){const show=pass.type==="password";document.getElementById("password-toggle-label").textContent=lang==="en"?(show?"Show":"Hide"):(show?"Afficher":"Masquer");toggle.setAttribute("aria-label",lang==="en"?(show?"Show password":"Hide password"):(show?"Afficher le mot de passe":"Masquer le mot de passe"));toggle.setAttribute("aria-pressed",String(!show));}
 try{localStorage.setItem("madic_ui_language",lang);}catch(_){}
}
if(toggle&&pass)toggle.addEventListener("click",()=>{pass.type=pass.type==="password"?"text":"password";render();});
document.querySelectorAll(".madic-lang-switch [data-lang]").forEach(b=>b.addEventListener("click",()=>{lang=b.dataset.lang;render();}));
render();
})();
