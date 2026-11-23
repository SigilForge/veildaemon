(function () {
  "use strict";

  const MANIFEST_URL = "/people/assets/episodes.json";

  function track(eventName, payload) {
    try {
      if (window.umami && typeof window.umami.track === "function") {
        window.umami.track(eventName, payload || {});
      }
    } catch (_err) {
      // Analytics is strictly optional and never blocks interaction.
    }
  }

  function buildYoutubeEmbedUrl(videoId) {
    const cleanId = String(videoId || "").replace(/[^A-Za-z0-9_-]/g, "");
    return (
      "https://www.youtube-nocookie.com/embed/" +
      encodeURIComponent(cleanId) +
      "?rel=0&modestbranding=1&autoplay=1"
    );
  }

  function mountVideoEmbed(stageEl) {
    if (!stageEl || stageEl.dataset.mounted === "true") return;
    const videoId = stageEl.dataset.youtubeId;
    const title = stageEl.dataset.videoTitle || "Episode video";
    const episodeId = stageEl.dataset.episodeId || "";
    const characterId = stageEl.dataset.characterId || "";
    if (!videoId) return;

    const iframe = document.createElement("iframe");
    iframe.src = buildYoutubeEmbedUrl(videoId);
    iframe.title = title;
    iframe.loading = "lazy";
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allowFullscreen = true;

    stageEl.innerHTML = "";
    stageEl.appendChild(iframe);
    stageEl.dataset.mounted = "true";

    track("people_episode_open", {
      episode: episodeId,
      character: characterId,
      surface: document.body.dataset.page || "people"
    });
  }

  function bindPlayTriggers(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-play-trigger]").forEach(function (btn) {
      if (btn.dataset.bound === "true") return;
      btn.dataset.bound = "true";
      btn.addEventListener("click", function () {
        const stage = btn.closest("[data-video-stage]");
        mountVideoEmbed(stage);
      });
    });
  }

  function bindTrackedLinks(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-track]").forEach(function (el) {
      if (el.dataset.trackBound === "true") return;
      el.dataset.trackBound = "true";
      el.addEventListener("click", function () {
        track(el.dataset.track, {
          target: el.dataset.trackTarget || "",
          character: el.dataset.trackCharacter || "",
          surface: document.body.dataset.page || "people"
        });
      });
    });
  }

  function createPlayStage(ep, badgeLeft) {
    const stage = document.createElement("div");
    stage.className = "video-stage";
    stage.setAttribute("data-video-stage", "");
    stage.dataset.youtubeId = ep.youtubeId || "";
    stage.dataset.episodeId = ep.id || "";
    stage.dataset.characterId = ep.characterId || "";
    stage.dataset.videoTitle = (ep.characterName ? ep.characterName + " — " : "") + ep.title;

    const img = document.createElement("img");
    img.src = ep.thumbnail;
    img.alt = ep.thumbnailAlt || ep.title;
    img.width = 720;
    img.height = 1280;
    img.loading = "lazy";
    stage.appendChild(img);

    const btn = document.createElement("button");
    btn.className = "play-overlay";
    btn.type = "button";
    btn.setAttribute("data-play-trigger", "");
    btn.setAttribute("aria-label", "Play " + stage.dataset.videoTitle);

    const circle = document.createElement("span");
    circle.className = "play-circle";
    circle.setAttribute("aria-hidden", "true");
    circle.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v14l11-7-11-7z" /></svg>';

    const label = document.createElement("span");
    label.className = "play-label";
    label.textContent = "Play " + ep.title;

    btn.appendChild(circle);
    btn.appendChild(label);
    stage.appendChild(btn);

    const metaBar = document.createElement("div");
    metaBar.className = "episode-meta-bar";
    const leftBadge = document.createElement("span");
    leftBadge.className = "badge";
    leftBadge.textContent = badgeLeft || ("Episode " + (ep.episodeNumber || 1));
    const rightBadge = document.createElement("span");
    rightBadge.className = "badge";
    rightBadge.textContent = ep.runtime || "";
    metaBar.appendChild(leftBadge);
    if (ep.runtime) metaBar.appendChild(rightBadge);
    stage.appendChild(metaBar);

    return stage;
  }

  function hydratePanelBoxes(publicEpisodes) {
    document.querySelectorAll("[data-panel-featured]").forEach(function (box) {
      const charId = box.dataset.panelFeatured;
      const matches = publicEpisodes
        .filter(function (ep) {
          return ep.characterId === charId;
        })
        .sort(function (a, b) {
          return (b.episodeNumber || 0) - (a.episodeNumber || 0);
        });
      if (matches.length === 0) return;

      const ep = matches[0];
      const labelEl = box.querySelector("[data-panel-ep-label]");
      const titleEl = box.querySelector("[data-panel-ep-title]");
      const descEl = box.querySelector("[data-panel-ep-desc]");
      if (labelEl) {
        labelEl.textContent = "Featured episode" + (ep.runtime ? " · " + ep.runtime : "");
      }
      if (titleEl) titleEl.textContent = ep.title;
      if (descEl) descEl.textContent = ep.description;
    });
  }

  function hydrateFeaturedSlots(publicEpisodes) {
    document.querySelectorAll("[data-character-featured]").forEach(function (container) {
      const charId = container.dataset.characterFeatured;
      const matches = publicEpisodes
        .filter(function (ep) {
          return ep.characterId === charId && ep.youtubeId;
        })
        .sort(function (a, b) {
          return (b.episodeNumber || 0) - (a.episodeNumber || 0);
        });
      if (matches.length === 0) return;

      const ep = matches[0];
      const stageSlot = container.querySelector("[data-featured-stage-slot]");
      if (stageSlot) {
        const badgeLeft =
          container.dataset.badgePrefix
            ? container.dataset.badgePrefix
            : "Episode " + (ep.episodeNumber || 1);
        const playStage = createPlayStage(ep, badgeLeft);
        stageSlot.replaceWith(playStage);
        bindPlayTriggers(container);
      }

      const kickerEl = container.querySelector("[data-featured-kicker]");
      if (kickerEl && container.dataset.featuredKickerTemplate) {
        kickerEl.textContent = container.dataset.featuredKickerTemplate
          .replace("{num}", String(ep.episodeNumber || 1))
          .replace("{runtime}", ep.runtime || "");
      }

      const titleEl = container.querySelector("[data-featured-title]");
      if (titleEl) titleEl.textContent = ep.title;

      const descEl = container.querySelector("[data-featured-desc]");
      if (descEl) descEl.textContent = ep.description;

      const nativeSlot = container.querySelector("[data-featured-native-link]");
      if (nativeSlot && ep.nativeUrls && ep.nativeUrls.youtube) {
        nativeSlot.href = ep.nativeUrls.youtube;
        nativeSlot.textContent = "Watch on YouTube";
        nativeSlot.hidden = false;
        nativeSlot.setAttribute("target", "_blank");
        nativeSlot.setAttribute("rel", "noopener noreferrer");
        nativeSlot.dataset.track = "people_episode_native_click";
        nativeSlot.dataset.trackCharacter = ep.characterId;
        nativeSlot.dataset.trackTarget = "youtube-short-manifest";
        bindTrackedLinks(container);
      }
    });
  }

  function createEpisodeRow(ep) {
    const article = document.createElement("article");
    article.className = "episode-row";

    const thumbWrap = document.createElement("div");
    thumbWrap.className = "episode-row-thumb";
    const img = document.createElement("img");
    img.src = ep.thumbnail;
    img.alt = ep.thumbnailAlt || ep.title;
    img.loading = "lazy";
    img.width = 96;
    img.height = 120;
    thumbWrap.appendChild(img);

    const info = document.createElement("div");
    info.className = "episode-row-info";

    const meta = document.createElement("div");
    meta.className = "episode-row-meta";
    meta.textContent = "Episode " + ep.episodeNumber + " · " + ep.runtime + " · " + ep.publishedAt;

    const h3 = document.createElement("h3");
    h3.textContent = ep.title;

    const desc = document.createElement("p");
    desc.textContent = ep.description;

    const actions = document.createElement("div");
    actions.className = "episode-actions";

    if (ep.nativeUrls && ep.nativeUrls.youtube) {
      const watchLink = document.createElement("a");
      watchLink.className = "btn btn-subtle";
      watchLink.href = ep.nativeUrls.youtube;
      watchLink.target = "_blank";
      watchLink.rel = "noopener noreferrer";
      watchLink.textContent = "Watch on YouTube";
      watchLink.addEventListener("click", function () {
        track("people_episode_native_click", {
          episode: ep.id,
          character: ep.characterId,
          platform: "youtube"
        });
      });
      actions.appendChild(watchLink);
    }

    info.appendChild(meta);
    info.appendChild(h3);
    info.appendChild(desc);
    info.appendChild(actions);

    article.appendChild(thumbWrap);
    article.appendChild(info);
    return article;
  }

  function initEpisodeList(publicEpisodes) {
    const listEl = document.querySelector("[data-episode-list]");
    if (!listEl) return;

    const characterId = listEl.dataset.characterId;
    const matches = publicEpisodes.filter(function (ep) {
      return !characterId || ep.characterId === characterId;
    });

    const section = listEl.closest("[data-episode-list-section]");
    if (matches.length === 0) {
      if (section) section.hidden = true;
      return;
    }
    if (section) section.hidden = false;

    let order = "newest";
    const sortButtons = document.querySelectorAll("[data-sort-order]");

    function render() {
      const sorted = matches.slice().sort(function (a, b) {
        if (order === "oldest") return (a.episodeNumber || 0) - (b.episodeNumber || 0);
        return (b.episodeNumber || 0) - (a.episodeNumber || 0);
      });
      listEl.innerHTML = "";
      sorted.forEach(function (ep) {
        listEl.appendChild(createEpisodeRow(ep));
      });
    }

    sortButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        order = btn.dataset.sortOrder === "oldest" ? "oldest" : "newest";
        sortButtons.forEach(function (other) {
          other.setAttribute("aria-pressed", other === btn ? "true" : "false");
        });
        render();
      });
    });

    render();
  }

  async function hydrateFromManifest() {
    const needsManifest = Boolean(
      document.querySelector("[data-episode-list], [data-character-featured], [data-panel-featured]")
    );
    if (!needsManifest) return;
    try {
      const res = await fetch(MANIFEST_URL, { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data.episodes)) {
        const publicEpisodes = data.episodes.filter(function (ep) {
          return ep && ep.status === "published" && ep.visibility === "public";
        });
        hydratePanelBoxes(publicEpisodes);
        hydrateFeaturedSlots(publicEpisodes);
        initEpisodeList(publicEpisodes);
      }
    } catch (_err) {
      // Static fallback markup remains visible if manifest fetch fails.
    }
  }

  bindPlayTriggers(document);
  bindTrackedLinks(document);
  hydrateFromManifest();
})();
