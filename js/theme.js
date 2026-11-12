/**
 * Tema chiaro/scuro (ADR 0010, punto 7). Caricato nel <head> prima del CSS per evitare lampi.
 * Il volume Appunti di Pratica aggiunge ai suoi link `theme=dark|light|auto` nel frammento:
 * la scelta vale per la scheda (sessionStorage) anche passando da una pagina all'altra.
 * Senza indicazioni vale `prefers-color-scheme`.
 */
(function () {
  'use strict';
  var KEY = 'gsp:theme';
  try {
    var m = /(?:^#|&)theme=(dark|light|auto)(?:&|$)/.exec(location.hash);
    var t = m ? m[1] : sessionStorage.getItem(KEY);
    if (m) sessionStorage.setItem(KEY, t);
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
  } catch (_) { /* sessionStorage non disponibile: vale il tema di sistema */ }
})();
