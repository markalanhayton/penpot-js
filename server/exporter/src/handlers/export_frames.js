import { render } from '../renderer/index.js';
import { DEFAULTS } from '../config.js';
import { generateId, logger, sanitizeFilename } from '../util.js';
import { createZipArchive } from '../renderer/resources.js';
import { publishProgress } from '../core.js';

export async function handleExportFrames(params, config) {
  const {
    exports: exportList = [],
    fileId = params['file-id'],
    shareId = params['share-id'],
    token = params.token,
    profileId = params['profile-id'],
    name = params.name || 'export',
    isWasm = params['is-wasm'] || false,
    tenant = params.tenant,
  } = params;

  logger.info('Export frames request', {
    count: exportList.length,
    fileId,
  });

  if (exportList.length === 0) {
    throw new Error('No frames specified');
  }

  const allResources = [];
  const resourceId = generateId();
  const total = exportList.length;
  let done = 0;

  for (const frame of exportList) {
    const pageId = frame['page-id'] || frame.pageId || params['page-id'];
    const objectId = frame['object-id'] || frame.objectId || frame.id;
    const frameName = sanitizeFilename(frame.name || 'frame');

    const renderParams = {
      type: 'pdf',
      scale: 1,
      pageId,
      fileId: frame['file-id'] || frame.fileId || fileId,
      shareId,
      token,
      isWasm,
      objects: [{
        id: objectId,
        name: frameName,
        filename: `${frameName}.pdf`,
      }],
      config,
    };

    try {
      const results = await render(renderParams, config);
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
            name: frameName,
            filename: `${frameName}.pdf`,
            mtype: DEFAULTS.MIME_TYPES.pdf,
          });
        }
      }
    } catch (err) {
      logger.error('Frame render failed', { objectId, error: err.message });

      if (profileId && config.redisUri) {
        publishProgress(tenant, profileId, {
          type: 'export-update',
          'resource-id': resourceId,
          status: 'error',
          done,
          total,
          name: frameName,
          filename: `${frameName}.pdf`,
          mtype: DEFAULTS.MIME_TYPES.pdf,
          cause: err.message,
        });
      }
    }
  }

  if (allResources.length === 0) {
    throw new Error('All frame renders failed');
  }

  if (allResources.length === 1) {
    if (profileId && config.redisUri) {
      publishProgress(tenant, profileId, {
        type: 'export-update',
        'resource-id': resourceId,
        status: 'ended',
        name: allResources[0].name,
        filename: allResources[0].filename,
        'resource-uri': allResources[0].uri,
        mtype: allResources[0].mtype,
      });
    }
    return allResources[0];
  }

  const pdfResults = allResources.filter(r => r.mtype === DEFAULTS.MIME_TYPES.pdf);
  if (pdfResults.length === 1) {
    return pdfResults[0];
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

  if (profileId && config.redisUri) {
    publishProgress(tenant, profileId, {
      type: 'export-update',
      'resource-id': resourceId,
      status: 'ended',
      name: zipName,
      filename: `${zipName}.zip`,
      'resource-uri': zipResource.uri,
      mtype: DEFAULTS.MIME_TYPES.zip,
    });
  }

  return {
    id: resourceId,
    name: zipName,
    filename: `${zipName}.zip`,
    mtype: DEFAULTS.MIME_TYPES.zip,
    uri: zipResource.uri,
  };
}