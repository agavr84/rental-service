const fs = require("node:fs/promises");
const path = require("node:path");
const matter = require("gray-matter");
const { marked } = require("marked");

const root = process.cwd();
const contentDir = path.join(root, "content");
const housesDir = path.join(contentDir, "houses");
const staticDir = path.join(root, "static");
const publicDir = path.join(root, "public");
const outDir = path.join(root, process.env.OUT_DIR || "docs");
const assetsDir = path.join(outDir, "assets");

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeAttr = (value) => escapeHtml(value).replace(/\n/g, " ");

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const cleanDir = async (dir) => {
  await fs.rm(dir, { recursive: true, force: true });
  await ensureDir(dir);
};

const copyDir = async (from, to) => {
  const entries = await fs.readdir(from, { withFileTypes: true });
  await ensureDir(to);
  for (const entry of entries) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDir(source, target);
    } else if (entry.isFile()) {
      await fs.copyFile(source, target);
    }
  }
};

const formatPrice = (value) => `${Number(value).toLocaleString("ru-RU")} ₽`;

const formatExtraPrice = (extra) => {
  const base = `${formatPrice(extra.price)}`;
  const suffix = extra.note ? ` ${escapeHtml(extra.note)}` : "";
  const typeLabel = extra.priceType === "PER_BOOKING"
    ? "за бронирование"
    : extra.priceType === "PER_NIGHT"
      ? "за ночь"
      : extra.priceType === "PER_UNIT"
        ? "за штуку"
        : extra.priceType === "PER_HOUR"
          ? "за час"
          : "";
  const typeText = typeLabel ? ` ${typeLabel}` : "";
  return `${base}${typeText}${suffix}`.trim();
};

const withSiteUrl = (site, assetPath) => {
  if (!assetPath) return "";
  if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) return assetPath;
  const prefix = assetPath.startsWith("/") ? "" : "/";
  return `${site.siteUrl}${prefix}${assetPath}`;
};

const resolveOgImage = (house, site) => {
  const raw =
    house.ogImage || (Array.isArray(house.images) ? house.images[0] : null) || site.defaultOgImage;
  return withSiteUrl(site, raw);
};

const renderHead = ({ title, description, url, ogImage, basePath }) => {
  const safeTitle = escapeAttr(title);
  const safeDescription = escapeAttr(description);
  const safeUrl = escapeAttr(url);
  const safeOgImage = escapeAttr(ogImage);
  return `
    <base href="${escapeAttr(basePath)}">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${safeUrl}">
    <meta property="og:image" content="${safeOgImage}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/styles.css">
  `;
};

const renderHeader = (site) => `
  <header class="header">
    <div class="inner">
      <a href="./" class="left" aria-label="На главную">
        <div class="logo">
          <img src="logo.webp" alt="Логотип" class="logoImage">
        </div>
        <span class="brand">${escapeHtml(site.brandName)}</span>
      </a>
      <div class="right">
        <a href="${escapeAttr(site.phoneHref)}" class="phone">${escapeHtml(site.phoneLabel)}</a>
        <button type="button" class="ctaButton" data-modal-open="contact">${escapeHtml(site.ctaLabel)}</button>
      </div>
    </div>
  </header>
`;

const renderFooter = (site) => `
  <footer class="footer">
    <div class="inner">
      <a href="./" class="left" aria-label="На главную">
        <div class="logo">
          <img src="logo.webp" alt="Логотип" class="logoImage">
        </div>
        <div class="brandBlock">
          <span class="brand">${escapeHtml(site.brandName)}</span>
        </div>
      </a>
      <div class="middle">
        <span class="phone">${escapeHtml(site.phoneLabel)}</span>
        <button type="button" class="ctaButton" data-modal-open="contact">${escapeHtml(site.ctaLabel)}</button>
        <a href="${escapeAttr(site.phoneHref)}" class="phoneInline">${escapeHtml(site.phoneLabel)}</a>
      </div>
      <div class="right">
        <div class="links">
          <button type="button" class="docButton" aria-disabled="true">Политика конфиденциальности</button>
          <button type="button" class="docButton" aria-disabled="true">Публичная оферта</button>
        </div>
      </div>
    </div>
  </footer>
`;

const renderModal = (site) => `
  <div class="modal-overlay is-hidden" data-modal="contact" role="dialog" aria-modal="true" aria-label="Заявка">
    <div class="modal" role="document">
      <div class="modalHeader">
        <div>
          <p class="modalTitle">Заявка на звонок</p>
          <a href="${escapeAttr(site.phoneHref)}" class="modalPhone">${escapeHtml(site.phoneLabel)}</a>
        </div>
        <button type="button" class="closeButton" data-modal-close aria-label="Закрыть">×</button>
      </div>
      <form class="form" data-lead-form>
        <label class="field">
          <span>Имя</span>
          <input type="text" name="name" placeholder="Ваше имя" class="input">
        </label>
        <label class="field">
          <span>Телефон</span>
          <input type="tel" name="phone" placeholder="+7 (___) ___-__-__" class="input" inputmode="tel" autocomplete="tel">
        </label>
        <button type="submit" class="submitButton">Отправить</button>
        <div class="small-note" data-lead-status>Введите имя и телефон.</div>
      </form>
    </div>
  </div>
`;

const renderLayout = ({ head, header, footer, modal, body, leadEndpoint, leadSuccess }) => `
<!DOCTYPE html>
<html lang="ru">
  <head>
    ${head}
  </head>
  <body data-lead-endpoint="${escapeAttr(leadEndpoint || "")}" data-lead-success="${escapeAttr(leadSuccess || "")}">
    ${header}
    ${body}
    ${footer}
    ${modal}
    <script src="assets/site.js" defer></script>
  </body>
</html>
`;

const renderHouseCard = (house) => {
  const image = Array.isArray(house.images) && house.images[0] ? house.images[0] : "/default.webp";
  return `
    <a href="houses/${escapeAttr(house.slug)}/" class="link">
      <div class="glass-panel card cardHover">
        <div class="image" style="background-image: url('${escapeAttr(image)}')"></div>
        <div class="content">
          <div class="titleRow">
            <h3 class="text-xl font-semibold font-display">${escapeHtml(house.title)}</h3>
            <span class="badge">до ${escapeHtml(house.maxGuests)} гостей</span>
          </div>
          <p class="description">${escapeHtml(house.description)}</p>
          <div class="priceRow">
            <span class="text-lg font-semibold">${formatPrice(house.basePricePerNight)} / ${escapeHtml(house.priceUnit)}</span>
          </div>
        </div>
      </div>
    </a>
  `;
};

const renderGallery = (house) => {
  const images = Array.isArray(house.images) ? house.images : [];
  const hero = images[0] || "/default.webp";
  const thumbs = images.length ? images : [hero];
  return `
    <div class="gallery" data-gallery>
      <div class="hero">
        <img src="${escapeAttr(hero)}" alt="${escapeAttr(house.title)}" class="heroImage" data-gallery-hero>
      </div>
      <div class="thumbs">
        ${thumbs
          .map(
            (src, index) => `
          <button type="button" class="thumbButton ${index === 0 ? "thumbActive" : ""}" data-gallery-thumb data-src="${escapeAttr(src)}" aria-label="Фото ${index + 1}">
            <img src="${escapeAttr(src)}" alt="${escapeAttr(house.title)}" class="thumbImage">
          </button>
        `
          )
          .join("")}
      </div>
    </div>
  `;
};

const build = async () => {
  const site = JSON.parse(await fs.readFile(path.join(contentDir, "site.json"), "utf8"));
  const effectiveSite = {
    ...site,
    basePath: process.env.BASE_PATH || site.basePath,
    siteUrl: process.env.SITE_URL || site.siteUrl,
  };
  const extras = JSON.parse(await fs.readFile(path.join(contentDir, "extras.json"), "utf8"));

  const houseFiles = (await fs.readdir(housesDir)).filter((file) => file.endsWith(".md"));
  const houses = [];
  for (const file of houseFiles) {
    const raw = await fs.readFile(path.join(housesDir, file), "utf8");
    const parsed = matter(raw);
    const data = parsed.data || {};
    if (!data.id || !data.slug || !data.title) {
      throw new Error(`House ${file} missing required fields (id, slug, title)`);
    }
    houses.push({
      id: data.id,
      slug: data.slug,
      title: data.title,
      description: data.description || "",
      basePricePerNight: data.basePricePerNight || 0,
      maxGuests: data.maxGuests || 1,
      priceUnit: data.priceUnit || "ночь",
      type: data.type || "house",
      images: data.images || [],
      metaTitle: data.metaTitle || data.title,
      metaDescription: data.metaDescription || data.description || site.siteDescription,
      ogImage: data.ogImage || null,
      content: marked.parse(parsed.content || ""),
    });
  }

  const typeOrder = { house: 0, banya: 1 };
  houses.sort((a, b) => {
    const aOrder = typeOrder[a.type] ?? 99;
    const bOrder = typeOrder[b.type] ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.title.localeCompare(b.title, "ru");
  });

  await cleanDir(outDir);
  await ensureDir(assetsDir);

  await fs.copyFile(path.join(staticDir, "styles.css"), path.join(assetsDir, "styles.css"));
  await fs.copyFile(path.join(staticDir, "site.js"), path.join(assetsDir, "site.js"));
  await copyDir(publicDir, outDir);

  const header = renderHeader(effectiveSite);
  const footer = renderFooter(effectiveSite);
  const modal = renderModal(effectiveSite);

  const indexHead = renderHead({
    title: effectiveSite.siteTitle,
    description: effectiveSite.siteDescription,
    url: effectiveSite.siteUrl,
    ogImage: withSiteUrl(effectiveSite, effectiveSite.defaultOgImage),
    basePath: effectiveSite.basePath,
  });

  const indexBody = `
    <div class="container-shell">
      <header class="hero-panel section-block">
        <div class="hero-grid">
          <div class="hero-copy space-y-4">
            <div class="hero-kicker">${escapeHtml(effectiveSite.introTitle || "")}</div>
            <div class="hero-title">${escapeHtml(effectiveSite.introBrand || "")} ${escapeHtml(effectiveSite.introLocation || "")}</div>
            <p class="hero-subtitle">${escapeHtml(effectiveSite.introDescription || "")}</p>
            <div class="hero-actions">
              <button type="button" class="button-primary" data-modal-open="contact">Оставить заявку</button>
              <a class="button-secondary" href="${escapeAttr(effectiveSite.phoneHref || "#")}">${escapeHtml(effectiveSite.phoneLabel || "")}</a>
            </div>
          </div>
          <div class="hero-stats">
            ${
              Array.isArray(effectiveSite.introBullets)
                ? effectiveSite.introBullets
                    .map(
                      (item) => `
                <div class="stat-card">
                  <div class="stat-text">${escapeHtml(item)}</div>
                </div>
              `
                    )
                    .join("")
                : ""
            }
          </div>
        </div>
      </header>

      <section id="houses" class="section-block space-y-4">
        <div class="space-y-2">
          <h2 class="text-3xl font-semibold font-display">${escapeHtml(effectiveSite.housesTitle || "Аренда домов")}</h2>
          <p class="text-base">${escapeHtml(effectiveSite.housesSubtitle || "")}</p>
        </div>
        <div class="card-grid">
          ${houses.filter((house) => house.type === "house").map(renderHouseCard).join("")}
        </div>
      </section>

      <section id="banyas" class="section-block space-y-4">
        <div class="space-y-2">
          <h2 class="text-3xl font-semibold font-display">${escapeHtml(effectiveSite.banyasTitle || "Аренда бань")}</h2>
          <p class="text-base">${escapeHtml(effectiveSite.banyasSubtitle || "")}</p>
        </div>
        <div class="card-grid card-grid-3">
          ${houses.filter((house) => house.type === "banya").map(renderHouseCard).join("")}
        </div>
      </section>

      <section id="extras" class="section-block space-y-5">
        <h2 class="text-3xl font-semibold font-display">Дополнительные услуги</h2>
        <div class="grid gap-4 md:grid-cols-3">
          ${extras
            .map(
              (extra) => `
            <div class="glass-panel extra-card space-y-2">
              <h3 class="text-xl font-semibold font-display">${escapeHtml(extra.title)}</h3>
              <p class="text-sm">${formatExtraPrice(extra)}</p>
              ${extra.note ? `<p class="small-note">${escapeHtml(extra.note)}</p>` : ""}
            </div>
          `
            )
            .join("")}
        </div>
      </section>

      <section class="section-block space-y-4">
        <h2 class="text-3xl font-semibold font-display">${escapeHtml(effectiveSite.reasonsTitle || "")}</h2>
        ${
          Array.isArray(effectiveSite.reasons)
            ? `<div class="grid gap-4 md:grid-cols-2">
                ${effectiveSite.reasons
                  .map(
                    (item) => `
                  <div class="glass-panel p-5 rounded-3xl space-y-2">
                    <div class="text-base">${escapeHtml(item)}</div>
                  </div>
                `
                  )
                  .join("")}
              </div>`
            : ""
        }
      </section>

      <section class="glass-panel p-6 rounded-3xl section-block cta-section">
        <div class="cta-grid">
          <div class="cta-copy space-y-3">
            <div class="text-2xl font-semibold font-display">${escapeHtml(effectiveSite.ctaTitle || "")}</div>
            <div class="text-base">${escapeHtml(effectiveSite.ctaText || "")}</div>
            <a class="text-xl font-semibold cta-phone" href="${escapeAttr(effectiveSite.phoneHref || "#")}">${escapeHtml(effectiveSite.ctaPhone || "")}</a>
            <div class="space-y-2">
              <div class="text-lg font-semibold">${escapeHtml(effectiveSite.addressTitle || "")}</div>
              ${
                Array.isArray(effectiveSite.addressLines)
                  ? `<div class="space-y-2">
                      ${effectiveSite.addressLines
                        .map((line) => `<div class="text-base">${escapeHtml(line)}</div>`)
                        .join("")}
                    </div>`
                  : ""
              }
            </div>
          </div>
          ${
            effectiveSite.mapEmbedUrl
              ? `<div class="cta-map">
                  <div class="map-frame">
                    <iframe
                      src="${escapeAttr(effectiveSite.mapEmbedUrl)}"
                      width="100%"
                      height="320"
                      frameborder="0"
                      allowfullscreen
                      loading="lazy"
                      title="Карта"
                    ></iframe>
                  </div>
                </div>`
              : ""
          }
        </div>
      </section>
    </div>
  `;

  const indexHtml = renderLayout({
    head: indexHead,
    header,
    footer,
    modal,
    body: indexBody,
    leadEndpoint: effectiveSite.leadEndpoint,
    leadSuccess: effectiveSite.leadSuccessMessage,
  });

  await fs.writeFile(path.join(outDir, "index.html"), indexHtml, "utf8");

  for (const house of houses) {
    const houseDir = path.join(outDir, "houses", house.slug);
    await ensureDir(houseDir);
    const houseUrl = `${effectiveSite.siteUrl}/houses/${house.slug}/`;

    const houseHead = renderHead({
      title: house.metaTitle,
      description: house.metaDescription,
      url: houseUrl,
      ogImage: resolveOgImage(house, effectiveSite),
      basePath: effectiveSite.basePath,
    });

    const houseBody = `
      <div class="house-page">
        <div class="houseGrid">
          <div class="leftColumn">
            <h1 class="title">${escapeHtml(house.title)}</h1>
            <div class="flex gap-3 items-center">
              <p class="subtitle badge">до ${escapeHtml(house.maxGuests)} гостей</p>
              <p class="subtitle badge">${formatPrice(house.basePricePerNight)} / ${escapeHtml(house.priceUnit)}</p>
            </div>
            ${house.description ? `<p class="description">${escapeHtml(house.description)}</p>` : ""}
            ${renderGallery(house)}
            ${house.content ? `<div class="house-content">${house.content}</div>` : ""}
          </div>
          <aside class="glass-panel priceCard space-y-3 house-aside">
            <div>
              <div class="priceLabel">Стоимость за ${escapeHtml(house.priceUnit)}</div>
              <div class="priceValue">${formatPrice(house.basePricePerNight)}</div>
            </div>
            <div class="small-note">3 часа бани включены в стоимость дома.</div>
            <button type="button" class="button-primary" data-modal-open="contact">Оставить заявку</button>
          </aside>
        </div>
      </div>
    `;

    const houseHtml = renderLayout({
      head: houseHead,
      header,
      footer,
      modal,
      body: houseBody,
      leadEndpoint: effectiveSite.leadEndpoint,
      leadSuccess: effectiveSite.leadSuccessMessage,
    });

    await fs.writeFile(path.join(houseDir, "index.html"), houseHtml, "utf8");
  }

  console.log(`Static build complete: ${outDir}`);
};

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
