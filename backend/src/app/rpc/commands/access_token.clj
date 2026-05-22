;; This Source Code Form is subject to the terms of the Mozilla Public
;; License, v. 2.0. If a copy of the MPL was not distributed with this
;; file, You can obtain one at http://mozilla.org/MPL/2.0/.
;;
;; Copyright (c) KALEIDOS INC

(ns app.rpc.commands.access-token
  (:require
   [app.common.schema :as sm]
   [app.common.time :as ct]
   [app.common.uuid :as uuid]
   [app.db :as db]
   [app.main :as-alias main]
   [app.rpc :as-alias rpc]
   [app.rpc.doc :as-alias doc]
   [app.rpc.quotes :as quotes]
   [app.setup :as-alias setup]
   [app.tokens :as tokens]
   [app.util.services :as sv]))

(def ^:private valid-api-scopes
  #{:api:read :api:write})

(defn- decode-row
  [row]
  (dissoc row :perms))

(defn- decode-row-api
  [row]
  (dissoc row :perms))

(defn create-access-token
  [{:keys [::db/conn] :as cfg} profile-id name expiration type scopes]
  (let [token-id   (uuid/next)
        expires-at (some-> expiration (ct/in-future))
        created-at (ct/now)
        token      (tokens/generate cfg {:iss "access-token"
                                         :uid profile-id
                                         :iat created-at
                                         :tid token-id})
        scopes     (or scopes [])
        scopes-arr (when (seq scopes)
                    (db/create-array conn "text" (mapv name scopes)))

        token      (db/insert! conn :access-token
                               {:id token-id
                                :name name
                                :token token
                                :type type
                                :profile-id profile-id
                                :created-at created-at
                                :updated-at created-at
                                :expires-at expires-at
                                :perms (db/create-array conn "text" [])
                                :scopes (or scopes-arr (db/create-array conn "text" []))})]
    (decode-row token)))

(defn repl:create-access-token
  [cfg profile-id name expiration]
  (db/tx-run! cfg create-access-token profile-id name expiration nil nil))

(def ^:private schema:create-access-token
  [:map {:title "create-access-token"}
   [:name [:string {:max 250 :min 1}]]
   [:expiration {:optional true} ::ct/duration]
   [:type {:optional true} :string]
   [:scopes {:optional true}
    [:vector [:enum "api:read" "api:write"]]]])

(sv/defmethod ::create-access-token
  {::doc/added "1.18"
   ::sm/params schema:create-access-token}
  [cfg {:keys [::rpc/profile-id name expiration type scopes]}]

  (quotes/check! cfg {::quotes/id ::quotes/access-tokens-per-profile
                      ::quotes/profile-id profile-id})

  (db/tx-run! cfg create-access-token profile-id name expiration type scopes))

(def ^:private schema:delete-access-token
  [:map {:title "delete-access-token"}
   [:id ::sm/uuid]])

(sv/defmethod ::delete-access-token
  {::doc/added "1.18"
   ::sm/params schema:delete-access-token}
  [{:keys [::db/pool]} {:keys [::rpc/profile-id id]}]
  (db/delete! pool :access-token {:id id :profile-id profile-id})
  nil)

(def ^:private schema:get-access-tokens
  [:map {:title "get-access-tokens"}])

(sv/defmethod ::get-access-tokens
  {::doc/added "1.18"
   ::sm/params schema:get-access-tokens}
  [{:keys [::db/pool]} {:keys [::rpc/profile-id]}]
  (->> (db/query pool :access-token
                 {:profile-id profile-id}
                 {:order-by [[:expires-at :asc] [:created-at :asc]]
                  :columns [:id :name :perms :type :scopes :created-at :updated-at :expires-at]})
       (mapv (fn [row] (-> row decode-row (dissoc :scopes))))))

(def ^:private schema:get-current-mcp-token
  [:map {:title "get-current-mcp-token"}])

(sv/defmethod ::get-current-mcp-token
  {::doc/added "2.15"
   ::sm/params schema:get-current-mcp-token}
  [{:keys [::db/pool]} {:keys [::rpc/profile-id ::rpc/request-at]}]
  (->> (db/query pool :access-token
                 {:profile-id profile-id
                  :type "mcp"}
                 {:order-by [[:expires-at :asc] [:created-at :asc]]
                  :columns [:token :expires-at]})
       (remove #(and (some? (:expires-at %))
                     (ct/is-after? request-at (:expires-at %))))
       (map decode-row)
       (first)))

(def ^:private schema:get-api-tokens
  [:map {:title "get-api-tokens"}])

(sv/defmethod ::get-api-tokens
  {::doc/added "2.16"
   ::sm/params schema:get-api-tokens}
  [{:keys [::db/pool]} {:keys [::rpc/profile-id]}]
  (->> (db/query pool :access-token
                 {:profile-id profile-id
                  :type "api"}
                 {:order-by [[:created-at :desc]]
                  :columns [:id :name :scopes :type :created-at :updated-at :expires-at]})
       (mapv decode-row-api)))
