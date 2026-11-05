// RBAC: доступ на основе ролей

// Статья
KB.add({
 id:"rbac",
 t:"RBAC: доступ на основе ролей",
 short:"RBAC",
 b:"sec",
 s:2,
 l:2,
 a:[
  "RBAC",
  "role-based access control",
  "ABAC",
  "роль",
  "Kubernetes RBAC",
  "Role",
  "ClusterRole",
  "RoleBinding",
  "ServiceAccount"
 ],
 x:`**RBAC (Role-Based Access Control)**: права выдаются **ролям**, а роли — пользователям или сервисам. Пользователь получает права через роль, а не напрямую.

## Плюсы и пределы
- Просто администрировать: новый сотрудник получает роль «аналитик», и всё.
- **Взрыв ролей**: когда права зависят от атрибутов («менеджер своего региона»), ролей становится сотни. Тогда переходят к **ABAC** (правила по атрибутам) или ReBAC (по связям), см. [[auth-go]].
- Сравнение со списками доступа на объект — [[acl]].

## RBAC в Kubernetes
- **Role / ClusterRole** — набор правил: какие глаголы ({{get}}, {{list}}, {{watch}}, {{create}}, {{delete}}) на какие ресурсы ({{pods}}, {{secrets}}) в namespace или во всём кластере.
- **RoleBinding / ClusterRoleBinding** связывают роль с пользователем, группой или **ServiceAccount**.
- Подам выдают отдельный ServiceAccount с минимальными правами. По умолчанию токен монтируется в под — если API Kubernetes не нужен, отключите ({{automountServiceAccountToken: false}}).
- Проверка: {{kubectl auth can-i list secrets --as system:serviceaccount:ns:sa}}.

RBAC встречается и в [[vault]] (политики), и в Confluent Kafka ([[kafka-security]]), и в Argo CD ([[argocd]]).`,
 m:[
  ["Kubernetes: Using RBAC Authorization","https://kubernetes.io/docs/reference/access-authn-authz/rbac/"],
  ["NIST: Role Based Access Control","https://csrc.nist.gov/projects/role-based-access-control"],
  ["Casbin: RBAC","https://casbin.org/docs/rbac"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("rbac",[
 [
  "Что связывает роль с ServiceAccount в Kubernetes?",
  "RoleBinding или ClusterRoleBinding",
  "Role",
  "ConfigMap",
  "NetworkPolicy",
  "Role описывает права, Binding — кому их дать."
 ],
 [
  "Когда RBAC начинает плохо работать?",
  "Когда права зависят от атрибутов, и ролей становятся сотни",
  "Когда пользователей больше 10",
  "В Kubernetes",
  "Никогда",
  "Тогда переходят к ABAC или ReBAC."
 ],
 [
  "Как проверить права ServiceAccount?",
  "kubectl auth can-i ... --as system:serviceaccount:ns:sa",
  "kubectl get roles",
  "kubectl describe pod",
  "kubectl logs",
  "Команда отвечает yes или no."
 ]
]);

// Схемы и код к статье
KB.v("rbac",[
 {
  type:"flow",
  h:200,
  after:"RBAC в Kubernetes",
  cap:"Права описываются в Role и выдаются через RoleBinding. Под получает ровно те права, что есть у его ServiceAccount.",
  nodes:[
   ["sa",16,70,150,50,"ServiceAccount|orders-svc"],
   ["rb",206,70,140,50,"RoleBinding","acc"],
   ["ro",386,70,140,50,"Role|get, list"],
   ["res",566,40,98,40,"configmaps","good"],
   ["no",566,110,98,40,"secrets ✗","warn"]
  ],
  edges:[["sa","rb",""],["rb","ro",""],["ro","res","","a"],["ro","no","","dw"]]
 }
]);

// Примеры и сложный случай
KB.ex("rbac",{ex:`## Проверка прав в middleware
~~~
func Require(perm string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !auth.From(r.Context()).Can(perm) { http.Error(w, "forbidden", 403); return }
			next.ServeHTTP(w, r)
		})
	}
}
// r.With(Require("orders:refund")).Post("/orders/{id}/refund", refund)
~~~

## Kubernetes
{{kubectl auth can-i delete pods --as=system:serviceaccount:app:orders -n app}} — проверить права сервисного аккаунта.`,
cs:`## Обобщённый случай из практики: роль проверялась, владелец — нет
**Ситуация.** Эндпоинт {{GET /invoices/:id}} проверял, что у пользователя есть роль «клиент».

**Что пошло не так.** Любой клиент, перебирая id, мог скачать счета других компаний.

**Причина.** RBAC отвечает «может ли роль читать счета», но не «этот ли счёт его». Классическая уязвимость IDOR / broken object level authorization.

**Как исправили.** Проверка принадлежности ресурса тенанту пользователя в каждом запросе (условие {{tenant_id}} в запросе к базе), непредсказуемые идентификаторы, тесты доступа к чужим объектам ([[acl]], [[owasp]]).`});
