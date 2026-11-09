/* MADIC : pièces jointes des conversations, sans changement aux scripts de messagerie. */
(async () => {
  "use strict";
  const isClient = !!document.getElementById("clientMsgSendForm");
  const prefix = isClient ? "clientMsg" : "msg";
  const form = document.getElementById(prefix + "SendForm");
  const history = document.getElementById(prefix + "Messages");
  if (!form || !history || typeof window.getMadicSupabase !== "function")
    return;
  const db = window.getMadicSupabase();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth?.user) return;
  const uid = auth.user.id;
  const bucket = "madic-message-attachments";
  const maxSize = 10 * 1024 * 1024;
  const allowed = new Set(["application/pdf", "image/jpeg", "image/png"]);
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ".pdf,.jpg,.jpeg,.png";
  picker.id = prefix + "AttachmentFile";
  const label = document.createElement("label");
  label.htmlFor = picker.id;
  label.textContent = "Joindre un document (PDF, JPG, PNG - 10 Mo maximum)";
  const upload = document.createElement("button");
  upload.type = "button";
  upload.textContent = "Envoyer la pièce jointe";
  upload.className = "secondary";
  const info = document.createElement("small");
  info.setAttribute("role", "status");
  info.setAttribute("aria-live", "polite");
  info.style.display = "block";
  form.append(label, picker, upload, info);
  const section = document.createElement("section");
  section.className = "madic-message-attachments";
  section.style.marginTop = "1rem";
  const title = document.createElement("h3");
  title.textContent = "Pièces jointes de la conversation";
  const list = document.createElement("ul");
  const count = document.createElement("small");
  count.className = "madic-attachment-count";
  count.setAttribute("aria-live", "polite");
  const heading = document.createElement("div");
  heading.className = "madic-attachment-heading";
  heading.append(title, count);
  list.className = "madic-attachment-list";
  section.append(heading, list);
  history.insertAdjacentElement("afterend", section);
  // L'identifiant est porte par le bouton reel, meme lorsque la liste est filtree.
  // Ne jamais deduire une conversation de sa position dans la liste.
  function currentConversation() {
    const listId = isClient ? "clientMsgConversations" : "msgConversations";
    const selected = document.querySelector(
      "#" + listId + ' button[aria-current="true"]',
    );
    return selected?.dataset.conversationId || null;
  }
  function selectedClientName() {
    if (isClient) return null;
    // Le regroupement affiche seulement l'objet dans le bouton de conversation.
    // Le titre du client sélectionné est déjà affiché par le module principal.
    const name = document
      .getElementById("msgCurrentClient")
      ?.textContent?.trim();
    if (name && name !== "Client" && name !== "Sélectionnez un client")
      return name;
    return null;
  }
  function clearAttachments() {
    section.hidden = true;
    list.replaceChildren();
  }
  let busy = false,
    lastId = null;
  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const id = currentConversation();
      if (id !== lastId) clearAttachments();
      section.hidden = !id;
      if (!id) {
        lastId = null;
        list.replaceChildren();
        return;
      }
      const { data, error } = await db
        .from("madic_cric_message_attachments")
        .select("id,filename,storage_path,size_bytes,created_at,uploader_id")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      if (id !== currentConversation()) {
        clearAttachments();
        return;
      }
      list.replaceChildren();
      count.textContent =
        (data || []).length +
        " document" +
        ((data || []).length === 1 ? "" : "s");
      for (const file of data || []) {
        const li = document.createElement("li");
        li.className = "madic-attachment-item";
        const openButton = document.createElement("button");
        const downloadButton = document.createElement("button");
        openButton.type = downloadButton.type = "button";
        openButton.className = downloadButton.className = "secondary";
        openButton.textContent = "Ouvrir";
        downloadButton.textContent = "Télécharger";
        openButton.classList.add("madic-attachment-open");
        downloadButton.classList.add("madic-attachment-download");
        const sender =
          file.uploader_id === uid
            ? "Vous"
            : isClient
              ? "Consultant CRIC"
              : selectedClientName() || "Client";
        const meta = document.createElement("small");
        meta.textContent =
          "Envoyé par : " +
          sender +
          " · " +
          new Intl.DateTimeFormat("fr-CA", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "America/Toronto",
          }).format(new Date(file.created_at));
        meta.className = "madic-attachment-meta";
        const filename = document.createElement("strong");
        filename.className = "madic-attachment-filename";
        filename.textContent = file.filename;
        const size = document.createElement("small");
        size.className = "madic-attachment-size";
        size.textContent =
          Math.ceil(file.size_bytes / 1024).toLocaleString("fr-CA") + " Ko";
        const icon = document.createElement("span");
        icon.className = "madic-attachment-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = /\.pdf$/i.test(file.filename) ? "PDF" : "IMG";
        const detail = document.createElement("div");
        detail.className = "madic-attachment-detail";
        detail.append(filename, size, meta);
        const buttons = document.createElement("div");
        buttons.className = "madic-attachment-actions";
        buttons.append(openButton, downloadButton);
        async function openAttachment() {
          openButton.disabled = true;
          try {
            const { data: signed, error } = await db.storage
              .from(bucket)
              .createSignedUrl(file.storage_path, 60);
            if (error) throw error;
            if (!signed?.signedUrl)
              throw Error("Lien temporaire indisponible.");
            window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
          } catch (e) {
            info.textContent =
              "Ouverture impossible : " + (e?.message || String(e));
          } finally {
            openButton.disabled = false;
          }
        }
        async function downloadAttachment() {
          downloadButton.disabled = true;
          try {
            // Supabase Storage verifies the current user's permissions before returning bytes.
            const { data: blob, error } = await db.storage
              .from(bucket)
              .download(file.storage_path);
            if (error) throw error;
            if (!blob) throw Error("Fichier indisponible.");
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = (file.filename || "piece-jointe")
              .split(/[\\/]/)
              .pop();
            anchor.style.display = "none";
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 60000);
            info.textContent = "Téléchargement lancé : " + file.filename;
          } catch (e) {
            info.textContent =
              "Téléchargement impossible : " + (e?.message || String(e));
          } finally {
            downloadButton.disabled = false;
          }
        }
        openButton.addEventListener("click", openAttachment);
        downloadButton.addEventListener("click", downloadAttachment);
        li.append(icon, detail, buttons);
        list.append(li);
      }
      if (!data?.length) {
        const li = document.createElement("li");
        li.textContent = "Aucune pièce jointe.";
        list.append(li);
      }
      lastId = id;
    } catch (e) {
      info.textContent = "Pièces jointes : " + (e?.message || String(e));
    } finally {
      busy = false;
    }
  }
  upload.addEventListener("click", async () => {
    const file = picker.files?.[0];
    if (!file) return void (info.textContent = "Sélectionnez un fichier.");
    if (!allowed.has(file.type) || !/\.(pdf|jpe?g|png)$/i.test(file.name))
      return void (info.textContent = "Format non autorisé.");
    if (file.size > maxSize || !file.size)
      return void (info.textContent =
        "Le fichier doit mesurer entre 1 octet et 10 Mo.");
    upload.disabled = true;
    let path = null;
    try {
      const id = currentConversation();
      if (!id) throw Error("Sélectionnez une conversation.");
      const extension = file.name.split(".").pop().toLowerCase();
      path = id + "/" + crypto.randomUUID() + "." + extension;
      const { error: uploadError } = await db.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      if (id !== currentConversation())
        throw Error(
          "La conversation a change pendant le transfert. Verifiez le fichier avant de continuer.",
        );
      const { error: rowError } = await db
        .from("madic_cric_message_attachments")
        .insert({
          conversation_id: id,
          uploader_id: uid,
          filename: file.name.slice(0, 240),
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
        });
      if (rowError) throw rowError;
      picker.value = "";
      info.textContent = "Pièce jointe envoyée.";
      await refresh();
    } catch (e) {
      info.textContent = "Envoi impossible : " + (e?.message || String(e));
    } finally {
      upload.disabled = false;
    }
  });
  section.hidden = true;
  setInterval(() => {
    void refresh();
  }, 10000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void refresh();
  });
  document.addEventListener("click", (e) => {
    if (
      e.target.closest(
        "#" +
          (isClient ? "clientMsgConversations" : "msgConversations") +
          " button",
      )
    ) {
      clearAttachments();
      setTimeout(() => {
        void refresh();
      }, 250);
    }
  });
  document
    .getElementById("clientMsgCabinet")
    ?.addEventListener("change", () => {
      clearAttachments();
      setTimeout(() => {
        void refresh();
      }, 250);
    });
  setTimeout(() => {
    void refresh();
  }, 800);
})();
