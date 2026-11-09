(() => {
  if (
    !("serviceWorker" in navigator) ||
    (location.protocol !== "https:" &&
      location.hostname !== "localhost" &&
      location.hostname !== "127.0.0.1")
  )
    return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(new URL("sw.js", document.baseURI), {
        scope: new URL("./", document.baseURI).pathname,
      })
      .catch((error) =>
        console.warn("MADIC PWA : enregistrement impossible", error),
      );
  });
})();
