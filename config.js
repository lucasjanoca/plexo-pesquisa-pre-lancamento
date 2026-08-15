(function () {
  "use strict";

  if (!String.prototype.padStart) {
    String.prototype.padStart = function (targetLength, padString) {
      var text = String(this);
      var pad = String(padString || " ");
      while (text.length < targetLength) text = pad + text;
      return text.slice(-targetLength);
    };
  }

  if (!Math.imul) {
    Math.imul = function (a, b) {
      var ah = (a >>> 16) & 0xffff;
      var al = a & 0xffff;
      var bh = (b >>> 16) & 0xffff;
      var bl = b & 0xffff;
      return (al * bl + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
    };
  }

  if (window.NodeList && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach;
  }

  function appendPolyfill() {
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < arguments.length; i += 1) {
      var child = arguments[i];
      fragment.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    this.appendChild(fragment);
  }

  if (window.Element && !Element.prototype.append) Element.prototype.append = appendPolyfill;
  if (window.DocumentFragment && !DocumentFragment.prototype.append) DocumentFragment.prototype.append = appendPolyfill;

  if (window.Element && !Element.prototype.replaceChildren) {
    Element.prototype.replaceChildren = function () {
      while (this.firstChild) this.removeChild(this.firstChild);
      appendPolyfill.apply(this, arguments);
    };
  }

  var cryptoApi = window.crypto || window.msCrypto;
  if (cryptoApi && typeof cryptoApi.randomUUID !== "function") {
    cryptoApi.randomUUID = function () {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (char) {
        var random = Math.floor(Math.random() * 16);
        var value = char === "x" ? random : (random & 3) | 8;
        return value.toString(16);
      });
    };
  }

  if (typeof window.fetch !== "function" && typeof window.Promise === "function" && typeof window.XMLHttpRequest === "function") {
    window.fetch = function (url, options) {
      var settings = options || {};
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open(settings.method || "GET", url, true);

        var headers = settings.headers || {};
        Object.keys(headers).forEach(function (name) {
          xhr.setRequestHeader(name, headers[name]);
        });

        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            resolve({
              ok: xhr.status >= 200 && xhr.status < 300,
              status: xhr.status
            });
          }
        };

        xhr.onerror = function () {
          reject(new Error("network_error"));
        };

        xhr.send(settings.body || null);
      });
    };
  }
})();

window.PLEXO_CONFIG = Object.freeze({
  supabaseUrl: "https://yncspxfsvlqdnodlsosb.supabase.co",
  publishableKey: "sb_publishable_jALAHHuvrV5oxj2mugWTCQ_stD_vFyN",
  surveyVersion: 1
});
