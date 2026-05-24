import { getIn, insertAtIndex } from '../data.js';

export function getPage(fileData, id) {
  return getIn(fileData, ['pages-index', id]);
}

export function getLastPage(fileData) {
  const pages = fileData.pages ?? [];
  const id = pages[pages.length - 1];
  return id ? getPage(fileData, id) : undefined;
}

export function addPage(fileData, page) {
  const { id, index } = page;
  const pages = fileData.pages ?? [];
  const exists = pages.includes(id);

  let newPages;
  if (exists) {
    newPages = pages;
  } else if (index == null) {
    newPages = [...pages, id];
  } else {
    newPages = insertAtIndex(pages, index, [id]);
  }

  const pageData = { ...page };
  delete pageData.index;

  return {
    ...fileData,
    pages: newPages,
    'pages-index': {
      ...(fileData['pages-index'] ?? {}),
      [id]: pageData,
    },
  };
}

export function pagesSeq(fileData) {
  return Object.values(fileData['pages-index'] ?? {});
}

export function updatePage(fileData, pageId, f) {
  const pagesIndex = fileData['pages-index'] ?? {};
  if (!(pageId in pagesIndex)) return fileData;
  return {
    ...fileData,
    'pages-index': {
      ...pagesIndex,
      [pageId]: f(pagesIndex[pageId]),
    },
  };
}

export function deletePage(fileData, pageId) {
  const pages = (fileData.pages ?? []).filter((id) => id !== pageId);
  const { [pageId]: _, ...rest } = fileData['pages-index'] ?? {};
  return {
    ...fileData,
    pages,
    'pages-index': rest,
  };
}