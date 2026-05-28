'use strict';
import { transitEncode, transitDecode } from './transit.js';
import { appStore } from './store.js';

let ws = null;
let reconnectAttempts = 0;
let reconnectTimer = null;
let messageHandlers = new Map();
let keepaliveInterval = null;
let subscribedFiles = new Set();
let subscribedTeams = new Set();
let currentFileId = null;
let currentProfileId = null;

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;
const KEEPALIVE_INTERVAL = 30000;

export function connectWS(url, authToken) {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const wsUrl = url.replace(/^http/, 'ws');
  const fullUrl = `${wsUrl}?token=${encodeURIComponent(authToken)}`;

  try {
    ws = new WebSocket(fullUrl, ['penpot']);
  } catch (err) {
    console.error('[ws] Connection error:', err);
    scheduleReconnect(url, authToken);
    return;
  }

  ws.onopen = () => {
    console.log('[ws] Connected');
    reconnectAttempts = 0;
    appStore.set('wsConnected', true);
    startKeepalive();
    resubscribeAll();
  };

  ws.onmessage = (event) => {
    try {
      const data = typeof event.data === 'string' && event.data.startsWith('[')
        ? transitDecode(event.data)
        : JSON.parse(event.data);
      handleMessage(data);
    } catch (err) {
      console.warn('[ws] Failed to parse message:', err);
    }
  };

  ws.onclose = (event) => {
    console.log('[ws] Disconnected (code:', event.code, ')');
    appStore.set('wsConnected', false);
    stopKeepalive();
    ws = null;
    if (!event.wasClean) {
      scheduleReconnect(url, authToken);
    }
  };

  ws.onerror = (err) => {
    console.error('[ws] Error:', err);
  };
}

export function disconnectWS() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopKeepalive();
  if (ws) {
    ws.close(1000, 'Client disconnect');
    ws = null;
  }
  appStore.set('wsConnected', false);
  appStore.set('onlineUsers', []);
}

export function sendWS(type, payload = {}) {
  if (ws?.readyState === WebSocket.OPEN) {
    const message = transitEncode({ type, ...payload });
    ws.send(message);
  }
}

export function onWSMessage(type, handler) {
  if (!messageHandlers.has(type)) {
    messageHandlers.set(type, new Set());
  }
  messageHandlers.get(type).add(handler);
  return () => messageHandlers.get(type)?.delete(handler);
}

export function subscribeFile(fileId) {
  subscribedFiles.add(fileId);
  currentFileId = fileId;
  sendWS('subscribe-file', { 'file-id': fileId });
}

export function unsubscribeFile(fileId) {
  subscribedFiles.delete(fileId);
  if (currentFileId === fileId) currentFileId = null;
  sendWS('unsubscribe-file', { 'file-id': fileId });
}

export function subscribeTeam(teamId) {
  subscribedTeams.add(teamId);
  sendWS('subscribe-team', { 'team-id': teamId });
}

export function sendPointerUpdate(fileId, x, y, pageId, selectedIds) {
  const msg = { 'file-id': fileId, x, y, page: pageId };
  if (selectedIds && selectedIds.length > 0) {
    msg['selected-ids'] = selectedIds;
  }
  sendWS('pointer-update', msg);
}

let selectionUpdateTimer = null;
let pendingSelectionUpdate = null;
const SELECTION_UPDATE_THROTTLE = 500;

export function sendSelectionUpdate(fileId, pageId, selectedIds) {
  pendingSelectionUpdate = { fileId, pageId, selectedIds: [...selectedIds] };
  if (!selectionUpdateTimer) {
    selectionUpdateTimer = setTimeout(() => {
      if (pendingSelectionUpdate) {
        const { fileId: fId, pageId: pId, selectedIds: sIds } = pendingSelectionUpdate;
        sendWS('selection-update', {
          'file-id': fId,
          page: pId,
          'selected-ids': sIds,
        });
        pendingSelectionUpdate = null;
      }
      selectionUpdateTimer = null;
    }, SELECTION_UPDATE_THROTTLE);
  }
}

export function joinFile(fileId) {
  subscribeFile(fileId);
}

export function leaveFile(fileId) {
  unsubscribeFile(fileId);
}

export function getConnectionState() {
  if (!ws) return 'disconnected';
  switch (ws.readyState) {
    case WebSocket.CONNECTING: return 'connecting';
    case WebSocket.OPEN: return 'connected';
    case WebSocket.CLOSING: return 'closing';
    case WebSocket.CLOSED: return 'disconnected';
    default: return 'unknown';
  }
}

function startKeepalive() {
  stopKeepalive();
  keepaliveInterval = setInterval(() => {
    sendWS('keepalive', {});
  }, KEEPALIVE_INTERVAL);
}

function stopKeepalive() {
  if (keepaliveInterval) {
    clearInterval(keepaliveInterval);
    keepaliveInterval = null;
  }
}

function resubscribeAll() {
  for (const teamId of subscribedTeams) {
    sendWS('subscribe-team', { 'team-id': teamId });
  }
  for (const fileId of subscribedFiles) {
    sendWS('subscribe-file', { 'file-id': fileId });
  }
}

function handleMessage(data) {
  const type = data?.type || data?.['~type'] || 'unknown';

  const handlers = messageHandlers.get(type);
  if (handlers) {
    for (const handler of handlers) handler(data);
  }

  const wildcardHandlers = messageHandlers.get('*');
  if (wildcardHandlers) {
    for (const handler of wildcardHandlers) handler(data);
  }

  switch (type) {
    case 'join-file':
      handleJoinFile(data);
      break;
    case 'leave-file':
      handleLeaveFile(data);
      break;
    case 'pointer-update':
      handlePointerUpdate(data);
      break;
    case 'selection-update':
      handleSelectionUpdate(data);
      break;
    case 'file-change':
      handleFileChange(data);
      break;
    case 'library-change':
      handleLibraryChange(data);
      break;
    case 'presence':
      handlePresence(data);
      break;
  }
}

const onlineUsers = new Map();
const cursorPositions = new Map();

function handleJoinFile(data) {
  const profileId = data['profile-id'] || data.profileId;
  const profileName = data['profile-name'] || data.profileName || 'Unknown';
  const fileId = data['file-id'] || data.fileId;
  if (!profileId) return;

  onlineUsers.set(profileId, {
    id: profileId,
    name: profileName,
    color: data['color'] || data.color || getCursorColor(profileId),
    fileId,
  });

  appStore.set('onlineUsers', [...onlineUsers.values()]);
}

function handleLeaveFile(data) {
  const profileId = data['profile-id'] || data.profileId;
  if (profileId) {
    onlineUsers.delete(profileId);
    cursorPositions.delete(profileId);
    appStore.set('onlineUsers', [...onlineUsers.values()]);
  }
}

function handlePointerUpdate(data) {
  const profileId = data['profile-id'] || data.profileId;
  if (!profileId) return;

  const existing = onlineUsers.get(profileId);
  const name = data['profile-name'] || data.profileName || existing?.name || 'Unknown';

  cursorPositions.set(profileId, {
    id: profileId,
    name,
    x: data.x || 0,
    y: data.y || 0,
    page: data.page || data['page-id'] || data.pageId,
    selectedIds: data['selected-ids'] || data.selectedIds || [],
    color: existing?.color || getCursorColor(profileId),
    timestamp: Date.now(),
  });

  appStore.set('cursorPositions', [...cursorPositions.values()]);
}

function handleSelectionUpdate(data) {
  const profileId = data['profile-id'] || data.profileId;
  if (!profileId) return;

  const existing = onlineUsers.get(profileId);
  const name = data['profile-name'] || data.profileName || existing?.name || 'Unknown';

  const existingCursor = cursorPositions.get(profileId);
  cursorPositions.set(profileId, {
    ...(existingCursor || {}),
    id: profileId,
    name,
    page: data.page || data['page-id'] || data.pageId,
    selectedIds: data['selected-ids'] || data.selectedIds || [],
    color: existing?.color || getCursorColor(profileId),
    timestamp: Date.now(),
  });

  appStore.set('cursorPositions', [...cursorPositions.values()]);
}

function handleFileChange(data) {
  const fileId = data['file-id'] || data.fileId;
  const changeType = data['change-type'] || data.changeType || data.type;
  const senderSessionId = data['session-id'] || data.sessionId;
  const currentSessionId = appStore.get('currentSessionId');

  if (senderSessionId && currentSessionId && senderSessionId === currentSessionId) return;

  dispatch('ws-file-change', { fileId, changeType, data });
}

function handleLibraryChange(data) {
  const fileId = data['file-id'] || data.fileId;
  dispatch('ws-library-change', { fileId, data });
}

function handlePresence(data) {
  const profileId = data['profile-id'] || data.profileId;
  if (profileId && !data.online) {
    onlineUsers.delete(profileId);
    cursorPositions.delete(profileId);
    appStore.set('onlineUsers', [...onlineUsers.values()]);
    appStore.set('cursorPositions', [...cursorPositions.values()]);
  }
}

function dispatch(type, payload) {
  appStore.dispatch(type, payload);
}

const CURSOR_COLORS = [
  '#31efb8', '#f44336', '#2196f3', '#ff9800', '#9c27b0',
  '#00bcd4', '#8bc34a', '#e91e63', '#ffc107', '#607d8b',
];

function getCursorColor(profileId) {
  let hash = 0;
  for (let i = 0; i < profileId.length; i++) {
    hash = profileId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

function scheduleReconnect(url, authToken) {
  const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  console.log(`[ws] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})...`);
  reconnectTimer = setTimeout(() => connectWS(url, authToken), delay);
}

export function getCursorPositions() {
  return [...cursorPositions.values()];
}

export function getOnlineUsers() {
  return [...onlineUsers.values()];
}