---
title: "Casbin is All You Need —— 访问控制框架 Casbin Ramp Up"
date: 2022-06-22 01:05:51
updated: 2022-06-22 01:05:51
---

## TL;DR

- 访问控制框架 Casbin 的原理以及其内部组件的结构
- 以一个 RBAC 的简单例子介绍 Casbin 的用法

## Casbin是什么？
### 访问控制

![](/asset/casbin-ramp-up/2022-06-23-17-50-00-image.png)

访问控制，顾名思义，是指判断一条请求是否可以访问受保护的资源的技术。在上图的例子中，我们的后台中有两个资源，Resource1和Resource2。它们可以是服务器、账号、图片、视频等等等等。但是，它们的相同特性是不能被所有用户都访问。比如 Resource1 属于用户 Alice，那么只有 Alice 能够访问它，Bob 则不能。因此，我们就需要对访问请求进行过滤，判断其是否被允许到达目标资源。在上面的例子中，Alice 发起了两个访问请求，分别想要访问 Resource1 和 Resource2。访问控制层需要做的工作就是允许访问 Resource1 的请求通过，而阻拦想要访问 Resource2 的请求，因为 Resource2 属于 Bob，Alice 是无法访问的。

在实际应用中，访问控制问题往往会随着业务而变得非常复杂。而 Casbin [<sup>1</sup>](#casbin) 就是一个强大的、高效的开源访问控制框架。Casbin 在 Github 上已获得超过 10k+ star，并且有着非常完整的生态。基于 Casbin 可以轻松的实现一系列访问控制模型，如 RBAC，ABAC等等。

### 原理——PML

Casbin 的底层原理基于其创建者罗杨博士所发表的一篇论文《PML: An Interpreter-Based Access Control Policy Language for Web Services》[<sup>2</sup>](#pml)

#### 设计目标

这篇论文主要关注于如何解决现实中云服务厂商有关权限校验所遇到的两个问题：

1. 每个云服务厂商都有着自己的一套权限检验规则。这对于在多个云环境都进行部署的用户来说，造成了很大的迁移和维护成本。
2. 同样的，维护自己的一套权限校验规则对于云服务厂商来说，也是一个挑战。如果云服务厂商缺乏在这方面的相关经验，就很有可能造成安全漏洞。

既然文章的目标本质上是通过通用性来解决问题，作者也考虑了如何实现这个目标，提出了两个 independent 的设计要求：

1. Access Control Model Independent：PML 既需要支持用户可以在多个云服务厂商中使用同一个模型，也需要支持用户在不改变校验代码的同时，可以切换不同的模型。
2. Implementation Language Independent: PML 的设计不应该依赖于某种编程语言的特性。
   因此，文中提出了一种新的权限校验语言——PML (PERM Modeling Language)，希望通过一种支持多种权限校验模型的配置语言来弥补这个 gap。

#### 设计实现

在介绍 PML 的设计之前，我们可以先大致了解一下访问控制问题中，所涉及到的一些概念。

![1c2dea1652f67c0b7920b0471a4113afd8d9325a.png](/asset/casbin-ramp-up/overview.png)

一般来说，访问控制会涉及到两个部分：

1. **Model 访问控制模型**。常见的模型有 ACL（Access Control List 访问控制列表），RBAC（Role-Based Access Control 基于角色的访问控制），ABAC（Attribute-Based Access Control 基于属性的访问控制）。对于一个应用来说，Model 的选择是与应用的业务逻辑是密切相关的，因此也是相对静态的。一旦代码编译完成，这部分是不会随着应用的运行而产生变化的。
2. **Policy 访问控制规则**。Policy 是和 Model 相对应的，每种不同的 Model，都会有不同格式的 Policy。而与 Model 完全相反的是，Policy 是相对动态的。在编写代码的过程中，我们只能去定义 Policy 的格式，而 Policy 的具体内容都是应用运行过程中添加或修改的。例如，有一个新用户注册了我们的应用。那么，我们就需要动态的为其添加一条 Policy。

我们可以将这两部分理解为传统应用中的代码和数据。有了这两部分后，再加上用户特定的校验逻辑，那么就可以完成访问控制任务。

##### PERM 模型

当然，对于现实环境中复杂的情况，简单地将问题建模为这两部分肯定是不够的，因此，论文提出了一个新的元模型 PERM（Policy-Effect-Request-Matcher）。

![6d8fa0a037c3ea185cfadb8d817c41cce0d66d78.png](/asset/casbin-ramp-up/pml.png)

PERM 模型主要包含了 6 个主要的概念：

1. **Request**：访问请求定义。用户真实的访问请求，通常会包含 sub（访问者），obj（被访问的资源）， act（访问时所进行的操作）或其他用户自定义的属性。
2. **Policy**：访问控制规则定义。定义了需要对访问请求的哪些属性进行校验。
3. **Policy Rule**：访问控制规则实例。
4. **Matcher**：如何为一条 Request 匹配到其对应的 Policy Rule。
5. **Effect**：当一条 Request 匹配到了一条或多条 Policy Rule，如何判断其是否应该被允许。
6. **Stub Function**：在实际应用中，Request 实例 和 Policy Rule 的匹配往往无法通过简单的 == 等于来解决，例如通配符等等。所以 Stub Function 允许用户自定义一些复杂的匹配方法。

这六个更加详细的建模了访问控制的问题。我们也可以对其简单的分一下类，Request，Policy，Matcher，Effect 和 Stub Function 都是静态的，属于 Model 的一部分。通过这个五项的组合，ACL等常见的模型以及一些用户自定义的规则，都可以很轻易的表示出来。在最后一部分中，会以 RBAC 为例，介绍如何通过 PML 实现这样一个模型。

而 Policy Rule 就属于动态变化的内容。在实际实现中，往往也是像数据一样，存储在数据库当中的。

## 结构

与论文中的实现相比，目前 Casbin 的实现更加强大，支持了更多功能。所以，这里以 Casbin 主库（Go 版本），介绍 Casbin 是如何进行工作的。

![6dbf7fb95022569c5ad99becdcd9090df8a99250.png](/asset/casbin-ramp-up/detail.png)

1. 在应用启动时，Casbin 会读取用户已经定义好的 Model，其中会包含 Request, Policy, Matcher 和 Effector 四个部分的定义。同时，Casbin 会利用 Adapter，从数据源处读取 Policy 实例（也就是上文提到的 Policy Rule）。后文就将 Policy 实例简称为 Policy。

2. 对于 Policy 的存储和读取，Casbin 将其解耦到了独立的 Adapter 模块。通过使用不同的 Adapter（File, MySQL等等），可以从不同的数据源中读取 Policy。对于 Policy 比较多的场景，将所有的 Policy 同时加载进内存，确实会导致一定的性能损失。所以，在加载时，部分 Adapter 也提供 `LoadFilteredPolicy` 的接口，通过只加载 Policy 的一部分子集，减少这部分带来的性能瓶颈。

3. 在一条请求到来时，该请求首先会按照 Model 中的定义进行拆分。接下来，Matcher 会根据 Model 中定义的规则，与 Policy 进行匹配。除了支持 == 强匹配外，Matcher 还支持通过 Function 和 Role Manager 进行模糊匹配。Function 像用户提供了自定义匹配规则的接口。通过向 Matcher 传入自定义函数，Matcher 可以对 Request 与 Policy 之间进行一些复杂的匹配。
   
   对于 RBAC 等访问控制模型，除了单纯的用户与权限之间存在关系之外，用户与角色（Role）之间还存在着继承关系。Casbin 中采用了 Role Manager 来为一条 Request 的用户以及其对应角色（包含继承角色）寻找与其相关的 Policy。同时，Role Manager 也支持添加自定义的 Function，来对用户与角色之间进行复杂的匹配。

4. 在实际应用中，一条 Request 可能会匹配到多条 Policy。得到所有的 Policy 后，需要进一步将多条 Policy 的结果进行聚合，得到最终是否允许 Request。Effector 根据 Model 中配置的规则，对所有 Matched Policy 的 effect 项进行进一步的 eval。

5. 在很多场景下，访问控制服务会有多个实例。Casbin 支持对 Policy 进行增量更新，那么，就需要 Dispatcher 维护多个 Casbin 实例的 Policy 之间的一致性。Dispatcher 主要提供两部分的功能，一部分是 Casbin 的 API，另一部分是 Dispatcher 自身的 API，用来实现成员管理等一致性问题，可以通过 Raft 等共识算法实现。

## Usage

在了解了 Casbin 的原理和结构后，我们可以开始利用 Casbin 来进行一些实践。本章以 RBAC 模型为例，构建一个简单的访问控制示例。RBAC (Role-Based Access Control) 模型是基于角色的访问控制模型。在 RBAC 的模型中，用户和资源之间存在着角色（Role），用户可以属于一个或多个角色，角色拥有权限去访问资源。

经过前两章的介绍，我们可以将访问控制分为三个部分：Static，Dynamic 和 User-specific Logic。在使用 Casbin 时，也可以这样进行划分。首先，我们先来定义一个静态的 RBAC Model（model.conf）。

```c#
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act
```

在这个模型中，分别定义了五部分内容。

1. **request_definition**，定义了 Request 的结构。这份示例中包含了访问者（sub），被访问者（obj）和操作（act）。
2. **policy_definition**，定义了 Policy 的结构。通常，由于 Policy 和 Request 之间要进行匹配，所以两者的结构有一定的相似性。
3. **role_definition**，定义了 Role Manager。`g` 定义了一套 RBAC 系统，换句话说是一组用户角色继承关系的集合。在实际使用中，更类似于一个函数，判断输入的参数是否在这个集合中存在继承关系。
4. **policy_effect**，定义了如何对多个匹配到的 Policy 做合并。目前，Casbin 支持几个固定语法的合并模式，在官网 [<sup>3</sup>](#policy) 上有着详细的介绍。这些模式的含义也很好理解，模式的语法与自然语言或者 SQL 非常相近。例如，`some(where (p.eft == allow))` 表示的是当任意一个 Policy 的 effect 是 allow，那么合并的结果即为 allow。
5. **matchers**，定义了如何匹配 Policy 和 Request。 定义公式的语法与常见语言中的布尔表达式相似，通过 `==` 可以将 Policy 和 Request 中的各项进行对比。

#### Policy

```
p, alice, data1, read
p, bob, data2, write
p, data2_admin, data2, read
p, data2_admin, data2, write
g, alice, data2_admin
```

接下来，我们可以按照 Model 中定义的 Policy 结构来编写 Policy 实例。例如，第一项 `p, alice, data1, read` 与 `p = sub, obj, act` 相对应，`alice`，`data1`，`read` 与 `sub`，`obj`，`act` 相对应。另外一条比较特殊的实例是最后一项，`g, alice, data2_admin`，定义了用户 `alice` 继承了 `data2_admin` 这一角色。

我们可以将上面的 Policy 保存在文件 policy.csv 中。但一般来说，Policy 储存在数据库等等一些更加 organized 的外部存储中。

#### User Logic

Casbin 几乎支持所有的常见的编程语言，用户使用的逻辑也基本相似，主要通过 Enforcer 类来进行操作。

```go
e, err := casbin.NewEnforcer("model.conf", "policy.csv")
result1, _ := e.Enforce("alice", "data1", "read")
fmt.Println(result1)
result2, _ := e.Enforce("alice", "data1", "write")
fmt.Println(result2)
result3, _ := e.Enforce("alice", "data2", "read")
fmt.Println(result3)
```

通过 Enforce 方法，开发者输入 Request，就可以得到这条请求是否可以通过。在上述例子中有 3 个 test case，分别验证了合法请求匹配，非法请求匹配，集成角色请求匹配。第一个 test case 对应了 policy.csv 中的第一条 Policy，第二个 test case 则没有 test case。第三个 test case 通过 `g, alice, data2_admin` 将 alice 与 data2_admin 的 Policy 关联起来，然后通过第三条 Policy p, data2_admin, data2, read 验证其为合法请求。

## Reference
<div id="ref1"/>
- [1] https://github.com/casbin/casbin
<div id="ref2"/>
- [2] https://arxiv.org/pdf/1903.09756.pdf
<div id="ref3"/>
- [3] https://casbin.org/docs/en/syntax-for-models#policy-effect
