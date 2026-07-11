function datasetIdFromHref(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  const action = url.searchParams.get('action');
  if (action?.startsWith('mount_')) return null;

  const value = url.searchParams.get('dataset') ||
    (['edit', 'destroy'].includes(action) ? url.searchParams.get('id') : null);
  return value && /^\d+$/.test(value) ? Number(value) : null;
}

function datasetIdsFromHrefs(hrefs) {
  return [...new Set(hrefs.map(datasetIdFromHref).filter(Number.isInteger))];
}

module.exports = { datasetIdFromHref, datasetIdsFromHrefs };
