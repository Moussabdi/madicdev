(() => {
  "use strict";
  const buttons = [...document.querySelectorAll("[data-lang]")];
  function set(lang) {
    document.documentElement.lang = lang;
    document
      .querySelectorAll("[data-fr][data-en]")
      .forEach((el) => (el.textContent = el.dataset[lang]));
    buttons.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang)),
    );
    try {
      localStorage.setItem("madic_ui_language", lang);
    } catch (_) {}
  }
  buttons.forEach((b) =>
    b.addEventListener("click", () => set(b.dataset.lang)),
  );
  let lang = "fr";
  try {
    if (localStorage.getItem("madic_ui_language") === "en") lang = "en";
  } catch (_) {}
  set(lang);
})();

/* MADIC: interface provinciale, sans modification des calculs. */
/* Phone navigation only; existing authentication and business logic unchanged. */
(() => {
  const init = () => {
    const drawer = document.getElementById("madicPhoneDrawer");
    const trigger = document.querySelector(".madic-phone-trigger");
    const close = drawer?.querySelector(".madic-phone-close");
    const shade = document.querySelector(".madic-phone-shade");
    if (!drawer || !trigger || !close || !shade) return;
    const mobile = matchMedia("(max-width:900px)");
    const set = (open, restore = false) => {
      open = open && mobile.matches;
      document.body.classList.toggle("madic-phone-open", open);
      trigger.setAttribute("aria-expanded", String(open));
      shade.hidden = !open;
      drawer.inert = mobile.matches && !open;
      if (open) close.focus();
      else if (restore && mobile.matches) trigger.focus();
    };
    trigger.addEventListener("click", () => set(true));
    close.addEventListener("click", () => set(false, true));
    shade.addEventListener("click", () => set(false, true));
    drawer.addEventListener("click", (e) => {
      if (e.target.closest("a[href]")) set(false);
    });
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        document.getElementById("madicThemeOptions")?.hidden !== false &&
        document.body.classList.contains("madic-phone-open")
      )
        set(false, true);
    });
    mobile.addEventListener("change", () => set(false));
    const lang = () => {
      const en = document.documentElement.lang.startsWith("en");
      trigger.setAttribute("aria-label", en ? "Open menu" : "Ouvrir le menu");
      close.setAttribute("aria-label", en ? "Close menu" : "Fermer le menu");
    };
    new MutationObserver(lang).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    lang();
    set(false);
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

/* MADIC display preferences - UI only */
(() => {
  const init = () => {
    const root = document.documentElement,
      body = document.body,
      tools = document.querySelector(".madic-display-tools");
    if (!tools) return;
    const collapse = tools.querySelector(".madic-collapse"),
      trigger = tools.querySelector(".madic-theme-trigger"),
      menu = tools.querySelector("#madicThemeOptions"),
      choices = [...menu.querySelectorAll("button")],
      media = matchMedia("(prefers-color-scheme: dark)");
    const read = (k, d) => {
      try {
        return localStorage.getItem(k) || d;
      } catch {
        return d;
      }
    };
    const save = (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch {}
    };
    let compact = read("madic-cric-sidebar", "expanded") === "collapsed",
      theme = read("madic-admin-theme", "light");
    if (!["system", "light", "dark"].includes(theme)) theme = "light";
    let renderedLanguage;
    let renderedTheme;
    const render = () => {
      renderedLanguage = root.lang;
      const en = root.lang.startsWith("en");
      body.classList.toggle("madic-sidebar-compact", compact);
      root.dataset.madicAppearance =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      root.dataset.madicTheme = root.dataset.madicAppearance;
      const label = compact
        ? en
          ? "Expand"
          : "Développer"
        : en
          ? "Collapse"
          : "Réduire";
      collapse.querySelector("span").textContent = label;
      collapse.title = label;
      collapse.setAttribute("aria-label", label);
      collapse.setAttribute("aria-expanded", String(!compact));
      trigger.title = en ? "Appearance" : "Apparence";
      trigger.setAttribute("aria-label", trigger.title);
      choices.forEach((b, i) => {
        b.querySelector("span").textContent = (
          en ? ["System", "Light", "Dark"] : ["Système", "Clair", "Sombre"]
        )[i];
        b.setAttribute("aria-pressed", String(b.dataset.themeChoice === theme));
      });
      if (renderedTheme !== theme)
        trigger.querySelector("svg").replaceWith(
          choices
            .find((b) => b.dataset.themeChoice === theme)
            .querySelector("svg")
            .cloneNode(true),
        );
      renderedTheme = theme;
      document
        .querySelectorAll(
          "#madicPhoneDrawer nav a, #madicPhoneDrawer nav summary",
        )
        .forEach((a) => {
          a.title = a.textContent.trim();
          a.setAttribute("aria-label", a.title);
        });
    };
    const phone = matchMedia("(max-width:900px)");
    const floating = () => compact && typeof menu.showPopover === "function";
    const positionMenu = () => {
      if (!menu.matches(":popover-open")) return;
      const drawer = document.getElementById("madicPhoneDrawer");
      const anchor = trigger.getBoundingClientRect();
      const edge = phone.matches ? drawer.offsetWidth : drawer.getBoundingClientRect().right;
      menu.style.setProperty("--madic-popup-x", Math.max(8, Math.min(edge + 4, innerWidth - menu.offsetWidth - 8)) + "px");
      menu.style.setProperty("--madic-popup-y", Math.max(8, Math.min(anchor.bottom - menu.offsetHeight, innerHeight - menu.offsetHeight - 8)) + "px");
    };
    const open = (v) => {
      if (menu.hasAttribute("popover")) {
        if (menu.matches(":popover-open")) menu.hidePopover();
        menu.removeAttribute("popover");
      }
      menu.hidden = !v;
      if (v && floating()) {
        menu.setAttribute("popover", "manual");
        menu.showPopover();
        positionMenu();
      }
      trigger.setAttribute("aria-expanded", String(v));
    };
    phone.addEventListener("change", () => open(false));
    window.addEventListener("resize", positionMenu);
    document.getElementById("madicPhoneDrawer").addEventListener("scroll", positionMenu);
    new MutationObserver(() => {
      if (phone.matches && !body.classList.contains("madic-phone-open")) open(false);
    }).observe(body, {attributes:true, attributeFilter:["class"]});
    collapse.addEventListener("click", () => {
      open(false);
      compact = !compact;
      save("madic-cric-sidebar", compact ? "collapsed" : "expanded");
      render();
    });
    trigger.addEventListener("click", () => open(menu.hidden));
    choices.forEach((b) =>
      b.addEventListener("click", () => {
        theme = b.dataset.themeChoice;
        save("madic-admin-theme", theme);
        render();
        open(false);
        trigger.focus();
      }),
    );
    document.addEventListener("click", (e) => {
      if (!e.composedPath().includes(tools)) open(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !menu.hidden) {
        open(false);
        trigger.focus();
      }
    });
    media.addEventListener("change", render);
    new MutationObserver(() => {
      if (root.lang !== renderedLanguage) render();
    }).observe(root, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    window.addEventListener("storage", (e) => {
      if (["madic-cric-sidebar", "madic-admin-theme"].includes(e.key)) {
        compact = read("madic-cric-sidebar", "expanded") === "collapsed";
        theme = read("madic-admin-theme", "light");
        if (!["system", "light", "dark"].includes(theme)) theme = "light";
        render();
      }
    });
    render();
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

(() => {
 const root=document.documentElement, field=document.getElementById('madicHeaderSearch');
 const sync=()=>{const en=root.lang.startsWith('en'); field.placeholder=en?'Search this page...':'Rechercher dans cette page...'; field.setAttribute('aria-label',field.placeholder);};
 new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['lang']}); sync();
 document.getElementById('madicHeaderSearchForm').addEventListener('submit',e=>{e.preventDefault();const q=field.value.trim().toLocaleLowerCase(); if(!q)return; const target=[...document.querySelectorAll('main h1,main h2,main h3,main label,main p')].find(el=>el.textContent.toLocaleLowerCase().includes(q)); if(target){target.scrollIntoView({block:'center'});}else{field.setCustomValidity(root.lang.startsWith('en')?'No result on this page.':'Aucun résultat dans cette page.');field.reportValidity();setTimeout(()=>field.setCustomValidity(''),1500);}});
})();

 document.getElementById('logout').addEventListener('click',async()=>{try{if(!window.supabase)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';s.onload=resolve;s.onerror=reject;document.head.append(s);});const db=await window.getMadicSupabase();const {error}=await db.auth.signOut();if(error)throw error;location.assign('connexion.html');}catch(e){console.error(e);alert(document.documentElement.lang.startsWith('en')?'Sign out failed.':'La déconnexion a échoué.');}});

/* Header identity: read-only, using the existing authenticated Supabase client. */
(async () => {
  const name = document.getElementById('madicHeaderProfileName');
  const license = document.getElementById('madicHeaderProfileLicense');
  if (!name || !license) return;
  try {
    if (!window.supabase) await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.onload = resolve; script.onerror = reject;
      document.head.append(script);
    });
    const db = await window.getMadicSupabase();
    const {data: auth, error} = await db.auth.getUser();
    if (error || !auth?.user) return;
    const uid = auth.user.id;
    const {data: application, error: appError} = await db.from('madic_cric_applications').select('full_name,license_number,status').eq('user_id',uid).maybeSingle();
    if (appError) throw appError;
    const {data: profile} = await db.from('profiles').select('first_name,last_name').eq('id',uid).maybeSingle();
    const fullName = (application?.full_name || [profile?.first_name,profile?.last_name].filter(Boolean).join(' ') || auth.user.email || '').trim();
    if (!fullName) return;
    const render = () => {
      name.textContent = fullName;
      license.textContent = (document.documentElement.lang.startsWith('en') ? 'RCIC' : 'CRIC') + (application?.license_number ? ' ' + application.license_number : '');
    };
    for (const el of [name,license]) { el.removeAttribute('data-fr'); el.removeAttribute('data-en'); }
    new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    render();
  } catch (error) { console.warn('MADIC header identity:',error); }
})();
