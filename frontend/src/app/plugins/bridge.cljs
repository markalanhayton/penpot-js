;; This Source Code Form is subject to the terms of the Mozilla Public
;; License, v. 2.0. If a copy of the MPL was not distributed with this
;; file, You can obtain one at http://mozilla.org/MPL/2.0/.
;;
;; Copyright (c) KALEIDOS INC

(ns app.plugins.bridge
  (:require
   [app.common.data.macros :as dm]
   [app.plugins.register :as r]
   [app.plugins.utils :as u]
   [app.main.store :as st]
   [app.util.object :as obj]))

(defonce ^:private bridge-handlers
  "Map of bridge message type -> handler fns registered by the host application."
  (atom {}))

(defonce ^:private bridge-pending
  "Map of correlation-id -> {Promise resolve/reject} for pending bridge requests."
  (atom {}))

(defn register-bridge-handler
  "Register a handler for a bridge message type. The handler receives
  [type payload correlation-id] and should return a value that will
  be sent back as the response. If it returns nil, no response is sent.

  Call from the host application (e.g. ClojureScript side) to handle
  messages from plugins."
  [msg-type handler-fn]
  (swap! bridge-handlers assoc msg-type handler-fn))

(defn unregister-bridge-handler
  "Remove a registered bridge handler for the given message type."
  [msg-type]
  (swap! bridge-handlers dissoc msg-type))

(defn dispatch-bridge-command
  "Called from the host to dispatch a command to plugins via the bridge.
  This triggers the `bridgecommand` event on all plugins that have
  the `allow:api-bridge` permission and are listening for bridge events.

  Returns nil."
  [plugin-id type payload]
  (let [plugins     (get-in @st/state [:profile :props :plugins :data])
        plugin-ids  (keys plugins)]
    (doseq [pid plugin-ids]
      (when (r/check-permission pid "allow:api-bridge")
        (js/console.debug "Dispatching bridge command to plugin" pid type)))))

(defn- handle-bridge-send
  "Handle a bridge send request from a plugin. Looks up the registered
  handler for the message type and calls it. If no handler is found,
  returns nil."
  [plugin-id type payload correlation-id]
  (if-let [handler (get @bridge-handlers type)]
    (try
      (let [result (handler {:type type
                             :payload payload
                             :correlation-id correlation-id
                             :plugin-id plugin-id})]
        (some-> correlation-id
                (get @bridge-pending)
                (:resolve)
                (apply [result]))
        (when correlation-id
          (swap! bridge-pending dissoc correlation-id))
        result)
      (catch :default cause
        (when-let [{:keys [reject]} (get @bridge-pending correlation-id)]
          (reject cause)
          (swap! bridge-pending dissoc correlation-id))
        (js/console.error "Bridge handler error:" cause)
        nil))
    (do
      (when correlation-id
        (when-let [{:keys [reject]} (get @bridge-pending correlation-id)]
          (reject (js/Error. (dm/str "No handler registered for bridge message type: " type)))
          (swap! bridge-pending dissoc correlation-id)))
      nil)))

(defn bridge-proxy
  "Create a BridgeContext proxy object for the given plugin."
  [plugin-id]
  (obj/reify {:name "BridgeContext"}
    :$plugin {:enumerable false :get (fn [] plugin-id)}

    :bridgeSend
    (fn [type payload]
      (cond
        (not (r/check-permission plugin-id "allow:api-bridge"))
        (u/not-valid plugin-id :bridge-send "Plugin doesn't have 'allow:api-bridge' permission")

        (not (string? type))
        (u/not-valid plugin-id :bridge-send "Type must be a string")

        :else
        (js/Promise.
         (fn [resolve reject]
           (let [correlation-id (str (random-uuid))]
             (swap! bridge-pending assoc correlation-id {:resolve resolve :reject reject})
             (handle-bridge-send plugin-id type payload correlation-id))))))

    :bridgeNotify
    (fn [type payload]
      (cond
        (not (r/check-permission plugin-id "allow:api-bridge"))
        (u/not-valid plugin-id :bridge-notify "Plugin doesn't have 'allow:api-bridge' permission")

        (not (string? type))
        (u/not-valid plugin-id :bridge-notify "Type must be a string")

        :else
        (handle-bridge-send plugin-id type payload nil)))))