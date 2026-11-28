(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const db = window.getMadicSupabase?.();
  async function init() {
    if (!db) {
      $("settingsStatus").textContent = "Configuration Supabase indisponible.";
      return;
    }
    const { data, error } = await db.auth.getUser();
    if (error || !data?.user) {
      location.replace("connexion.html");
      return;
    }
    const user = data.user;
    const { data: spaces, error: se } = await db
      .from("madic_cric_spaces")
      .select("id,access_status")
      .eq("owner_user_id", user.id)
      .limit(1);
    if (se || !spaces?.length || spaces[0].access_status !== "active") {
      $("settingsStatus").textContent = "Accès professionnel non autorisé.";
      return;
    }
    const { data: allowed, error: pe } = await db.rpc(
      "madic_can_manage_cric_space",
      { p_space_id: spaces[0].id },
    );
    if (pe || allowed !== true) {
      $("settingsStatus").textContent = "Accès refusé.";
      return;
    }
    $("madicSettingsMain").hidden = false;
    $("settingsAccountEmail").textContent = user.email || "";
    $("madicHeaderProfileName").textContent =
      user.user_metadata?.full_name || user.email || "Mon espace";
    const get = (key, fallback) => {
      try {
        return localStorage.getItem(key) || fallback;
      } catch (e) {
        return fallback;
      }
    };
    $("settingsLanguage").value = get(
      "madic_ui_language",
      get("madic-lang", "fr"),
    );
    $("settingsDensity").value = get("madic_settings_density", "compact");
    const translate = (lang) => {
      lang = lang === "en" ? "en" : "fr";
      document.documentElement.lang = lang === "en" ? "en-CA" : "fr-CA";
      document
        .querySelectorAll("[data-madic-fr][data-madic-en]")
        .forEach((el) => {
          if (!el.children.length)
            el.textContent = el.getAttribute("data-madic-" + lang);
        });
      document
        .querySelectorAll(
          "[data-madic-fr-placeholder][data-madic-en-placeholder]",
        )
        .forEach(
          (el) =>
            (el.placeholder = el.getAttribute(
              "data-madic-" + lang + "-placeholder",
            )),
        );
      const license = $("madicHeaderProfileLicense");
      license.textContent =
        (lang === "en" ? "RCIC" : "CRIC") +
        (license.dataset.number ? " " + license.dataset.number : "");
      document
        .querySelectorAll(".madic-footer [data-fr][data-en]")
        .forEach((el) => (el.textContent = el.getAttribute("data-" + lang)));
      document.title =
        lang === "en"
          ? "Portal settings | MADIC Portal"
          : "Paramètres du portail | MADIC Portail";
      document.querySelectorAll(".madic-lang-controls button").forEach((el) => {
        el.setAttribute("aria-pressed", String(el.dataset.lang === lang));
        el.classList.toggle("is-active", el.dataset.lang === lang);
        el.classList.toggle("madic-lang-active", el.dataset.lang === lang);
      });
    };
    translate($("settingsLanguage").value);
    void (async () => {
      try {
        const { data } = await db
          .from("madic_cric_applications")
          .select("full_name,license_number")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.full_name)
          $("madicHeaderProfileName").textContent = data.full_name;
        if (data?.license_number)
          $("madicHeaderProfileLicense").dataset.number = data.license_number;
        translate(document.documentElement.lang.startsWith("en") ? "en" : "fr");
      } catch (e) {}
    })();
    $("settingsSave").addEventListener("click", () => {
      const lang = $("settingsLanguage").value;
      try {
        localStorage.setItem("madic_ui_language", lang);
        localStorage.setItem("madic-lang", lang);
        localStorage.setItem(
          "madic_settings_density",
          $("settingsDensity").value,
        );
        $("settingsStatus").textContent =
          lang === "en"
            ? "Preferences saved in this browser."
            : "Préférences enregistrées dans ce navigateur.";
        translate(lang);
      } catch (e) {
        $("settingsStatus").textContent =
          "Impossible d’enregistrer les préférences.";
      }
    });
    document
      .querySelectorAll(".madic-lang-controls button[data-lang]")
      .forEach((btn) =>
        btn.addEventListener("click", () => {
          $("settingsLanguage").value = btn.dataset.lang;
          try {
            localStorage.setItem("madic_ui_language", btn.dataset.lang);
            localStorage.setItem("madic-lang", btn.dataset.lang);
          } catch (e) {}
          translate(btn.dataset.lang);
        }),
      );
    $("cricLogout")?.addEventListener("click", async () => {
      await db.auth.signOut();
      location.href = "connexion.html";
    });
    $("madicHeaderSearchForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = $("madicHeaderSearch").value.trim();
      if (q)
        location.href = "cric-dashboard.html?search=" + encodeURIComponent(q);
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();

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
    const floating = () => phone.matches && compact && typeof menu.showPopover === "function";
    const positionMenu = () => {
      if (!menu.matches(":popover-open")) return;
      const drawer = document.getElementById("madicPhoneDrawer");
      const anchor = trigger.getBoundingClientRect();
      const edge = drawer.getBoundingClientRect().right;
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
      if (phone.matches) open(false);
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
