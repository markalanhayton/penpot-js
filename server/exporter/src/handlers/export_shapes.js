import { render } from '../renderer/index.js';
import { DEFAULTS, loadConfig } from '../config.js';
import { generateId, logger, sanitizeFilename } from '../util.js';
import { createZipArchive } from '../renderer/resources.js';
import { publishProgress } from '../core.js';

function groupExportsByScaleAndType(exports) {
  const groups = new Map();

  for (const exp of exports) {
    const key = `${exp.scale || 1}:${exp.type}`;
    if (!groups.has(key)) {
      groups.set(key, { scale: exp.scale || 1, type: exp.type, objects: [] });
    }
    const group = groups.get(key);
    group.objects.push({
      id: exp.objectId || exp['object-id'],
      name: sanitizeFilename(exp.name || 'export'),
      filename: sanitizeFilename(exp.name || 'export') + (DEFAULTS.EXTENSIONS[exp.type] || ''),
      suffix: exp.suffix || '',
    });
  }

  return Array.from(groups.values());
}

export async function handleExportShapes(params, config) {
  const {
    exports: exportList = [],
    pageId = params['page-id'],
    fileId = params['file-id'],
    shareId = params['share-id'],
    token = params.token,
    wait = false,
    profileId = params['profile-id'],
    name = params.name || 'export',
    isWasm = params['is-wasm'] || false,
    skipChildren = params['skip-children'] || false,
    tenant = params.tenant,
  } = params;

  logger.info('Export shapes request', {
    count: exportList.length,
    wait,
    fileId,
  });

  if (exportList.length === 1 && wait) {
    return await handleSingleExport(exportList[0], { pageId, fileId, shareId, token, isWasm, skipChildren }, config);
  }

  const groups = groupExportsByScaleAndType(exportList);

  if (groups.length === 1 && exportList.length === 1) {
    return await handleSingleExport(exportList[0], { pageId, fileId, shareId, token, isWasm, skipChildren }, config);
  }

  const allResources = [];
  let total = exportList.length;
  let done = 0;
  const resourceId = generateId();

  for (const group of groups) {
    const batchParams = {
      type: group.type,
      scale: group.scale,
      pageId,
      fileId,
      shareId,
      token,
      isWasm,
      skipChildren,
      objects: group.objects,
      config,
    };

    const results = await render(batchParams, config);

    for (const result of results) {
      allResources.push(result);
      done++;

      if (profileId && config.redisUri) {
        publishProgress(tenant, profileId, {
          type: 'export-update',
          'resource-id': resourceId,
          status: 'running',
          done,
          total,
          name: result.name,
          filename: result.filename,
          mtype: result.mtype,
        });
      }
    }
  }

  if (allResources.length === 1) {
    return allResources[0];
  }

  const zipName = sanitizeFilename(name);
  const zipResource = await createZipArchive(
    allResources.map(r => ({
      data: r.data,
      filename: r.filename,
    })),
    config,
    { name: zipName }
  );

  return {
    id: resourceId,
    name: zipName,
    filename: `${zipName}.zip`,
    mtype: DEFAULTS.MIME_TYPES.zip,
    uri: zipResource.uri,
  };
}

async function handleSingleExport(exp, context, config) {
  const {
    pageId = exp['page-id'],
    fileId = exp['file-id'],
    objectId = exp['object-id'],
    shareId = exp['share-id'],
    type = exp.type || 'png',
    scale = exp.scale || 1,
    token,
    isWasm,
    skipChildren,
  } = { ...context, ...exp };

  const renderParams = {
    type,
    scale,
    pageId,
    fileId,
    shareId,
    token,
    isWasm,
    skipChildren,
    objects: [{
      id: objectId,
      name: sanitizeFilename(exp.name || 'export'),
      filename: sanitizeFilename(exp.name || 'export') + (DEFAULTS.EXTENSIONS[type] || ''),
      suffix: exp.suffix || '',
    }],
    config,
  };

  const results = await render(renderParams, config);
  return results[0] || null;
}