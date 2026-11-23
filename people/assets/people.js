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

    track("people_episode_play", {
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

  function bindTrackedLinks() {
    document.querySelectorAll("[data-track]").forEach(function (el) {
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

  function initEpisodeList(episodes) {
    const listEl = document.querySelector("[data-episode-list]");
    if (!listEl) return;

    const characterId = listEl.dataset.characterId;
    const publicEpisodes = episodes.filter(function (ep) {
      return (
        ep &&
        ep.status === "published" &&
        ep.visibility === "public" &&
        (!characterId || ep.characterId === characterId)
      );
    });

    if (publicEpisodes.length === 0) return;

    let order = "newest";
    const sortButtons = document.querySelectorAll("[data-sort-order]");

    function render() {
      const sorted = publicEpisodes.slice().sort(function (a, b) {
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
    if (!document.querySelector("[data-episode-list]")) return;
    try {
      const res = await fetch(MANIFEST_URL, { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data.episodes)) {
        initEpisodeList(data.episodes);
      }
    } catch (_err) {
      // Static fallback markup remains visible if manifest fetch fails.
    }
  }

  bindPlayTriggers(document);
  bindTrackedLinks();
  hydrateFromManifest();
})();
