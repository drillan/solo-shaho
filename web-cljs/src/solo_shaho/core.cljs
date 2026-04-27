(ns solo-shaho.core)

(defn init []
  (let [el (.getElementById js/document "app")]
    (set! (.-textContent el) "solo-shaho CLJS experiment: Phase 0 OK")))
