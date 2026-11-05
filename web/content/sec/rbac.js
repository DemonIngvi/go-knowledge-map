// Права доступа: RBAC и ACL

// Статья
KB.add({id:"rbac",t:"Права доступа: RBAC и ACL",short:"RBAC / ACL",b:"sec",s:2,l:2,a:["RBAC","role-based access control","ABAC","роль","Kubernetes RBAC","Role","ClusterRole","RoleBinding","ServiceAccount","ACL: списки контроля доступа","ACL","access control list","список доступа"],
x:`**RBAC (Role-Based Access Control)**: права выдаются **ролям**, а роли — пользователям или сервисам. Пользователь получает права через роль, а не напрямую.

## Плюсы и пределы
- Просто администрировать: новый сотрудник получает роль «аналитик», и всё.
- **Взрыв ролей**: когда права зависят от атрибутов («менеджер своего региона»), ролей становится сотни. Тогда переходят к **ABAC** (правила по атрибутам) или ReBAC (по связям), см. [[auth-go]].
- Сравнение со списками доступа на объект — ACL.

## RBAC в Kubernetes
- **Role / ClusterRole** — набор правил: какие глаголы ({{get}}, {{list}}, {{watch}}, {{create}}, {{delete}}) на какие ресурсы ({{pods}}, {{secrets}}) в namespace или во всём кластере.
- **RoleBinding / ClusterRoleBinding** связывают роль с пользователем, группой или **ServiceAccount**.
- Подам выдают отдельный ServiceAccount с минимальными правами. По умолчанию токен монтируется в под — если API Kubernetes не нужен, отключите ({{automountServiceAccountToken: false}}).
- Проверка: {{kubectl auth can-i list secrets --as system:serviceaccount:ns:sa}}.

RBAC встречается и в [[vault]] (политики), и в Confluent Kafka ([[kafka-security]]), и в Argo CD ([[argocd]]).

## ACL: списки контроля доступа
**ACL (Access Control List)** — список правил, **привязанный к объекту**: кто и что может делать с этим конкретным ресурсом. Проверка: «есть ли у субъекта право на операцию с объектом».

## ACL: Где встречается
- **Kafka**: права принципала на топик, группу, кластер ([[kafka-security]]).
- **Файловые системы**: права Unix и POSIX ACL ({{setfacl}}).
- **Объектные хранилища**: ACL бакетов и объектов в [[s3]] (сейчас AWS рекомендует отключать ACL и использовать политики).
- **Сеть**: ACL на маршрутизаторах и коммутаторах фильтрует пакеты по адресам и портам ([[ip]]), NetworkPolicy в Kubernetes ([[k8s-core]]), security groups в облаках.
- Приложения: «этот документ видят пользователи X и Y».

## ACL: ACL или RBAC
ACL хорош, когда права **индивидуальны для объекта** (общий доступ к документу). RBAC / ACL удобнее, когда права типовые для групп людей. На практике их комбинируют: роль даёт право работать с документами, ACL определяет, с какими именно.

Минус ACL — сложно ответить на вопрос «к чему вообще есть доступ у этого пользователя»: нужно обойти все объекты. Отсюда системы вроде Zanzibar и OpenFGA ([[auth-go]]).`,
m:[["Kubernetes: Using RBAC Authorization","https://kubernetes.io/docs/reference/access-authn-authz/rbac/"],["NIST: Role Based Access Control","https://csrc.nist.gov/projects/role-based-access-control"],["Casbin: RBAC","https://casbin.org/docs/rbac"],["Wikipedia: Access-control list","https://en.wikipedia.org/wiki/Access-control_list"],["Kafka docs: ACLs","https://kafka.apache.org/documentation/#security_authz"]]});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("rbac",[
 ["Что связывает роль с ServiceAccount в Kubernetes?","RoleBinding или ClusterRoleBinding","Role","ConfigMap","NetworkPolicy","Role описывает права, Binding — кому их дать."],
 ["Когда RBAC начинает плохо работать?","Когда права зависят от атрибутов, и ролей становятся сотни","Когда пользователей больше 10","В Kubernetes","Никогда","Тогда переходят к ABAC или ReBAC."],
 ["Как проверить права ServiceAccount?","kubectl auth can-i ... --as system:serviceaccount:ns:sa","kubectl get roles","kubectl describe pod","kubectl logs","Команда отвечает yes или no."],
 ["К чему привязан ACL?","К конкретному объекту: кто и что может с ним делать","К роли","К пользователю","К сети целиком","В отличие от RBAC."],
 ["Какой вопрос трудно решить с ACL?","К чему вообще есть доступ у этого пользователя","Может ли пользователь читать файл","Кто владелец объекта","Есть ли объект","Нужно обойти все объекты."],
 ["Где используются ACL в сети?","На маршрутизаторах для фильтрации пакетов по адресам и портам","В DNS","В TLS","В TCP-рукопожатии","Аналог в Kubernetes — NetworkPolicy."]]);

// Схемы и код к статье
KB.v("rbac",[{"type":"flow","h":200,"after":"RBAC в Kubernetes","cap":"Права описываются в Role и выдаются через RoleBinding. Под получает ровно те права, что есть у его ServiceAccount.","nodes":[["sa",16,70,150,50,"ServiceAccount|orders-svc"],["rb",206,70,140,50,"RoleBinding","acc"],["ro",386,70,140,50,"Role|get, list"],["res",566,40,98,40,"configmaps","good"],["no",566,110,98,40,"secrets ✗","warn"]],"edges":[["sa","rb",""],["rb","ro",""],["ro","res","","a"],["ro","no","","dw"]]},{"type":"flow","h":180,"after":"ACL: ACL или RBAC","cap":"RBAC отвечает на вопрос «что можно этой роли», ACL — «кто и что может с этим конкретным объектом». На практике их сочетают.","groups":[[16,12,300,156,"RBAC: права роли"],[364,12,300,156,"ACL: список у объекта"]],"nodes":[["u",32,48,120,40,"Анна"],["r",180,48,120,40,"роль: editor","acc"],["p",32,110,268,40,"edit на все документы отдела","cell"],["d",380,48,268,40,"документ «План 2027»","acc"],["a1",380,96,268,30,"Анна: read, write","cella"],["a2",380,130,268,30,"Борис: read","cell"]],"edges":[["u","r",""],["r","p","","v"]]}]);

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
{{kubectl auth can-i delete pods --as=system:serviceaccount:app:orders -n app}} — проверить права сервисного аккаунта.

## ACL в базе
~~~
SELECT 1 FROM document_acl
WHERE document_id = $1 AND principal = ANY($2) AND permission = 'read'
~~~
$2 — пользователь и его группы.

## Файловые ACL
{{setfacl -m u:deploy:rx /srv/app}}, {{getfacl /srv/app}} — права для конкретного пользователя сверх owner/group/other.`,
cs:`## Обобщённый случай из практики: роль проверялась, владелец — нет
**Ситуация.** Эндпоинт {{GET /invoices/:id}} проверял, что у пользователя есть роль «клиент».

**Что пошло не так.** Любой клиент, перебирая id, мог скачать счета других компаний.

**Причина.** RBAC отвечает «может ли роль читать счета», но не «этот ли счёт его». Классическая уязвимость IDOR / broken object level authorization.

**Как исправили.** Проверка принадлежности ресурса тенанту пользователя в каждом запросе (условие {{tenant_id}} в запросе к базе), непредсказуемые идентификаторы, тесты доступа к чужим объектам (ACL, [[owasp]]).

## Обобщённый случай из практики: общая ссылка стала публичной
**Ситуация.** Документы можно было открыть по ссылке «для всех, у кого есть ссылка».

**Что пошло не так.** Ссылки на документы с внутренними данными попали в поисковые системы через публичные страницы, где их вставили сотрудники.

**Причина.** ACL по умолчанию слишком широкий, без срока действия и аудита.

**Как исправили.** По умолчанию доступ только для организации, срок жизни публичных ссылок, отчёт о публичных документах владельцам, {{X-Robots-Tag: noindex}} для страниц по ссылке.`});
