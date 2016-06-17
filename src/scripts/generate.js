'use strict';

const {join} = require('path');
const fs = require('fs-extra');
const infoSymbol = require('log-symbols').info;

module.exports = function (userConfig, CWD, INPUT, OUTPUT, log) {
  const TMP = join(CWD, '.mark');

  let BEMHTML;
  try {
    BEMHTML = require(join(TMP, 'index', 'index.bemhtml.js')).BEMHTML;
  } catch (e) {
    console.error(e);
    console.log('\n');
    throw new Error(e);
  }

  log.info(`[${infoSymbol}]`, 'generating static content...');
  const i18n = require(join(INPUT, 'i18n'));
  const data = require(join(TMP, 'data'));
  const tags = getTags(data);

  log.verbose('resolve pages by langs', userConfig.langs);
  userConfig.langs.forEach(lang => {
    const normalisedContent = getContentByLang(data);
    const contentByLang = normalisedContent[lang];

    if(contentByLang) {
      const layouts = Object.keys(contentByLang);
      log.verbose('resolve pages by layouts', layouts);
      layouts.forEach(layout => {
        const contentByLayout = contentByLang[layout];

        log.verbose('check pagination for layout', layout);
        const paginate = userConfig.layouts && userConfig.layouts[layout] && userConfig.layouts[layout].paginate;
        if (paginate) {
          log.verbose(`layout '${layout}' need pagination`);
          let paginatedContent = [];
          let totalPages = calcPages(contentByLayout.length, paginate);

          for (let i = 0, curPage = 0; i < contentByLayout.length; i++) {
            i > 0 && (i % paginate == 0) && curPage++;
            paginatedContent[curPage] = (paginatedContent[curPage] || []).concat(contentByLayout[i]);
          }

          log.verbose('resove pages by paginated content', totalPages);
          paginatedContent.forEach((page, idx) => {
            const pagePath = join(OUTPUT, resolveLayoutOutputDir(layout), `index${resolvePageNum(idx)}${resolveLang(lang, userConfig)}.html`);
            log.verbose('write html to fs', pagePath);
            fs.outputFileSync(pagePath, BEMHTML.apply({
              block: 'root',
              mods: { layout },
              tags: tags,
              data: contentByLang,
              config: userConfig,
              name: page.name,
              meta: page.meta,
              layout: layout,
              i18n: i18n,
              lang: lang,
              pagination: {
                totalPages: totalPages,
                idx: idx,
                isLast: totalPages == idx + 1,
                needPagination: totalPages > 1
              },
              content: page.content
            }));
          });
        } else {
          log.verbose(`no pagination for layout '${layout}'`);
        }

        log.verbose('resolve pages by layout', layout);
        contentByLayout.forEach(page => {
          const pagePath = join(OUTPUT, resolveLayoutOutputDir(layout), `${page.name}${resolveLang(lang, userConfig)}.html`);
          log.verbose('write html to fs', pagePath);
          fs.outputFileSync(pagePath, BEMHTML.apply({
            block: 'root',
            mods: { layout },
            tags: tags,
            data: contentByLang,
            config: userConfig,
            name: page.name,
            meta: page.meta,
            layout: layout,
            i18n: i18n,
            lang: lang,
            content: page.content
          }));
        });

      });

    }

  });
}
/**
 * Resolve layout output directory.
 * Root for root ;)
 *
 * @param  {String} layout
 * @return {String}
 */
function resolveLayoutOutputDir(layout) {
  return layout === 'root' ? '' : layout;
}
/**
 * Resolve suffix by page number
 *
 * @param  {Number} id
 * @return {String}
 */
function resolvePageNum(id) {
  return id ? `-${id}` : '';
}
/**
 * Resolve suffix by lang. Default lang is first from config.langs.
 * If lang is default we shoudn't add suffix like *.en.md
 *
 * @param  {String} lang
 * @param  {Object} config
 * @return {String}
 */
function resolveLang(lang, config) {
  return lang === config.langs[0] ? '' : `.${lang}`;
}

function getTags(data) {
  return data.reduce((prev, cur) => {
    cur.meta && cur.meta.tags && cur.meta.tags.forEach(tag => {
      prev[cur.lang] = prev[cur.lang] || [];
      prev[cur.lang].indexOf(tag) < 0 && prev[cur.lang].push(tag);
    });

    return prev;
  }, {});
}
/**
 * Calculate pages for pagination
 *
 * @param  {Number} postsLength
 * @param  {Number} postsPerPage
 * @return {Number}
 */
function calcPages(postsLength, postsPerPage) {
  return +(postsLength / postsPerPage).toFixed() + (postsLength % postsPerPage ? 1 : 0);
}
/**
 * Structure content by language and layout
 *
 * @param  {Array} data
 * @return {Object} { en: { page: [item, item], post: [item, item] } }
 */
function getContentByLang(data) {
  let result = {};

  data.forEach(item => {
    const lang = item.lang || 'all';
    result[lang] || (result[lang] = {});
    result[lang][item.layout] || (result[lang][item.layout] = []);
    result[lang][item.layout].push(item);
  });

  return result;
}
