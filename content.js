(async function() {
  // Ensure the document uses UTF-8 encoding.
  (function addCharsetMeta() {
    let head = document.querySelector("head");
    if (head && !head.querySelector("meta[charset]")) {
      let meta = document.createElement("meta");
      meta.setAttribute("charset", "UTF-8");
      head.insertBefore(meta, head.firstChild);
    }
  })();

  // Helper: Resolve relative URLs using current page as base.
  function resolveUrl(url, base) {
    try {
      return new URL(url, base).href;
    } catch (e) {
      return url;
    }
  }

  // Helper: Fetch a resource and convert it to a data URL.
  async function fetchResourceAsDataURL(url) {
    try {
      let response = await fetch(url);
      if (!response.ok) return null;
      let blob = await response.blob();
      return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onloadend = function() { resolve(reader.result); };
        reader.onerror = function() { reject("Error reading blob"); };
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Error fetching resource", url, e);
      return null;
    }
  }

  // Process CSS text: inline @import rules and convert url(...) resources.
  async function processCss(cssText, baseUrl) {
    const importRegex = /@import\s+(?:url\()?['"]?(.*?)['"]?\)?\s*;/g;
    let match;
    while ((match = importRegex.exec(cssText)) !== null) {
      let importUrl = match[1].trim();
      let absoluteUrl = resolveUrl(importUrl, baseUrl);
      try {
        let resp = await fetch(absoluteUrl);
        if (resp.ok) {
          let importedCss = await resp.text();
          let processedImportedCss = await processCss(importedCss, absoluteUrl);
          cssText = cssText.replace(match[0], processedImportedCss);
        }
      } catch (e) {
        console.error("Error fetching imported CSS", absoluteUrl, e);
      }
    }
    const urlRegex = /url\(([^)]+)\)/g;
    let promises = [];
    let matches = [];
    while ((match = urlRegex.exec(cssText)) !== null) {
      matches.push({ full: match[0], url: match[1].trim().replace(/^['"]|['"]$/g, "") });
    }
    for (let m of matches) {
      let absoluteUrl = resolveUrl(m.url, baseUrl);
      if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(absoluteUrl) ||
          /\.(woff2|woff|ttf|otf)$/i.test(absoluteUrl)) {
        let p = fetchResourceAsDataURL(absoluteUrl).then(dataUrl => {
          if (dataUrl) {
            cssText = cssText.split(m.full).join(`url('${dataUrl}')`);
          } else {
            cssText = cssText.split(m.full).join(`url('${absoluteUrl}')`);
          }
        }).catch(e => {
          cssText = cssText.split(m.full).join(`url('${absoluteUrl}')`);
        });
        promises.push(p);
      } else {
        cssText = cssText.split(m.full).join(`url('${absoluteUrl}')`);
      }
    }
    await Promise.all(promises);
    return cssText;
  }

  // Process inline style attribute content.
  async function processInlineStyle(styleContent, baseUrl) {
    const urlRegex = /url\(([^)]+)\)/g;
    let promises = [];
    let matches = [];
    let match;
    while ((match = urlRegex.exec(styleContent)) !== null) {
      matches.push({ full: match[0], url: match[1].trim().replace(/^['"]|['"]$/g, "") });
    }
    for (let m of matches) {
      let absoluteUrl = resolveUrl(m.url, baseUrl);
      if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(absoluteUrl) ||
          /\.(woff2|woff|ttf|otf)$/i.test(absoluteUrl)) {
        let p = fetchResourceAsDataURL(absoluteUrl).then(dataUrl => {
          if (dataUrl) {
            styleContent = styleContent.split(m.full).join(`url('${dataUrl}')`);
          } else {
            styleContent = styleContent.split(m.full).join(`url('${absoluteUrl}')`);
          }
        }).catch(e => {
          styleContent = styleContent.split(m.full).join(`url('${absoluteUrl}')`);
        });
        promises.push(p);
      } else {
        styleContent = styleContent.split(m.full).join(`url('${absoluteUrl}')`);
      }
    }
    await Promise.all(promises);
    return styleContent;
  }

  // Inline <img> elements: convert src to data URLs.
  async function inlineImages() {
    const imgs = document.querySelectorAll("img");
    const promises = [];
    imgs.forEach(img => {
      let src = img.getAttribute("src");
      if (src && !src.startsWith("data:")) {
        let absoluteUrl = resolveUrl(src, location.href);
        let p = fetchResourceAsDataURL(absoluteUrl).then(dataUrl => {
          if (dataUrl) {
            img.setAttribute("src", dataUrl);
          } else {
            img.setAttribute("src", absoluteUrl);
          }
        });
        promises.push(p);
      }
    });
    await Promise.all(promises);
  }

  // Inline external CSS: replace <link rel="stylesheet"> with processed <style>.
  async function inlineStylesheets() {
    const links = Array.from(document.querySelectorAll("link[rel='stylesheet']"));
    const promises = links.map(async link => {
      let href = link.getAttribute("href");
      if (href) {
        let absoluteUrl = resolveUrl(href, location.href);
        try {
          let resp = await fetch(absoluteUrl);
          if (resp.ok) {
            let cssText = await resp.text();
            let processedCss = await processCss(cssText, absoluteUrl);
            let styleEl = document.createElement("style");
            styleEl.textContent = processedCss;
            link.parentNode.insertBefore(styleEl, link);
            link.parentNode.removeChild(link);
          }
        } catch (e) {
          console.error("Error inlining stylesheet:", absoluteUrl, e);
        }
      }
    });
    await Promise.all(promises);
  }

  // Process inline style attributes on all elements.
  async function processInlineStyles() {
    const elements = document.querySelectorAll("[style]");
    const promises = [];
    elements.forEach(el => {
      let styleContent = el.getAttribute("style");
      if (styleContent) {
        let p = processInlineStyle(styleContent, location.href).then(newStyle => {
          el.setAttribute("style", newStyle);
        });
        promises.push(p);
      }
    });
    await Promise.all(promises);
  }

  // Process iframes: fetch content, remove scripts, inline images & styles, and set as srcdoc.
  async function processIframes() {
    const iframes = Array.from(document.querySelectorAll("iframe"));
    const promises = iframes.map(async iframe => {
      let src = iframe.getAttribute("src");
      if (src) {
        let absoluteUrl = resolveUrl(src, location.href);
        try {
          let resp = await fetch(absoluteUrl);
          if (resp.ok) {
            let iframeHtml = await resp.text();
            let parser = new DOMParser();
            let doc = parser.parseFromString(iframeHtml, "text/html");
            doc.querySelectorAll("script").forEach(s => s.remove());
            let iframeImgs = doc.querySelectorAll("img");
            for (let img of iframeImgs) {
              let imgSrc = img.getAttribute("src");
              if (imgSrc && !imgSrc.startsWith("data:")) {
                let absoluteImgUrl = resolveUrl(imgSrc, absoluteUrl);
                let dataUrl = await fetchResourceAsDataURL(absoluteImgUrl);
                if (dataUrl) {
                  img.setAttribute("src", dataUrl);
                } else {
                  img.setAttribute("src", absoluteImgUrl);
                }
              }
            }
            let iframeElements = doc.querySelectorAll("[style]");
            for (let el of iframeElements) {
              let styleContent = el.getAttribute("style");
              if (styleContent) {
                let newStyle = await processInlineStyle(styleContent, absoluteUrl);
                el.setAttribute("style", newStyle);
              }
            }
            doc.querySelectorAll("*").forEach(el => {
              Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith("on")) {
                  el.removeAttribute(attr.name);
                }
              });
            });
            let serializer = new XMLSerializer();
            let processedHtml = serializer.serializeToString(doc);
            iframe.setAttribute("srcdoc", processedHtml);
            iframe.removeAttribute("src");
          } else {
            iframe.setAttribute("src", absoluteUrl);
          }
        } catch (e) {
          console.error("Error processing iframe:", absoluteUrl, e);
          iframe.setAttribute("src", absoluteUrl);
        }
      }
    });
    await Promise.all(promises);
  }

  // Update relative URLs for common tags.
  function updateRelativeUrls() {
    document.querySelectorAll("a, link, img").forEach(el => {
      let attr = (el.tagName.toLowerCase() === "a" || el.tagName.toLowerCase() === "link") ? "href" : "src";
      let value = el.getAttribute(attr);
      if (value && !value.startsWith("data:") && !value.startsWith("http")) {
        el.setAttribute(attr, resolveUrl(value, location.href));
      }
    });
  }

  // Remove all <script> elements.
  function removeScripts() {
    document.querySelectorAll("script").forEach(s => s.remove());
  }

  // Remove inline event handlers.
  function removeEventHandlers() {
    document.querySelectorAll("*").forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith("on")) {
          el.removeAttribute(attr.name);
        }
      });
    });
  }

  // Decode HTML entities in text nodes using a temporary <textarea>.
  function fixTextNodesWithTextarea() {
    const textarea = document.createElement("textarea");
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
      textarea.innerHTML = node.nodeValue;
      node.nodeValue = textarea.value;
    }
  }

  // Post-serialization: Replace numeric HTML entities with actual characters.
  function decodeNumericEntities(str) {
    return str.replace(/&#(\d+);/g, function(match, dec) {
      return String.fromCharCode(dec);
    });
  }

  // Run all processing steps sequentially.
  await inlineImages();
  await inlineStylesheets();
  await processInlineStyles();
  await processIframes();
  updateRelativeUrls();
  removeScripts();
  removeEventHandlers();
  fixTextNodesWithTextarea();

  let serializer = new XMLSerializer();
  let finalHtml = serializer.serializeToString(document);
  finalHtml = decodeNumericEntities(finalHtml);

  let blob = new Blob([finalHtml], { type: "text/html;charset=utf-8" });
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url;
  // Build a filename based on the current page's hostname and pathname.
  let host = location.hostname.replace(/\./g, '_');
  let path = location.pathname.replace(/\//g, '_').replace(/^_+|_+$/g, '');
  let fileName = "static_page_" + host + (path ? "_" + path : "") + ".html";
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log("Static page downloaded as static_page.html");
})();
